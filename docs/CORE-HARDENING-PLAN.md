# Core Audit & Hardening Plan

Started: 2026-11-25. Follow-on to `WEBSOCKET-FIX-PLAN.md` (reconnect work, merged in PR #1).

## Scope

**In scope: the "core"**, meaning the shared code every game depends on:

- `packages/multiplayer`: `RoomManager`, `lobbyHandlers`, `clientRuntime`, `server`
- `packages/game-types`
- `apps/parlor` server wiring (`socketServer.ts`, `gameRegistry.ts`) and client stores
- The point where each game plugs in: `ServerGameDefinition`, `handleGameAction`, per-game timers, `getPlayerView` / `getSpectatorView`

**Out of scope:** whether each game's rules are correct. How games behave at the plug-in point is in scope.

## Baseline (2026-11-25)

- Multiplayer and game unit tests pass.
- `turbo check` fails: `@parlor/kings-corner` `definition.ts` uses `'draw-card'`, which isn't in the `KingsCornerAction` union. `@parlor/app#check` fails for the same reason.
- CI (`.github/workflows/docker-publish.yml`) only builds and publishes the Docker image on push to `main`. Nothing runs tests or type checks before a deploy.
- There's no `lint` script in any workspace, though `turbo.json` defines the task.

## Workflow

- Opus subagents do the implementation, which keeps the main session's context small.
- Agents never commit; the user commits.
- One PR per phase (or per Phase 3 item if it's large).
- Tick the boxes below as work lands, and note the commit or PR next to the item.

---

## Phase 0: Make the gate trustworthy

- [x] **0.1** Fix the kings-corner `'draw-card'` action type error so `turbo check` passes. Added `{ type: 'draw-card' }` to `KingsCornerAction`; the UI, handler and engine already supported it.
- [x] **0.2** Add a CI workflow that runs `check`, `test` and the Playwright e2e tests on PRs and pushes; make the Docker publish depend on it
- [x] **0.3** Add ESLint (TS + Svelte plugin) and a `lint` task in every workspace. Rules should at least flag:
  - `as unknown as` casts
  - floating or unhandled promises
  - `any`
- [x] **0.4** Add `lint` to the CI gate (start as warnings if the backlog is large, then tighten)

**Phase 0 notes**
- **CI:**
  - `.github/workflows/ci.yml` runs on PRs and can be called by other workflows (`workflow_call`).
  - `docker-publish.yml` calls it as a required `ci` job, so pushes to main and tags run CI once and only publish if it passes.
- **Lint:**
  - One flat config at the root (`eslint.config.js`), run with `pnpm lint` (`eslint .`) rather than per-workspace Turbo tasks.
  - It runs after `check` because type-aware linting of Svelte files needs `.svelte-kit/tsconfig.json`.
  - Server entry points, e2e specs and multiplayer tests aren't in any tsconfig, so they're linted without type info.
- **Autofix:** `--fix` removed unnecessary `as never` / `as unknown as` / `!` casts and changed some `let`s to `const`.
- **Hand fixes (booty-dice):** a useless try/catch in `definition.ts` and a redundant assignment in `AIPlayer.ts`.
- **Turbo:** `turbo.json` build outputs now include `build/**`, so SvelteKit app builds are cached.
- **Lint backlog at the end of Phase 0:** 0 errors, 162 warnings.
  - 45 `no-floating-promises`: feeds audit area B
  - 45 `svelte/no-navigation-without-resolve`
  - 23 `svelte/require-each-key`
  - 10 `as unknown as`: feeds audit areas A/E
  - the rest are unused vars and Svelte style rules
- **Tightening:** move the hardening rules to `error` as Phase 3 removes the warnings.

## Phase 1: Audit (read-only, findings only)

Run five parallel reviews. Each writes findings into `docs/CORE-AUDIT.md`, and each finding has:
- **ID**, e.g. `A-03`
- **Severity**: critical / high / medium / low
- **Location**: `file:line`
- **Repro**: a concrete scenario
- **Suggested fix**

- [x] **A. Input boundary**: every `socket.on` handler. Check payload types and shapes, sizes, rate limits, and host and turn authorization.
  - Leads:
    - `game:action` is cast without checks (`rawAction as unknown as CrazyEightsAction`); only booty-dice has `validation.ts`.
    - `maxHttpBufferSize` is left at the 1MB default.
    - There's no per-socket rate limit.
- [x] **B. Crash isolation**: can one malformed packet or one bad timer kill the process?
  - Leads:
    - No `uncaughtException` / `unhandledRejection` handlers.
    - Errors thrown inside bot `setTimeout` callbacks aren't caught.
    - The `game:action` router in `socketServer.ts` has no try/catch (`lobby:selectGame` does).
- [x] **C. Lifecycle & timers**: reset, restart, room deletion and host leaving while timers are pending.
  - Leads:
    - Each game keeps its own module-level `roomTimers` map.
    - Liars-dice and quixx also start timers they never keep track of.
    - A bot timer can fire after a reset or deletion and act on an old or missing engine.
- [x] **D. Information leakage & security**: player and spectator views must never reveal hidden hands, deck order or dice.
  - Also check:
    - error strings
    - token generation and comparison
    - how guessable room codes are
    - CORS
  - Lead: tokens use `randomUUID` (fine). Each engine's views need checking one by one.
- [x] **E. Contract & resource bounds**: type safety of `ServerGameDefinition`, unused events, caps on rooms, players, bots and names, cleanup of abandoned rooms, memory growth.
  - Leads:
    - `game:state` is typed as `BaseGameState`, so every game sends `as never`.
    - The legacy `room:*` and `chat:*` events are declared in `game-types` but never used.

**Phase 1 result** (2026-11-25): `docs/CORE-AUDIT.md`.
- 69 raw findings deduplicated to 32: 2 critical, 13 high, 6 medium, 11 low.
- No hidden-information leaks found.
- The audit proposes new Phase 3 buckets: 3.0 hotfix, 3.7 seat/session lifecycle, 3.8 lobby guards, 3.9 per-game rules, 3.10 infra/randomness.
- Correction to the Phase 0 notes: after the autofix, 5 `as unknown as` remain, not 10.

## Phase 2: Triage

- [ ] Review `docs/CORE-AUDIT.md` together; mark each finding fix-now / fix-later / won't-fix
- [ ] Adjust the Phase 3 list below to match

## Phase 3: Hardening (expected work, revise after triage)

- [ ] **3.1 Typed game contract**: change to `ServerGameDefinition<State, Action, View>`, with each game providing an action schema (zod or valibot). The core then:
  - validates the action
  - looks up the engine
  - calls the handler inside a try/catch that sends the error back as an ack

  This removes the copied switch/catch boilerplate from every game. Migrate all 5 games.
- [ ] **3.2 Room-scoped scheduler**: `roomManager.schedule(roomCode, fn, ms)` replaces the per-game timer maps.
  - All of a room's timers are cancelled on reset, restart and deletion.
  - Callbacks are wrapped so errors can't crash the server.
  - Move bots (all games) onto it.
- [ ] **3.3 Limits at the boundary**:
  - lower `maxHttpBufferSize`
  - per-socket token-bucket rate limiting
  - caps on room count, players per room, bots per room, and name length
  - cleanup of abandoned rooms
- [ ] **3.4 Process safety net**:
  - process-level error handlers that log and keep running
  - structured logging tagged with the room and player
  - basic counters (rooms, sockets, errors) on `/healthz` or a metrics endpoint
- [ ] **3.5 Clean up the types**:
  - delete the unused `room:*` / `chat:*` events
  - make `game:state` generic per game so the `as never` casts go away
- [ ] **3.6 Leak fixes**: fix every view leak found in audit area D

## Phase 4: Prove it

- [ ] **4.1 Socket fuzz test**: run the real Socket.io server and send random or malformed payloads to every client-to-server event. Pass means:
  - the process stays up
  - the room's state is unchanged
  - no error responses expose internals
- [ ] **4.2 Random playthroughs per engine**: play many games using only legal moves.
  - Nothing throws.
  - The invariants hold, e.g. card count is conserved and turn order is valid.
  - No player view contains anything hidden from that player.
- [ ] **4.3 Lifecycle race tests**:
  - reset while a bot turn is pending
  - the host disconnects mid-game
  - restart twice in a row
  - the last human leaves while bots are still playing
  - the room is deleted with timers pending

---

## Log

| Date | Item | Notes / commit |
|---|---|---|
| 2026-11-25 | Plan written | — |
| 2026-11-25 | Phase 0 complete (0.1–0.4) | branch `paul-schwendenman/core-hardening-phase-0`, uncommitted |
| 2026-11-25 | Phase 1 audit complete (A–E) | `docs/CORE-AUDIT.md`, 32 findings |
