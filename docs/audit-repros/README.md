# Audit repro scripts

Throwaway scripts the Phase 1 reviewers used to confirm findings in `docs/CORE-AUDIT.md`.

They're kept as **starting points for regression tests**: each fix PR should turn the relevant script into a Vitest test (see the testing rule in `docs/CORE-HARDENING-PLAN.md`) and then delete the script.

They're not part of the build, tests or lint. Expect rough code: `any`, ad hoc output, hardcoded timings.

## Running

From the repo root:

```sh
apps/parlor/node_modules/.bin/tsx docs/audit-repros/<dir>/<file>
```

Paths are relative to the repo, so the scripts work from any checkout. A script that "passes" **prints evidence of the bug**. Once the bug is fixed, its output changes, which is what the regression test should assert.

- `crash/parser.cjs` resolves socket.io through a version-pinned pnpm path (`socket.io@4.8.3`). Update the path if socket.io is upgraded.
- `crash/server.mts` + `crash/client.mjs` / `poison.mjs` / `quixx.mjs` are a pair: start the server with `PORT=<n>`, then run the client with the same `PORT`.

## Index

| Script | Shows | Findings |
|---|---|---|
| `boundary/crash.mjs` | A non-function ack crashes the process (exits 1 with `TypeError`) | F-01 (A-01, B-01) |
| `boundary/leak.mjs` | One socket creates thousands of rooms that outlive its disconnect | F-02 (A-02, A-03) |
| `rooms/probe.ts` | Ghost seats, `setMaxPlayers` under occupancy, 1 MB names, code-space size | F-02, F-11, F-13 (E-01, E-03, E-07) |
| `rooms/mem.ts` | Memory per room, and slowdown as the code space fills | F-02 (E-02) |
| `rooms/stale.ts` | A late disconnect from the old socket evicts a player who has reconnected, and moves the host | F-10 (E-04, C-07) |
| `crash/poison.mjs` | A nested card payload breaks every later `game:state` broadcast | F-04 (B-03) |
| `crash/parser.cjs` | socket.io-parser behaviour at various nesting depths | F-04 (B-03) |
| `crash/quixx.mjs` | Quixx with 2 bots and auto-roll stalls | F-09 (B-04) |
| `crash/quixx-coerce.mts` | A string `cellIndex` bypasses the Quixx row rules | F-05 (A-08) |
| `crash/shutdown.mts` | Graceful-shutdown behaviour of the socket server factory | F-03 (B-02) |
| `crash/server.mts`, `crash/client.mjs` | Harness: the real server, and a scripted client with scenarios | (B) |
| `lifecycle/core.mts` | Reconnect race; room destruction skips `onGameReset` / `onPlayerRemoved`; start while playing; spectator map after destroy | F-10, F-08, F-11, F-16, F-28 (C-06, C-07, C-09, C-14) |
| `lifecycle/booty.mts` | Double start creates two engines; `game:state` emits continue after a reset | F-11, F-07 (C-06, C-01) |
| `lifecycle/liars-stale.mts` | The old engine's AI loop broadcasts into a restarted game | F-07 (C-01) |
| `lifecycle/quixx-race.mts`, `lifecycle/quixx-restart.mts` | An old timer cancels the new bot timer; auto-roll stall | F-07, F-09 (C-02, C-03) |
| `lifecycle/c8-kc.mts` | Removed seat never skipped (Crazy Eights); the Kings Corner bot lookup drifts after a removal | F-08 (C-04, C-05, E-10) |
| `lifecycle/fake.mts`, `harness.mts`, `vclock.mts` | Harness: fake io and socket around the real `setupLobbyHandlers`; virtual and scaled clocks | (C) |
| `security/leakcheck.ts` (+ `sanity.ts`) | Fuzzes 400 card games and 300 Liar's Dice games, diffing views against hidden state (0 problems) | Phase 4.2 seed |
| `security/live.mts` | Live server: code enumeration, a spectator forcing `nextRound`, token reuse, error-string leakage | F-14, F-15, F-10, F-22 (D-01, D-02, D-04, D-07) |
| `security/spec.mts` | A spectator forces Liar's Dice `nextRound` | F-15 (D-02) |
| `security/err.mts` | Raw engine exception text reaches the client | F-22 (D-07) |

Last confirmed against the code on 2026-11-25 (branch `paul-schwendenman/core-hardening-phase-0`).
