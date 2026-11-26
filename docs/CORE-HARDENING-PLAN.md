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
- **Every fix PR ships its own regression tests** (Phase 4 is only for broad fuzzing and seeded playthroughs). Start from the matching script in `docs/audit-repros/` and turn it into a Vitest test. Standards:
  - **Boundary tests:** a rejected request leaves room and engine state unchanged, *and* the server still handles a valid request afterward.
  - **Lifecycle tests:** include an AI or async operation that **starts before** a reset, restart or deletion and **finishes after** it, not just a pending timer.
  - **View tests:** assert what each recipient actually **receives over the socket** (capture emits per socket or room). A correct view sent to the wrong audience is still a leak.

---

## Phase 0: Make the gate trustworthy

- [x] **0.1** Fix the kings-corner `'draw-card'` action type error so `turbo check` passes. Added `{ type: 'draw-card' }` to `KingsCornerAction`; the UI, handler and engine already supported it.
- [x] **0.2** Add a CI workflow that runs `check`, `test` and the Playwright e2e tests on PRs and pushes; make the Docker publish depend on it
- [x] **0.3** Add ESLint (TS + Svelte plugin) and a `lint` task in every workspace. Rules should at least flag:
  - `as unknown as` casts
  - floating or unhandled promises
  - `any`
- [x] **0.4** Add `lint` to the CI gate (start as warnings if the backlog is large, then tighten)
- [x] **0.5** Bring the files currently linted without type info under type-aware linting. These are the `apps/*/server/**`, `games/*/server/**` and `apps/*/e2e/**` files, and the multiplayer `*.test.ts`. Add a `tsconfig.eslint.json` (or per-package ones) that includes them, and remove the `disableTypeChecked` block from `eslint.config.js`. Without this, raising `no-floating-promises` to `error` still won't cover the server entry points. **Do before tightening the hardening rules to `error`.**
  - **Done:**
    - **Lint-only tsconfigs:** a `tsconfig.eslint.json` in `apps/parlor`, each game and `packages/multiplayer`, each extending that package's tsconfig. `tsc` and `svelte-check` don't use them, so build output is unchanged.
    - **ESLint:** the `disableTypeChecked` block was replaced by glob-based `parserOptions.project`, so new test, entry-point and e2e files are covered automatically.
    - **Turbo:** `turbo.json` `check` now caches the generated `.svelte-kit` tsconfig and types. Without that, a cache hit left games with no `.svelte-kit/`, and type-aware linting quietly broke. Small `packages/{game-types,multiplayer,ui}/turbo.json` files quiet the "no outputs" warnings.
    - **First type-aware run:** it found 3 unnecessary `!` assertions in 3.1a's `RoomManager.test.ts`, which were autofixed.
    - **Lint count:** 0 errors, 162 warnings.

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
  - 10 `as unknown as`: feeds audit areas A/E (5 actually remain after the autofix; the other 5 were removed)
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

- [x] Review `docs/CORE-AUDIT.md` together; fill the Triage column (`now` / `later` / `wontfix`). 2026-11-25: the user accepted the proposed buckets and order; all 32 findings marked `now`.
- [x] Adjust the Phase 3 list below to match

## Phase 3: Hardening

Revised 2026-11-25 after the Phase 1 audit and an external review of this plan. `F-xx` refers to the findings index in `docs/CORE-AUDIT.md`.

**Order:**
1. 3.0
2. 3.1a
3. 3.7 + 3.8
4. 3.2
5. 3.3
6. 3.4
7. 3.1b
8. 3.9
9. 3.5
10. 3.10

The reasoning:
- **3.0 and 3.1a first:** they're cheap and close the crash and cheat holes at the socket boundary.
- **Then 3.7, 3.8 and 3.2:** together they remove most of the "room gets stuck in normal play" bugs.
- **3.1b before 3.9:** the five-game type migration waits until the boundary is safe, and gives the per-game fixes the contract they need (for example `onPlayerRemoved`).

