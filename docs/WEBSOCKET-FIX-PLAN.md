# Websocket Fix Plan

Audit (2026-07-15) found the reconnect pipeline broken at every layer. This plan fixes it in five phases.

## Identity model decision (drives everything)

**Stable server-generated `playerId` + `reconnectToken`; engines keyed by stable id; each socket joins a personal Socket.io room named by `playerId`.**

- Engines are created from stable ids and never need an `updatePlayerId` — no per-engine changes.
- `io.to(playerId)` in `broadcastViews` keeps working across reconnects because the new socket re-joins room `playerId`.
- `socket.data.playerId` becomes the stable id; every handler/engine call routes through it instead of `socket.id`.
- `connectionStateRecovery` is added as an *optimization* for short blips, not the source of truth — app-level `player:reconnect` + token still required for server restarts, new tabs, and long outages.
- RoomManager re-key: `players` Map keyed by `playerId`; add `socketToPlayer: Map<socketId, playerId>`; `playerToRoom` keyed by `playerId`. `handleDisconnect(socketId)` resolves via `socketToPlayer`.

## Phase 0 — Extract shared client runtime (enabler, do first) — size M

`apps/parlor/src/lib/stores/socketClient.ts` and all 5 `games/*/src/lib/stores/socketClient.ts` are near-identical. Without extraction, client fixes are written 6×.

- New `packages/multiplayer/src/clientRuntime.ts` (exported via `client.ts`): factory `createParlorRuntime(adapter)` owns socket lifecycle, connect/reconnect/session logic, ack helpers. Adapter shape: `{ connectionState, lobbyState, gameState, playerState, onView }`.
- Refactor the 6 `socketClient.ts` files to thin wrappers. Parlor keeps multi-game `lobby:gameSelected` wiring; standalone games keep their single-view cast.
- Tests: Vitest on the runtime's reconnect/session logic against a mocked socket.

## Phase 1 — Server identity foundation — size L

Contract (`packages/game-types/src/index.ts`):
- `lobby:create`/`lobby:join` callbacks return `{ roomCode, playerId, reconnectToken }`. `SessionData` gains `reconnectToken`.
- `player:reconnect(roomCode, playerId, token, cb)` — token required (fixes seat-stealing).
- Wire the declared-but-missing `room:leave` handler.
- Add ack callbacks to `lobby:ready` / `lobby:startGame` / `lobby:selectGame`.

RoomManager (`packages/multiplayer/src/RoomManager.ts`):
- Stable id + token generation; re-key maps per identity model above.
- `handleReconnect` validates token, marks connected.
- Enforce selected game's `maxPlayers` at join + start (room default 8 currently ignores game max of 5).
- Sockets `socket.join(playerId)` on create/join/reconnect.

lobbyHandlers (`packages/multiplayer/src/lobbyHandlers.ts`):
- Try/catch + payload validation on every handler (currently `name.trim()` on a non-string crashes the process).
- `resetGame`/`restartGame`: add `isHost` gate.
- Fix `restartGame` deadlock: `resetGame` un-readies humans, then `startGame` requires ready → hangs. Re-ready or bypass; emit `gameStarting` only if start will succeed.

socketServer (`apps/parlor/src/lib/server/socketServer.ts`):
- Gate `selectGame` on `status === 'waiting'`; set room maxPlayers from `definition.meta.maxPlayers`.

Tests: heavy Vitest on RoomManager (token accept/reject, re-key, maxPlayers) + lobbyHandlers with mock io/socket (malformed payloads, non-host restart/reset, restart actually starts).

## Phase 2 — Disconnect grace + cleanup — size M

- `handleDisconnect`: mark `connected = false`, schedule ~60s timer per player (`disconnectTimers: Map<playerId, Timeout>`). On expiry: lobby player → remove + host reassign + destroy empty room; in-game player → engine forfeit/cleanup + destroy room if all gone. Fixes both instant-delete-in-lobby and leak-forever-in-game.
- Clear timer on `handleReconnect`.
- Emit `lobby:playerLeft` only on real removal; distinct disconnected signal while retained.
- `onPlayerReconnect` re-emits view via `io.to(playerId)` — no engine changes needed under stable ids.

Tests: Vitest with fake timers — reconnect within grace keeps hand/host; past grace removes; empty-room GC. Review Phases 1+2 together.

## Phase 3 — Client reconnect chain + UX — size M–L

All in the shared runtime (write once):
- Delete the `reconnectAttempted` one-shot latch; attempt `player:reconnect` on every `connect` when a session exists (per-socket-instance flag, reset on new socket).
- On reconnect success, persist returned `playerId`/token to localStorage and set `playerState.id` (fixes second-reconnect-always-fails).
- `reconnectionAttempts: Infinity` (currently 5 ≈ 17s, shorter than a deploy) + capped `reconnectionDelayMax`.
- `roomNotFound` must wait for the `player:reconnect` ack (or grace window) before latching — kills the false "doesn't exist" flash on refresh.
- Acks + timeouts + user feedback for `lobby:ready`/`startGame`/`selectGame`.
- Lobby "Change" button → server-authoritative clear (`selectGameAction(null)`), not local mutation.
- `connect_error` must not clobber `'reconnecting'` status; add `import.meta.hot?.dispose()` teardown.

Tests: Vitest for runtime logic; Playwright reconnect flows via `context.setOffline(true/false)` + server restart — assert no false roomNotFound, hand restored, second reconnect works. Few and deterministic.

## Phase 4 — Infra (parallel after Phase 1) — size S–M

- Enable `connectionStateRecovery` (maxDisconnectionDuration ~2m), explicit `pingInterval`/`pingTimeout`, env-driven CORS allowlist (currently `origin: '*'`). Centralize Socket.io opts in `@parlor/multiplayer` server factory so all 6 servers + 6 vite configs share them.
- `/healthz` express route; point k8s liveness/readiness at it (currently hits `/` = full SvelteKit render); tune probe thresholds.
- SIGTERM handler: stop accepting, drain sockets, `server.close()` (currently every deploy hard-kills all games).
- Sticky sessions (Traefik) + Redis adapter: **document as prerequisites for `replicas > 1`, do not implement now.**

## Order

Phase 0 → 1 → 2 → 3; Phase 4 parallel after Phase 1. Each phase is one PR.