### 3.0 Hotfix
- [x] **3.0** Only call an ack if `typeof callback === 'function'`, on every handler that takes one. Don't call the ack again from the `catch` block. Regression test: the `boundary/crash.mjs` packet → the process stays up, and a valid `lobby:ready` afterward still succeeds. (F-01)
  - **Done (branch `paul-schwendenman/core-hardening-3.0`):**
    - New `safeAck()` in `packages/multiplayer/src/ack.ts`, exported from `@parlor/multiplayer`.
    - Applied to `lobby:ready`, `lobby:startGame` and `lobby:selectGame`, the only handlers using `callback?.()`. The others already checked `typeof callback === 'function'`.
    - Regression tests over a real socket.io server and client, each sending 7 bad ack values and then a valid request: `packages/multiplayer/src/malformedAck.test.ts` (24 tests) and `apps/parlor/src/lib/server/socketServer.test.ts` (8 tests). Both fail without the fix.
    - `apps/parlor` now has Vitest (a standalone `vitest.config.ts` and a `test` script), so its tests run in `turbo test` and CI.

### 3.1 Game contract: boundary first, migration second
- [x] **3.1a Core action boundary and required action validation.** *(Done on branch `paul-schwendenman/core-hardening-3.1a`; see the notes at the end of this item.)* No generic types or wire migration yet; those are 3.1b. Revised after a second external review: every action is validated at runtime in this item, rather than waiting for 3.1b.
  - **One core dispatcher used by every router:** `dispatchGameAction()` in `packages/multiplayer/src/actionBoundary.ts`, used by all six (the parlor app and the five standalone game servers). In order:
    1. **Envelope:** a plain object with a string `type`, depth ≤ 4, ≤ 64 keys or elements, strings ≤ 256 characters, no `__proto__` / `constructor` / `prototype` keys → otherwise `INVALID_ACTION`. (F-04)
    2. **Membership:** a room exists (`NOT_IN_ROOM`), the sender is a seated, non-spectator player bound to this socket (`NOT_A_PLAYER`), and a game is running (`NO_ACTIVE_GAME`). (F-15)
    3. **Required per-game `validateAction`**, implemented by all five games. It's a hand-written validator for every action type each game's UI sends, checking:
       - the allowed `type`
       - required fields and exact types
       - integers, ranges and enums
       - that there are no extra keys

       It returns a **sanitized action rebuilt from the validated fields**, so client-supplied extra keys and objects never reach the engine. Card games look up the card in the player's own hand. → `INVALID_ACTION`. (F-05, F-04)
    4. **Handler call** inside try/catch, also handling a returned promise (`handleGameAction` returns `void | Promise<void>`).
  - **What counts as success:** a handler that returns normally is acknowledged `{ ok: true }`, so **handlers must never reject an action by returning silently**. Every rejection throws `GameRuleError`, and an unknown action type is `INVALID_ACTION`. The existing silent `return`s in Quixx (for example out-of-turn `roll-dice`) and Booty Dice (wrong player or phase) are converted.
  - **Error model:**
    - **`GameRuleError`** (`NOT_YOUR_TURN` / `RULE_VIOLATION` / `INVALID_ACTION`): its message is safe to show, the game keeps running, and it's sent as both an ack and an `error` event.
    - **Anything else:** logged, the client sees only "Something went wrong" (`INTERNAL`), and the room is sent back to the lobby via `returnRoomToLobby()`. It never continues on a possibly half-mutated engine. (F-03, F-17)
    - **Lobby handlers:** raw `err.message` never goes to clients from these either (`toPublicError`). (F-22)
  - **Wire:** `game:action` takes an optional `ack(ActionResult)`. Codes: `NOT_IN_ROOM`, `NOT_A_PLAYER`, `NO_ACTIVE_GAME`, `INVALID_ACTION`, `NOT_YOUR_TURN`, `RULE_VIOLATION`, `RATE_LIMITED` (reserved, 3.3), `INTERNAL`, `TIMEOUT` (client only). `clientRuntime.sendAction()` has a 5s timeout and never rejects. GameViews are unchanged.
  - **Start rollback:** if `onGameStart` throws during start or restart, the room is rolled back to `waiting`. `lobby:gameStarting` is only sent after a successful start. (F-17, B-08)
  - **Per-game fixes shipped with the boundary:**
    - **Liar's Dice:** `nextRound` is limited to players in the game during the reveal (`requestNextRound`), and the auto-advance timer is tied to its round.
    - **Quixx:** the turn is checked before the phase timer is cleared.
    - **Booty Dice:** must roll before `endTurn` (F-06, moved up from 3.9 so a scoring bypass doesn't wait for the migration).
  - **Done notes:**
    - **Tests:** 334 → 532.
    - **New core files:**
      - `actionBoundary.ts`
      - `actionValidation.ts` (the shared validator helpers)
      - `errors.ts` (`GameRuleError`, `toPublicError`)
      - a test-only harness at `@parlor/multiplayer/testing`
      - `RoomManager.isSeatedPlayer()`
      - `returnRoomToLobby()`
    - **Per-game validators:** `games/*/src/lib/server/validateAction.ts`. Card games now push the server's own card object from the player's hand. The dead `booty-dice/.../validation.ts` was deleted.
    - **Liar's Dice:** bids are 1–30 (the most dice any table can have). Over-bidding stays legal.
    - **Booty Dice:**
      - `lockDice`, `finishRolling` and `endTurn` all require having rolled this turn.
      - A turn that a disconnect or bot timeout ends without a roll scores nothing.
      - It still *shows* the previous player's dice at the start of a turn; resetting them is a UI decision.
    - **The "unexpected error → back to the lobby" path** is tested with a deliberately faulty copy of Crazy Eights. No real game can be made to throw unexpectedly any more.
    - **Left for later:**
      - the 5 `as unknown as` casts, now behind validation (3.1b)
      - an async handler rejecting after a restart could reset the new game (3.2; no handler is async today)
      - a mid-game `lobby:state` is still treated as a reset by the client (3.8)
      - envelope and membership rejections only send an ack, so the current GameViews show nothing for them
    - **Also in this branch:** `.claude/worktrees/` was added to `.gitignore` and the ESLint ignores, after an in-repo agent worktree broke `pnpm lint`.
- [ ] **3.1b Typed contract, piloted on one game, then migrated.**
  - **Design** `ServerGameDefinition<State, Action, View>`. Optionally replace 3.1a's hand-written validators with schemas (zod or valibot) that infer `Action`; the runtime behaviour must stay identical, and the 3.1a validator tests are the contract.
  - **Wire typing:** the shared socket carries every game, so `game:state` becomes an envelope: `{ gameId, view }`, typed as a union keyed by `gameId` (a `GameViewMap` in `game-types`, extended by each game via module augmentation or a central map). That's what actually removes the 35 `as never` casts rather than moving them.
  - **Lifecycle contract:** require `onPlayerRemoved` and carry the `onRoomDestroyed` callback from 3.2 into the typed definition.
  - **Pilot:** migrate **one** game end to end (crazy-eights is the simplest: no bots) and review the shape. Then migrate the other four.
  - **Remove the duplicated plumbing:** `broadcastViews`, the action switch, and the remaining `as unknown as` action casts. (F-20, F-32 casts)

### 3.2 Game-instance lifetime and scheduling
- [x] **3.2** Give everything a game does a **game-instance lifetime**, separate from the room's lifetime.
  - **One handle per started game:** each started game gets a `GameInstance` handle (id, `AbortSignal`). Reset, restart, game switch and room deletion **invalidate** the old instance: they abort its signal, cancel its timers, and mark it stale.
  - **Scheduler:** `instance.schedule(fn, ms)` replaces the per-game `roomTimers` / `botTimers` maps and the untracked `setTimeout`s. Callbacks are wrapped (an error → log and send the room back to the lobby, never a process crash), and are skipped if the instance is stale.
  - **Work already running is covered, not just pending timers.**
    - AI loops and other async continuations (for example Kings Corner's async AI in `games/kings-corner/src/lib/server/definition.ts`, and the `Promise.race` timeouts) must check `instance.isCurrent()` / `signal.aborted` **before every mutation and every broadcast**.
    - A `Promise.race` timeout must abort the losing operation, not just stop waiting for it.
    - The core broadcast helper refuses to emit for a stale instance.
  - **Reconnect grace timers are not game-scoped.** The per-player disconnect timers in `RoomManager` belong to the **room and player** and must survive a game reset or restart. Keep them on their own lifetime; don't route them through the game-instance scheduler.
  - **Room destruction** calls the game's `onRoomDestroyed` and invalidates the instance.
  - **Regression tests:**
    - a bot turn that **starts before** a reset and **finishes after** it → zero mutations or emits from the old instance
    - a Quixx restart doesn't lose the new bot timer
    - a player in grace keeps their timer across a reset
  - (F-07, F-16, F-31, F-03 timers)
  - **Implemented:** all five games use the per-instance scheduler and guard game-view emissions. Reset and room deletion invalidate pending and running game work, and restart creates a fresh instance after its lobby checks pass. Timer failures return only the current room to the lobby. Late action rejections cannot reset a replacement game.

### 3.3 Limits at the boundary
- [x] **3.3**
  - **Names:** server-side rules (length and charset, NFC normalization, trimming, uniqueness with lookalike folding), plus bot-name reservation.
  - **Messages:** lower `maxHttpBufferSize`.
  - **Rate limiting:** per-socket token-bucket rate limits, with stricter buckets for `lobby:join` and `lobby:spectate`.
  - **Caps:**
    - per-IP and total connections
    - total rooms, with fail-fast code generation instead of an infinite loop
    - spectators and bots per room
    - game log length
  - **Room codes:** longer codes, or join throttling plus a host kick. (F-13, F-14, F-26; the code-space part of F-02)
  - **Implemented:** room codes are six characters, with at most 16 allocation attempts. The caps are 512 rooms per process, 16 spectators and four bots per room, and 100 retained entries per game log. Socket.IO uses a 16 KiB inbound message limit and caps Engine.IO sessions at 256 total and 32 per direct peer IP.
  - **Rate budgets:** 80 requests per socket with a refill of 20 per second. Join and spectate also share a six-request bucket with a refill of two per second.
  - **Names:** 1–24 Unicode code points after trimming and NFC normalization, with a character allowlist and uniqueness checks that fold case, accents, compatibility forms and common Greek and Cyrillic lookalikes. The Bot name prefix is reserved.

### 3.4 Process safety net and observability
- [ ] **3.4**
  - **Expected failures are caught at the boundaries.** That's the socket boundary (3.0 / 3.1a) and the scheduler boundary (3.2), including rejected promises, and it keeps the failure to one room.
  - **Process level: log, then exit.** On `uncaughtException` or `unhandledRejection`, log with full context and **exit non-zero**, letting the supervisor (k8s) restart the process. Don't keep running after an unknown failure: a half-applied change makes every room's state untrustworthy.
  - **Document the restart cost:** rooms live in memory, so a crash or restart **loses every active game**. Add this to `docs/DEPLOYMENT.md` and `k8s/README.md`, along with the restart policy and how clients reconnect to a server that has lost their room ("room not found" → back to home).
  - **Logging and metrics:**
    - structured logs tagged with room code, game id, player id and instance id
    - counters for rooms, sockets, games started, rejected actions and caught room failures, on `/healthz` or `/metrics`
  - (F-03, F-21, F-22)

### 3.5 Clean up the types
- [ ] **3.5**
  - Delete the unused protocol surface: `room:*`, `chat:*`, `game:start`, `Room`, `RoomStatus`, `ChatMessage`, and `createGameServer`.
  - Decide whether `room:leave` and `lobby:spectate` get a UI or are removed.
  - Remove the remaining `as never` / `as any` / `getGameData<T>` casts left after 3.1b.
  - Raise the hardening lint rules to `error` (requires 0.5). (F-32)

### 3.6 Leak fixes: dropped
- ~~**3.6**~~ Audit D found no view leaks. View-recipient regression tests are still required by the workflow testing rule, and F-30 has moved to 3.9.

### 3.7 Seat and session lifecycle
- [x] **3.7** One seat per socket.
  - Create, join, spectate or reconnect **releases the previous seat**, its room membership and its spectator entry.
    - **Order of operations:** validate the new seat **first** (the room exists, there's capacity, the status allows it, the token is valid). Release the old seat **only after** the new one is committed. A failed join, spectate or reconnect must leave the socket in its old seat, with no change to either room.
    - **Regression test:** a seated player tries to join a full or nonexistent room → error, they're still seated in their original room (same playerId, connected, still receiving that room's broadcasts), and the target room is unchanged.
  - **Supersede the old socket on reconnect:** disconnect it, and ignore its late `disconnect` so it can't start a grace timer.
  - **Rotate the reconnect token** on each successful reconnect.
  - **Restart:** don't seat players who are in their grace window as connected.
  - **Host:** transfer host while the host is in grace, or allow host actions to proceed.
  - (F-02, F-10, F-18, F-28, F-29)
  - **Implemented:** seat changes release public and private room memberships after validation. Token reconnect restores the latest view through the application handshake and replaces Socket.IO packet replay. A connected human takes over when the host disconnects into grace.

### 3.8 Lobby lifecycle guards
- [x] **3.8**
  - **Server-side start preconditions:** status is `waiting`, a game is selected, `minPlayers ≤ n ≤ maxPlayers`, and bots are only allowed if `supportsBots`. The same `waiting` gate applies to `ready`, `addBot` and `removeBot`.
  - **Restart has its own transition, not the start gate.**
    - **Allowed from:** `playing` or `finished` only (from `waiting`, it's a no-op with an error).
    - **Check preconditions first:** game still selected and definition present, enough connected players for `minPlayers` after excluding anyone in grace (see 3.7), and bots allowed. Do this **before** invalidating the current game instance (3.2) or resetting the room.
    - **If the checks fail:** reply with an error and **leave the current game untouched**. Today, restart resets first and only then finds it can't start, which destroys the game.
    - **If they pass:** invalidate the instance → reset → start, with the 3.1a rollback if `onGameStart` throws.
    - **Regression tests:**
      - restart with too few players → error, the old game is still running and still broadcasts
      - restart from `waiting` → rejected
  - **Game switch:** `selectGame` refuses, or explains, when the current occupancy exceeds the new game's `maxPlayers`.
  - **Explicit reset event:** an explicit `game:reset` / `lobby:returned` event, so the client stops treating any mid-game `lobby:state` as a reset.
  - **Finished status:** set `status: 'finished'`.
  - (F-11, F-12, F-27)
  - **Implemented:** game metadata drives start requirements, restart excludes grace seats from the new engine, and returning players excluded from a restart receive spectator views. The client resets on `lobby:returned`. Each game marks its room finished when the engine ends.

### 3.9 Per-game rule fixes
- [ ] **3.9**
  - **All games:** turn order skips removed and absent seats.
  - **Kings Corner:** fix the bot lookup so it uses the engine's seat order, not the lobby's index.
  - **Quixx:** fix auto-roll after a bot follows a bot.
  - **Liar's Dice:** the bot sees only its own dice.
  - (F-08, F-09, F-30; F-06 moved to 3.1a)

### 3.10 Infra and randomness
- [ ] **3.10** *(Infra half done; `crypto.randomInt` still open.)*
  - **Randomness:** `crypto.randomInt` for room codes, shuffles and dice.
  - **Origins:** a `CORS_ORIGIN` allowlist set in k8s, plus an `allowRequest` origin check for websocket connections.
  - **Container:** a non-root image and a k8s `securityContext`.
  - **Workflows:** top-level `permissions` and actions pinned to commit SHAs.
  - (F-19, F-23, F-24, F-25)
  - **Done (infra half):**
    - **Container:** non-root `USER node` (uid 1000). Files are `--chown`ed; a stricter option is root-owned files, which matters little because k8s mounts the filesystem read-only. tsx's cache goes to `/tmp`.
    - **k8s:**
      - pod and container `securityContext`: `runAsNonRoot`, uid/gid/fsGroup 1000, `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities: drop [ALL]`
      - a 64Mi in-memory `/tmp` emptyDir
      - `automountServiceAccountToken: false`
      - `CORS_ORIGIN=https://parlor.whatsdoom.com`, taken from the ingress host
    - **WebSocket and polling origin check:** `createOriginCheck` in `packages/multiplayer/src/server.ts`, via `allowRequest`, applied only when an allowlist is configured.
      - Requests with no `Origin` header are allowed; the literal origin `null` is rejected.
      - With `CORS_ORIGIN` unset, any origin is accepted, and a warning is logged in production.
      - Covered by a real-socket test over both websocket and polling.
    - **Workflows:** top-level `permissions: contents: read`, `packages: write` only on `build-and-push`, and every action pinned to a SHA resolved with `gh api`.
    - **Docs:** `k8s/README.md` and a production checklist in `docs/DEPLOYMENT.md`.
    - **Verified:** `docker build` succeeded. A smoke run with a read-only filesystem, `--cap-drop ALL` and no-new-privileges served `/healthz` as uid 1000. A disallowed origin got 403 (polling) and 400 (WebSocket); an allowed one got 200 and 101.
  - **Still open:**
    - `crypto.randomInt` for room codes, shuffles and dice (touches the engines)
  - **Deferred, consider later:**
    - bundling the server so the image doesn't need tsx and `src/` (the game packages export raw TS)
    - deploying by `sha-` tag or digest instead of `:main`
    - a NetworkPolicy
    - Dependabot for the action pins
    - failing closed when `CORS_ORIGIN` is unset in production

## Phase 4: Prove it (broad coverage; targeted regressions ship with each fix)

- [ ] **4.1 Socket fuzz test**: run the real Socket.io server and send random or malformed payloads to every client-to-server event. After each payload:
  - the process stays up
  - room state is unchanged
  - a valid request still succeeds
  - error responses use only the stable codes
- [ ] **4.2 Seeded random playthroughs per engine**: play many games using only legal moves, with a seeded RNG so failures can be reproduced. Pass means:
  - nothing throws
  - invariants hold (card count is conserved, turn order is valid)
  - no recipient **receives over the socket** anything hidden from them
  - Start from `docs/audit-repros/security/leakcheck.ts`.
- [ ] **4.3 Lifecycle race suite**: randomized interleavings of reset, restart, switch, leave, grace expiry and reconnect against in-flight bot turns, on a virtual clock. Start from `docs/audit-repros/lifecycle/`.

---

## Log

| Date | Item | Notes / commit |
|---|---|---|
| 2026-11-25 | Plan written | — |
| 2026-11-25 | Phase 0 complete (0.1–0.4) | branch `paul-schwendenman/core-hardening-phase-0`, uncommitted |
| 2026-11-25 | Phase 1 audit complete (A–E) | `docs/CORE-AUDIT.md`, 32 findings |
| 2026-11-25 | Plan revised after the audit and an external review | Phase 3 restructured (3.0–3.10, 3.1 split into a/b, 3.6 dropped); log-and-exit safety net; game-instance lifetime; regression tests required in every fix PR; 0.5 added; repros copied to `docs/audit-repros/` |
| 2026-11-25 | Phase 2 triage: all 32 findings `now` | proposed buckets and order accepted |
| 2026-11-25 | 3.0 hotfix (F-01) | branch `paul-schwendenman/core-hardening-3.0`, uncommitted |
| 2026-11-25 | Plan revised after a second external review | 3.1a now requires validators for every action, handlers can't reject by returning silently, Booty Dice F-06 moved to 3.1a; 3.8 restart gets its own transition (check first, keep the game on failure); 3.7 validates the new seat before releasing the old one |
| 2026-11-25 | 3.1a core action boundary + validators (F-15, F-05, F-04, F-03, F-17, F-22, F-06) | branch `paul-schwendenman/core-hardening-3.1a`, commits `5fbd189`..`66003c8`; 532 tests |
| 2026-11-25 | 0.5 type-aware lint everywhere + 3.10 infra half | built in a worktree (`paul-schwendenman/core-hardening-0.5-infra`), merged onto the committed 3.1a branch in `e0371d8` |
| 2026-11-26 | 3.7 seat lifecycle + 3.8 lobby guards | 549 Vitest tests and 7 Playwright tests passed |
| 2026-11-26 | 3.2 game-instance lifetime and scheduling | Covered by regressions for in-flight bot work, bot deadlines, restart, room destruction, scheduler failures, and reconnect grace |
| 2026-11-26 | 3.3 boundary limits | Added socket, room, name and log limits with regression tests |
