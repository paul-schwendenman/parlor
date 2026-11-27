# Core Audit: Findings

Phase 1 of `docs/CORE-HARDENING-PLAN.md`. Audited 2026-11-25 on branch `paul-schwendenman/core-hardening-phase-0`, using five parallel read-only reviews (A–E).

Most findings were confirmed with throwaway scripts that drove the real `RoomManager`, `setupLobbyHandlers` and game definitions, some on a live socket.io server. Each source finding marks whether it was confirmed or read from code.

- **Raw findings:** 69 (A 15, B 11, C 16, D 11, E 16)
- **After deduplication:** 32 canonical findings: 2 critical, 13 high, 6 medium, 11 low.
- **Good news:**
  - No player or spectator view leaks hidden information in any game (fuzzed 400 card games and 300 Liar's Dice games).
  - Views go only to the owning player's socket room.
  - There are no XSS sinks.
  - None of the 45 floating promises can crash the server today.
  - Standalone game servers share the core handlers, so they got the reconnect fixes.

## How to use this doc

- The **Index** is the triage list. Each canonical finding (`F-xx`) links to the source findings (`A-01`, etc.) in the appendices, which have the full location, repro and suggested fix.
- **Triage** column values: `now` / `later` / `wontfix` (filled in during Phase 2).
- **Bucket** is the proposed Phase 3 work item (see "Proposed fix buckets" below).

## Index

### Critical

| ID | Finding | Sources | Bucket | Triage |
|---|---|---|---|---|
| F-01 | Any client can crash the whole process with one packet. A non-function ack (`emit('lobby:ready', true, 1)`) makes `callback?.()` throw; the `catch` calls it again and the process exits. Affects `lobby:ready`, `lobby:startGame` and `lobby:selectGame`. | A-01, B-01 | 3.0 | now |
| F-02 | One socket can hold unlimited "ghost" seats and rooms.<br>• Create, join, spectate and reconnect never release the previous seat. `socketToPlayer` is overwritten, so only the newest seat gets a grace timer and the rest stay `connected: true` forever.<br>• Ghost seats can fill lobbies so they can't start, or freeze games.<br>• There's no total room cap (about 1.76 KB per room).<br>• `createRoom` loops forever once all 32⁴ codes are used. | A-02, A-03, E-01, E-02, E-06, D-05 | 3.7 | now |

### High

| ID | Finding | Sources | Bucket | Triage |
|---|---|---|---|---|
| F-03 | No process safety net.<br>• socket.io runs listeners in `nextTick` with no try/catch, and nothing installs `uncaughtException` / `unhandledRejection` handlers.<br>• Timer and bot callbacks run engine code unwrapped.<br>• The `game:action` router has no boundary, which is harmless today only because each game catches its own errors.<br>Any future throw anywhere takes down every room. | B-02, B-05, B-06 | 3.1a, 3.2, 3.4 | now |
| F-04 | Client-supplied objects are stored in engine state.<br>• Card objects are pushed onto piles as sent, extra fields included.<br>• Booty Dice target ids aren't checked.<br>• A ~20 KB nested payload makes every later `game:state` emit fail with a stack overflow, so the room freezes and reconnects fail. | B-03, A-05, A-10 | 3.1a, 3.1b | now |
| F-05 | Game actions are unvalidated casts in every game, and some rules can be bypassed by type confusion:<br>• Quixx: a string or array `cellIndex` skips the lock and 5-marks rule.<br>• Liar's Dice: accepts non-integer and unbounded bids.<br>• Actions are untyped from client to server. | A-07, A-08, A-09, E-15 | 3.1a (validators), 3.1b (types) | now |
| F-06 | Booty Dice: `endTurn` doesn't check that you rolled, so it scores whatever dice are on the table (a free 6 doubloons on the first turn). The first player can win in 2 turns. | A-06 | 3.1a | now |
| F-07 | Timers and bot loops outlive reset, restart and game switches.<br>• They hold the old engine and keep broadcasting its stale `game:state`, which pulls the lobby back into the dead game.<br>• Quixx: an old untracked timer cancels the new engine's bot timer, so the restarted game is stuck.<br>• AI 30s timeouts are never cleared, and a timeout doesn't cancel the loop, so turns overlap. | C-01, C-02, C-13, B-07 | 3.2 | now |
| F-08 | Removed or disconnected seats are never skipped, so a game stalls permanently when the turn reaches them.<br>• No game implements `onPlayerRemoved`, and `room:leave` doesn't call it.<br>• Kings Corner indexes the room's player list with the engine's turn index, so bots stop after any mid-game removal. | C-04, C-05, E-10 | 3.9 (+ contract in 3.1b) | now |
| F-09 | Quixx with auto-roll: nobody rolls when a bot follows a bot. Host plus 2 bots stalls in round 1 in ordinary play. | C-03, B-04 | 3.9 | now |
| F-10 | A superseded socket's late `disconnect` evicts a player who already reconnected, 60s later, and can move the host (for example, on a mobile network switch).<br>• One seat can have several live sockets; a second socket with the host's token received the host's private dice.<br>• Tokens never rotate. | C-07, E-04, D-04 | 3.7 | now |
| F-11 | Starting a game has no server-side guards.<br>• No status check, so a double-click creates two live engines.<br>• It can start with no game selected; the room gets stuck in `playing`.<br>• `minPlayers` and `supportsBots` are checked only in the browser.<br>• Adding and removing bots isn't gated by status.<br>• `selectGame` lowers `maxPlayers` below the current occupancy. | C-06, C-11, A-13, A-14, E-07, E-08 | 3.8 | now |
| F-12 | The client treats any mid-game `lobby:state` as "game reset", so one player's disconnect or reconnect kicks everyone out of the game. (Read from code; not reproduced in a browser.) | C-08 | 3.8 | now |
| F-13 | No resource limits.<br>• Names can be about 1 MB with no charset rules, and are re-broadcast and copied into game logs.<br>• Game logs are unbounded and re-sent in full on every view.<br>• The message cap is the 1 MB default.<br>• No rate limit.<br>• No per-IP or total connection caps. | A-04, A-11, E-03, E-05, E-09, D-10 | 3.3 | now |
| F-14 | Room codes can be enumerated: 4 characters, no rate limit. One websocket checked 20k codes in about 300 ms, so the whole space takes about 15 s. `lobby:spectate` then lets anyone silently watch, or join any lobby between games. There's no host kick. | D-01, A-11 | 3.3 | now |
| F-15 | Spectators and non-active players can trigger turn and phase transitions. For example, anyone can send Liar's Dice `nextRound` to cut the reveal short. The router accepts actions from spectator sockets. | A-12, D-02 | 3.1a | now |

### Medium

| ID | Finding | Sources | Bucket | Triage |
|---|---|---|---|---|
| F-16 | Room destruction never reaches the game layer. `cleanupRoomTimers` is never called on delete. There's no room lifetime or idle TTL, and ghost games continue after destruction. | C-09, E-12 | 3.2 | now |
| F-17 | Partial state on throw. Start and restart leave the room half-updated if a game callback throws; engines mutate before validating, and multi-step mutations aren't atomic. | B-08, B-09 | 3.1a | now |
| F-18 | `lobby:restartGame` seats players who are in their grace window, and the new engine thinks they're connected. | C-10 | 3.7 | now |
| F-19 | Room codes, shuffles and dice all use the process-wide `Math.random`, which isn't cryptographically secure. In theory its state could be reconstructed from visible rolls. (Exploit not attempted.) | D-03 | 3.10 | now |
| F-20 | Per-game plumbing is duplicated about 5×: `broadcastViews`, timer maps, bot loops, action switch/catch, standalone scaffolding. The copies have already diverged into latent bugs, and the standalone room cap differs. | E-11, E-14 | 3.1b, 3.2 | now |
| F-21 | Essentially no observability: `/healthz` reports only uptime, the core does no logging, and there are no room or socket counts. | E-16 | 3.4 | now |

### Low

| ID | Finding | Sources | Bucket | Triage |
|---|---|---|---|---|
| F-22 | Raw exception messages (`err.message`) are returned to clients. | B-11, D-07 | 3.1a | now |
| F-23 | CORS is `'*'` in production because k8s never sets `CORS_ORIGIN`, and WebSocket connections are never origin-checked. | D-06 | 3.10 | now |
| F-24 | The container runs as root and ships the source plus the tsx runtime; the k8s pod has no `securityContext`. | D-08 | 3.10 | now |
| F-25 | Workflows lack top-level `permissions`, and actions aren't SHA-pinned. | D-09 | 3.10 | now |
| F-26 | Bot names can be impersonated, name uniqueness is weak, and bot caps are inconsistent. | A-15, E-13 | 3.3 | now |
| F-27 | `status: 'finished'` is never set, so a finished game keeps the room in `playing`. | C-12 | 3.8 | now |
| F-28 | Spectator lifecycle gaps across resets and removals. | C-14 | 3.7 | now |
| F-29 | A host in their grace window blocks host-only lifecycle actions for up to 60s. | C-15 | 3.7 | now |
| F-30 | The Liar's Dice bot is handed every player's dice. It doesn't use them today, but nothing prevents it. | D-11 | 3.9 | now |
| F-31 | Dead and latent timer code; the 45 floating promises are browser-side or can't reject today (hygiene). | C-16, B-10 | 3.2 | now |
| F-32 | Unused protocol surface.<br>• Never used: `room:*`, `chat:*`, `game:start`, `Room`, `RoomStatus`, `ChatMessage`.<br>• `BaseGameState` only exists to force `as never` casts.<br>• `room:leave` and `lobby:spectate` are handled on the server, but no UI sends them.<br>• `lobby:playerJoined` / `lobby:playerLeft` are sent but never listened to.<br>• `createGameServer` is exported but unused.<br>Cast inventory: 5 `as unknown as`, 35 `as never`, 5 `as any`, plus the unchecked `getGameData<T>`. | E tables, E-15 | 3.5 | now |

## Fix buckets

These are now maintained in `docs/CORE-HARDENING-PLAN.md`, Phase 3 (revised 2026-11-25 after an external review of the plan).

The main changes from the first draft of this section:
- **Safety net:** expected failures are caught at the boundaries. Anything uncaught is logged and the process **exits** under the supervisor, rather than continuing.
- **3.1 is split:** **3.1a**, the core action boundary (ships early), and **3.1b**, the typed contract with a `{ gameId, view }` wire envelope, piloted on one game first.
- **3.2 covers running work:** it uses a **game-instance lifetime**, so async work already in progress is invalidated too, not just pending timers. Reconnect timers keep their own room/player lifetime.
- **3.6 is dropped:** no view leaks were found.

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

The scripts used to reproduce these findings are in `docs/audit-repros/` (see its README). Each fix PR turns the relevant one into a regression test.

---

# Appendices: full source reports

The reviewers' reports, unchanged. Locations are repo-relative `file:line` as of 2026-11-25.


## A. Input boundary

Verified against socket.io 4.8.3, socket.io-parser 4.2.5, engine.io 6.6.5 (all current). Two findings were confirmed with throwaway PoC scripts in `scratchpad/poc/` (`crash.mjs`, `leak.mjs`) that run against the built `packages/multiplayer/dist`. Nothing in the repo was modified.

### A-01 A non-function ack argument crashes the whole server process
- **Severity:** critical
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:178,182,189,191 (`lobby:ready`); packages/multiplayer/src/lobbyHandlers.ts:267,271,277,283,285 (`lobby:startGame`); apps/parlor/src/lib/server/socketServer.ts:85,89,95,103,108,115,122,124 (`lobby:selectGame`)
- **Issue:** These three handlers call `callback?.(...)`. Optional chaining only skips `null`/`undefined`, so any other value (a number, `true`, a string, an object) throws `TypeError: callback is not a function`. The `catch` block then calls `callback?.(...)` again, which throws a second time, from inside the catch. Socket.io does not wrap listeners, so the exception reaches the top level. There is no `uncaughtException` handler, so the process exits and every room on the server is lost. The socket does not need to be in a room: the first `callback?.(false, 'Not in a room')` already throws.
- **Repro:** Any connected client sends `socket.emit('lobby:ready', true, 1)`, `socket.emit('lobby:startGame', 1)` or `socket.emit('lobby:selectGame', null, 1)`. The process exits with code 1. Confirmed with `poc/crash.mjs` for `lobby:ready` and `lobby:startGame` (stack: `lobbyHandlers.js:133 callback?.(false, ...) TypeError: callback is not a function`).
- **Suggested fix (core):** Normalise the ack once at the top of each handler: `const ack = typeof callback === 'function' ? callback : () => {}`. A better option is a generic `on(event, schema, handler)` wrapper in core that validates the args, normalises the ack and wraps the handler in try/catch. Never call the ack from inside `catch` without that guard. Add the process-level handlers (audit area B) as a backstop.

### A-02 Unlimited room creation; rooms from earlier creates are never cleaned up; `createRoom` spins forever once room codes run out
- **Severity:** critical
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:78-103; packages/multiplayer/src/RoomManager.ts:72-105 (esp. 73-76, 103); packages/multiplayer/src/utils.ts:3 (4 characters from a 32-character alphabet = 1,048,576 codes)
- **Issue:** `lobby:create` does not check whether the socket already has a seat, and there is no cap or rate limit. Each call overwrites `socketToPlayer[socket.id]`, so only the most recent seat is tied to the socket. Hosts of earlier rooms stay `connected: true` forever: disconnect never finds them, the grace timer never starts, and `destroyRoom` never runs. These rooms are leaked permanently. Once the code space fills up, `while (this.rooms.has(code))` never exits and the event loop hangs. Memory will probably run out before that point.
- **Repro:** One socket sends `lobby:create('x'+i, ack)` 2000 times, then disconnects. `poc/leak.mjs` created all 2000 rooms in about 80 ms, and 2000 rooms were still there after the disconnect and grace window. A loop of roughly 1M creates (about a minute at that rate, from one socket) either exhausts the heap or hangs `createRoom`.
- **Suggested fix (core):** Reject `lobby:create`/`lobby:join`/`lobby:spectate` while the socket already holds a seat (or leave the old seat first; see A-03). Add a global room cap and a per-IP/per-socket creation rate limit. Give `generateRoomCode` a bounded number of retries that then fails, or use longer codes. Add idle-room cleanup by `createdAt`/last activity (area E).

### A-03 One socket can hold unlimited "ghost" seats that never disconnect (join/create/spectate/reconnect don't leave the previous seat)
- **Severity:** high
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:105-146, 148-171, 354-379; packages/multiplayer/src/RoomManager.ts:107-133 (131), 236-243 (241), 374-395, 434-454 (452)
- **Issue:** `joinRoom`, `createRoom`, `handleReconnect` and `addSpectator` all overwrite the socket's single mapping (`socketToPlayer` or `spectatorToRoom`) without releasing the previous one. `socket.data` is overwritten the same way. Consequences:
  1. **Lobby lock-out:** the same socket can join the same room repeatedly under different names (only names are de-duplicated). Every seat except the last stays `connected: true, isReady: false` forever. There's no kick, so `canStartGame` stays false permanently and `Room is full` locks everyone else out. Anyone who knows the code can grief any lobby.
  2. **Stalled games:** a player who joins or spectates another room mid-game leaves a seat that the engine thinks is still connected. `onPlayerDisconnect` auto-actions (turn skip, auto-challenge, auto-pass) never fire, so turn-based games without timers hang on that seat forever.
  3. **Player becomes a spectator:** `handleDisconnect` checks `spectatorToRoom` first (RoomManager.ts:379). A player who also spectates is therefore treated as a spectator on disconnect, and their real seat is never greyed out or expired.
  4. **Stale spectator entries:** `room.spectators` of earlier spectated rooms keeps the socket id forever (memory leak), and the socket stays `join`ed to each socket.io room, so it keeps receiving every room's broadcasts.
  5. **Two live sockets on one seat:** `player:reconnect` onto a seat that is still live elsewhere binds a second socket to it. When the old socket later disconnects, it marks the player disconnected and starts the 60 s removal while the new socket is active (crosses into area C).
- **Repro:** `for i in 0..6: emit('lobby:join', CODE, 'g'+i, ack)` from one socket, then disconnect. `poc/leak.mjs` result: `g0..g5 (connected)` remain permanently in the victim room, and the host can never start.
- **Suggested fix (core):** Treat the socket as owning at most one membership. On create/join/spectate/reconnect, call the leave path for any existing `socket.data.roomCode` (and `socket.leave` the socket.io rooms) first, or reject with "already in a room". Also map `playerId → socketId` so a reconnect can detach and disconnect the previous socket.

### A-04 No length/content limits on player names or room codes, and names are amplified through broadcasts and game logs
- **Severity:** high
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:31-33, 81, 108; packages/multiplayer/src/RoomManager.ts:113-128; games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts:91,123,146,189-191,423-430 (full `gameLog` sent on every view); games/booty-dice/src/lib/server/game/GameEngine.ts:46-47,60-67 (state including the full `gameLog` is spread into every view); games/booty-dice/src/lib/server/definition.ts:28-36 (one full broadcast per new log entry)
- **Issue:** `isNonEmptyString` is the only check, so a name can be about 1 MB (the `maxHttpBufferSize` default). The name goes to every room member in every `lobby:state` (sent on each ready toggle, join or reconnect). In Liar's Dice and Booty Dice it is also copied into game log messages, and the full, unbounded log is re-sent to every player and spectator on every broadcast. Booty Dice also broadcasts the whole view once per new log entry, which multiplies the traffic again. Names also allow control and bidi/zero-width characters, and case-only/space variants of existing names (`'Bob'` vs `'Bob​'`).
- **Repro:** Create or join with a 900 KB name (`poc/leak.mjs` confirms it's accepted), then spam `lobby:ready(true)`/`(false)`. Each toggle sends about 900 KB × room size. In Liar's Dice, each bid adds another log line containing the name, so each later broadcast grows by about 1 MB × players. After a few dozen bids, every action serialises tens to hundreds of MB, which blocks the event loop and drives up memory for all rooms. Past about 512 MB, `JSON.stringify` throws `RangeError`, including inside bot timers that aren't fully guarded (area B).
- **Suggested fix (core):** Validate names centrally: trim, NFC-normalise, strip control/format characters (`\p{C}`), require 1–24 characters, and check uniqueness on the normalised form. Validate room codes against `/^[A-Z2-9]{4}$/i` before lookup. Per game: cap the log size (ring buffer) and send log deltas instead of the full log. Fix Booty Dice's per-entry re-broadcast.

### A-05 Card objects from the client are stored as-is (extra fields included) and then broadcast to everyone
- **Severity:** high
- **Location:** games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts:117-128 (`this.discardPile.push(card)`); games/kings-corner/src/lib/server/game/KingsCornerEngine.ts:122-134 (`pile.push(card)`); definitions at games/crazy-eights/src/lib/server/definition.ts:124,129 and games/kings-corner/src/lib/server/definition.ts:213,224
- **Issue:** The engines confirm the card is in hand with `cardEquals` (suit + rank only), but then push the **client's object** onto the pile instead of the server's own card from `hand[cardIndex]`. Any extra properties ride along permanently. In Crazy Eights the card can be reshuffled into the draw pile and dealt into other players' hands. In Kings Corner the client object is also passed to `canPlayCardOnPile`.
- **Repro:** On your turn, holding the 5♥, send `{type:'play-card', card:{suit:'hearts', rank:'5', pad:'x'.repeat(900000)}, target:'north'}`. Kings Corner includes every pile in every view, so each later broadcast to each player and spectator carries the 900 KB, and another 900 KB is added on each play. Combined with A-04, this degrades the whole server. It can also add arbitrary fields such as `faceUp` or `id` that the client UI may trust.
- **Suggested fix:** Per game, push `player.hand.splice(cardIndex, 1)[0]`, never the payload. In core, validate the action schema strictly (A-07) so unknown keys and over-long values are rejected before they reach the engine.

### A-06 Booty Dice: `endTurn` without rolling scores the previous dice (the opening dice are a free 6 doubloons)
- **Severity:** high
- **Location:** games/booty-dice/src/lib/server/definition.ts:313-325 (checks only `phase === 'playing'`, not `turnPhase` or rolls used); games/booty-dice/src/lib/server/game/GameEngine.ts:163-171, 242-269 (dice "kept visible" across turns), 83-88 (`lockDice` allowed before the first roll); games/booty-dice/src/lib/server/game/DiceRoller.ts:6-13 (fresh dice are all `'doubloon'`)
- **Issue:** `endTurn` calls `resolveTurn()` on whatever `state.dice` holds. At the start of the game that is 6 doubloons. On later turns it is the previous player's dice. A player can skip rolling entirely and keep a good roll. Locking all six dice before the first roll and then rolling has the same effect, so a "must roll once" check alone won't fix it.
- **Repro:** The first player sends `{type:'endTurn'}` immediately: 5 + 12 = 17 doubloons. The next player does the same if the dice are still good. The first player's second free `endTurn` reaches 29 ≥ 25 and wins. Alternative: `{type:'lockDice', diceIndices:[0,1,2,3,4,5]}` → `{type:'roll'}` → `finishRolling` → `endTurn`.
- **Suggested fix (per game):** Require `rollsRemaining < 3` (at least one real roll) and `turnPhase ∈ {resolving, selecting_targets with all resolved}` before `endTurn`. Reject `lockDice` while `rollsRemaining === 3`. Reset dice to a neutral or unrolled state at turn start instead of carrying faces over (the UI can show the previous roll from a separate field).

### A-07 `game:action` reaches every engine as an unchecked cast; there is no validation in core and none per game (except Booty Dice dice indices)
- **Severity:** high
- **Location:** apps/parlor/src/lib/server/socketServer.ts:129-140; packages/multiplayer/src/gameDefinition.ts:18-23; games/crazy-eights/src/lib/server/definition.ts:124; games/kings-corner/src/lib/server/definition.ts:213; games/liars-dice/src/lib/server/definition.ts:245; games/quixx/src/lib/server/definition.ts:284; games/booty-dice/src/lib/server/definition.ts:263; the standalone routers games/*/src/lib/server/socket/socketServer.ts:19-22
- **Issue:** Every game casts `rawAction as unknown as XAction` and reads `.card`, `.target`, `.from`, `.to`, `.row`, `.cellIndex`, `.dieIndex`, `.targetPlayerId`, `.quantity` and `.faceValue` without checking them. Only Booty Dice `lockDice` (validation.ts) and the Liar's Dice `typeof number` check exist. Type confusion mostly ends in a caught `TypeError` (e.g. KC `target:'nope'` → `getPile` returns `undefined` → `pile.cards.length` throws, and the error is caught). That is safe only by accident, and the raw engine `TypeError` text is sent back to the client. The concrete exploits this enables are A-05, A-06, A-08, A-09 and A-10. No `obj[clientKey] = …` write was found that reaches `Object.prototype`. The only client-keyed write is Quixx `sheet[row][cellIndex] = true`, which is reached only when `ROW_NUMBERS[row][cellIndex]` equals the dice sum; I checked `__proto__`/`constructor`/`__defineGetter__`.`length` and they can't satisfy `canMark`.
- **Repro:** `emit('game:action', {type:'move-pile', from:{}, to:[]})`, or `{type:'play-card', card:null}`, or `{type:'selectTarget', dieIndex:'0', targetPlayerId:{a:1}}`. Each gets an engine-internal error string back or stores junk in state.
- **Suggested fix (core):** Make it `ServerGameDefinition<State, Action, View>` with a required `actionSchema` (zod/valibot, `.strict()`, enums for suits, ranks, piles and rows, `int().min().max()` for indices, `max()` on strings and arrays). Core parses before dispatch, rejects anything unknown, and returns a generic error ack (plan item 3.1).

### A-08 Quixx: a string or array `cellIndex` bypasses the "5 marks before the last cell" rule and the row lock
- **Severity:** medium
- **Location:** games/quixx/src/lib/game/validation.ts:4-6, 21, 29; games/quixx/src/lib/server/game/QuixxEngine.ts (submitPhase1 ~L124-132, resolvePhase1 ~L151-158)
- **Issue:** `numberAtCell(row, "10")` returns `ROW_NUMBERS.red["10"]`, which is 12, so it passes. `canMark` uses `<`/`>=` (string coercion, still passes) but `cellIndex === 10` (strict, fails), so the 5-mark requirement is skipped. `resolvePhase1` writes `sheet.red["10"] = true`, and its own `=== 10` check fails too, so the row isn't locked and the lock bonus and end-of-game check don't fire. `[10]` (an array) behaves the same way. Phase 2 is safe only because it compares against generated moves with `===`.
- **Repro:** In phase 1 with white dice 6+6, send `{type:'phase1-mark', row:'red', cellIndex:'10'}` with fewer than 5 red marks. The cell is marked against the rules and the row isn't locked. The state then holds a string-keyed mark.
- **Suggested fix:** Per game, `Number.isInteger(cellIndex) && 0<=cellIndex<=10` and `ROW_COLORS.includes(row)` (or a schema, A-07).

### A-09 Liar's Dice accepts non-integer and unbounded bids
- **Severity:** medium
- **Location:** games/liars-dice/src/lib/server/definition.ts:249-257; games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts:134-135, 327-348, 350-358
- **Issue:** Only `typeof === 'number'` is checked. JSON can't carry NaN or Infinity, but it can carry `2.5`, `1e308` and `1.5`. A fractional quantity lets a player raise by an epsilon (`3.0001×6` beats `3×6`). A fractional face such as `1.5` passes the 1–6 range check, matches no die, and gets counted through the wild-ones branch (`die===1 && faceValue!==1`), so it's an off-rules way to bid on ones. A huge quantity breaks the client's minimum-bid UI.
- **Repro:** `{type:'bid', quantity:3.0001, faceValue:6}` or `{type:'bid', quantity:2, faceValue:1.5}` on your turn. Both are accepted, logged and broadcast.
- **Suggested fix:** Per game (or via the schema): `Number.isInteger` for both, `1<=faceValue<=6`, `1<=quantity<=totalDiceInPlay`.

### A-10 Booty Dice `selectTarget` accepts any `targetPlayerId`/`dieIndex` value
- **Severity:** low
- **Location:** games/booty-dice/src/lib/server/definition.ts:303-311; games/booty-dice/src/lib/server/game/GameEngine.ts:136-147; games/booty-dice/src/lib/server/game/ActionResolver.ts:126-158
- **Issue:** The target isn't checked to be a living opponent. Self, eliminated players, nonexistent ids, or any JSON value (object, 900 KB string) are stored in `pendingActions` and broadcast to the room. Self or eliminated targets quietly waste the die. Large values add to the amplification in A-04/A-05.
- **Repro:** `{type:'selectTarget', dieIndex:0, targetPlayerId:'x'.repeat(900000)}` is accepted and re-broadcast until the turn ends.
- **Suggested fix (per game):** Require `targetPlayerId` to be a non-eliminated player other than the current player, and `dieIndex` to be an integer that matches a pending action.

### A-11 No rate limiting and the default 1 MB message size; room codes can be brute-forced through `lobby:spectate`
- **Severity:** high
- **Location:** packages/multiplayer/src/server.ts:53-65 (no `maxHttpBufferSize`, no `io.use` or per-packet middleware); apps/parlor/server/index.ts:11; games/*/server/index.ts (same `buildSocketServerOptions()`); apps/parlor/vite.config.ts:16; packages/multiplayer/src/lobbyHandlers.ts:148-171
- **Issue:** Every inbound event costs O(players) work and an O(players × state) broadcast. Examples: `lobby:ready` toggles, `lobby:create`, valid `game:action`s, and Booty Dice's per-log-entry re-broadcast. Nothing throttles them. Each frame can be up to 1 MB. `lobby:spectate` gives a free yes/no answer on whether a code exists, with no room membership or rate limit. The code space is about 1M (A-02), so a scanner can find every live room in minutes and then join or spectate it, or grief it with A-03.
- **Repro:** (a) A loop of `emit('lobby:ready', true/false)` with the 8 × 900 KB names from A-04 produces about 7 MB of egress per toggle. (b) `for code of allCodes: emit('lobby:spectate', code, ack)` returns `true` for every live room.
- **Suggested fix (core):** Set `maxHttpBufferSize` to about 16 KB. Add a per-socket token bucket (e.g. `socket.use((packet, next) => ...)`) and a per-IP connection cap. Rate-limit create/join/spectate failures separately and more tightly. Consider 5–6 character codes (area D).

### A-12 Spectators and non-active players can trigger turn and phase transitions
- **Severity:** medium
- **Location:** games/liars-dice/src/lib/server/definition.ts:272-277 (`nextRound` checks neither membership nor turn); games/quixx/src/lib/server/definition.ts:318-321 (`clearRoomTimer` runs **before** `submitPhase2` checks the active player); all `handleGameAction`s rely only on `socket.data.roomCode`, which `lobby:spectate` sets (lobbyHandlers.ts:164)
- **Issue:** Core never tells a game whether the sender is a seated player or a spectator. Each engine is left to reject unknown ids, and the two paths above don't. In Liar's Dice, any spectator or player can call `startNextRound` during the reveal, which cuts the reveal short. The server's own 3 s `setTimeout(startNextRound)` then fires during a later round's challenge phase and skips that round's reveal too. In Quixx, any spectator or non-active player can send `phase2-pass` (or a phase-2 action during phase 1) to cancel the room's phase 1 or turn timer, which lets an AFK player stall the table forever. This is latent only because `DEFAULT_CONFIG` timers are `null` today.
- **Repro:** Spectate a Liar's Dice room and send `{type:'nextRound'}` the moment a challenge is revealed. In Quixx with `phase1Timer` set, a spectator sends `{type:'phase2-pass'}`: the phase 1 timer is cleared and the error is ignored.
- **Suggested fix (core):** Core resolves `{playerId, role:'player'|'spectator'}` and drops `game:action` from spectators or non-members before dispatch. Per game, `nextRound` should be server-driven only (or limited to seated players and the right phase), and Quixx should validate before touching timers.

### A-13 `lobby:startGame` (and `lobby:ready`) skip the room-status check; starting with no game selected leaves the room stuck
- **Severity:** medium
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:173-193, 263-287; packages/multiplayer/src/RoomManager.ts:183-197; apps/parlor/src/lib/server/socketServer.ts:41-46
- **Issue:** `startGame` only checks `canStartGame` (≥2 players and all ready), not `status === 'waiting'`. Players are still ready mid-game, so the host can re-send `lobby:startGame` during play. That builds a new engine without calling `onGameReset`, so the old Quixx `roomTimers`/`botTimers` and the old bot loops keep running against the replaced engine (area C). In the parlor app, starting with `gameId === null` sets the room to `playing` with no engine. `selectGame` then refuses ("after it has started") and joins are blocked until the host resets. `lobby:ready` is also accepted mid-game.
- **Repro:** As host, during a Quixx game with bots, `emit('lobby:startGame')` → a second engine is created while the first engine's bot timers still fire. In parlor, with no game selected and two ready players, `emit('lobby:startGame')` → the room is stuck in `playing`.
- **Suggested fix (core):** Require `status === 'waiting'` in `startGame`/`setPlayerReady`. In parlor, require `gameId` (and `minPlayers`/`maxPlayers` from the meta) before starting.

### A-14 Bot add/remove isn't gated by game status or `supportsBots`
- **Severity:** medium
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:197-261; packages/multiplayer/src/RoomManager.ts:135-163 (`removeBot` has no status check); games/crazy-eights/src/lib/server/definition.ts:54-63 (no `supportsBots`, no bot driver); games/kings-corner/src/lib/server/definition.ts:50-53 (uses the RoomManager index for engine seats)
- **Issue:** The host can add bots to Crazy Eights, which has no AI, so the game hangs forever on the bot's first turn. `removeBot` works mid-game: the engine keeps the seat while `room.players` shrinks. Kings Corner's `scheduleAITurnIfNeeded` indexes `roomManager.getPlayersInRoom()[engine.activeIndex]`, so seats then misalign: AI turns are skipped (stall) or run for the wrong id.
- **Repro:** In parlor, select Crazy Eights → `lobby:addBot` → start. The game freezes when the bot is the active player. In Kings Corner with `[H1, bot, H2]` mid-game, `lobby:removeBot('bot-N')` freezes the game on the bot's turn.
- **Suggested fix:** In core, reject `addBot` when the selected game's `meta.supportsBots` is false, and reject `removeBot` unless `status === 'waiting'`. Per game, map seats by id, not by RoomManager index.

### A-15 Bot names can be impersonated, and name uniqueness is weak
- **Severity:** low
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:195-214; packages/multiplayer/src/RoomManager.ts:113-116, 135-150
- **Issue:** A human can join as `"Bot Alice"`, and `addBot` doesn't check names, so it can add a second `"Bot Alice"`. Uniqueness is case-insensitive only: `'Bob '` is trimmed, but `'Bob​'` and `'Ｂob'` count as distinct from `'Bob'`. Bot *ids* can't be taken over (`player:reconnect` needs a token, and bots have none), so this is cosmetic or social only.
- **Repro:** `lobby:join(CODE, 'Bot Alice')`, then the host adds a bot. Two identical "Bot Alice" seats appear, and the human one may be mistaken for a bot.
- **Suggested fix (core):** Reserve the `Bot ` prefix. Generate bot names that avoid names already taken. Normalise before comparing (see A-04).

---

### Coverage
Handlers reviewed (payload validation, ack type, authorization, engine trust):
- `packages/multiplayer/src/lobbyHandlers.ts`: `lobby:create`, `lobby:join`, `lobby:spectate`, `lobby:ready`, `lobby:addBot`, `lobby:removeBot`, `lobby:startGame`, `lobby:resetGame`, `lobby:restartGame`, `room:leave`, `player:reconnect`, `disconnect`, plus the `socket.recovered` rebind on connect
- `packages/multiplayer/src/server.ts`: `createGameServer` connection handler and `buildSocketServerOptions` (CORS, buffer size, recovery)
- `apps/parlor/src/lib/server/socketServer.ts`: `lobby:selectGame`, `game:action` router; `gameRegistry.ts` (Map lookup, so `__proto__` is safe); `apps/parlor/server/index.ts`; `apps/parlor/vite.config.ts`
- `handleGameAction` for each game:
  - crazy-eights: `play-card`, `draw-card`, `pass`, `choose-suit` (suit checked against `SUITS`)
  - kings-corner: `draw-card`, `play-card`, `move-pile`, `end-turn`
  - liars-dice: `bid`, `challenge`, `spot-on`, `nextRound`
  - quixx: `roll-dice`, `phase1-mark`, `phase1-pass`, `phase2-mark`, `phase2-pass`
  - booty-dice: `roll`, `lockDice` (validated), `finishRolling`, `selectTarget`, `endTurn`
- Standalone routers `games/{booty-dice,crazy-eights,kings-corner,liars-dice,quixx}/src/lib/server/socket/socketServer.ts` (`game:action`, no validation, same lobby handlers) and `games/*/server/index.ts` (same options; no rate limit or buffer cap)
- Declared but unhandled events (`room:create`, `room:join`, `game:start`, `chat:send`) aren't an attack surface today; they are noted for area E.
- Not found: prototype-pollution writes, `eval`, or dynamic `require`. A `null` or non-object `game:action` is handled safely (caught inside each game's try).


## B. Crash isolation

**What I confirmed about socket.io's listener-exception behaviour (socket.io 4.8.3, socket.io-parser 4.2.5, Node v22.14.0, the same major as the `node:22-alpine` Docker image):**
- Inbound events go through `Socket.onevent` → `Socket.dispatch`. `dispatch` (`node_modules/.pnpm/socket.io@4.8.3/node_modules/socket.io/dist/socket.js:689-701`) runs the listeners inside `process.nextTick(() => super.emitUntyped(...))` with no try/catch.
  - A synchronous throw in any `socket.on(...)` listener therefore becomes an `uncaughtException`.
  - With no process handler installed, Node prints the stack and exits with code 1.
  - I confirmed this live against the real `setupParlorSocketHandlers` (see B-01).
- `_onerror` only handles middleware errors. It never sees listener errors.
- An async listener (or any floating promise) that rejects becomes an `unhandledRejection`. Node 22 defaults to `--unhandled-rejections=throw`, which also exits with code 1. Verified: `node -e "Promise.reject(new Error())"` exits 1.
- A throw inside a `setTimeout` callback also kills the process. Verified: exit code 1.
- `Promise.race([...])` subscribes to every input, so the losing timeout promise's later rejection is **handled**. It does not cause an unhandledRejection. Verified.
- The parser refuses reserved event names on inbound packets (`isPayloadValid`, `RESERVED_EVENTS`), so a client cannot fake `disconnect`. `'error'` is not reserved server-side, so `socket.emit('error', …)` does not throw.
- `JSON.parse` of an inbound packet nested 400k levels deep succeeds. Re-encoding that object (`hasBinary` recursion in `is-binary.js`) throws `RangeError: Maximum call stack size exceeded` from about 10k levels, which is roughly a 20 KB packet. This is the basis of B-03.

### B-01 A single packet with a non-function "ack" argument crashes the whole server
- **Severity:** critical
- **Location:**
  - `packages/multiplayer/src/lobbyHandlers.ts:173-193` (`lobby:ready`)
  - `packages/multiplayer/src/lobbyHandlers.ts:263-287` (`lobby:startGame`)
  - `apps/parlor/src/lib/server/socketServer.ts:81-126` (`lobby:selectGame`)
  - The same `lobbyHandlers.ts` code also runs in all 5 standalone game servers (`games/*/src/lib/server/socket/socketServer.ts`) and in the 6 vite dev servers.
- **Issue:**
  - These handlers call `callback?.(...)`. Optional chaining only guards against `null`/`undefined`. If the client sends any other JSON value in the callback position (a number, string, `true`, `{}`, `[]`), the call throws `TypeError: callback is not a function`.
  - The surrounding `try/catch` does not help, because the `catch` block calls `callback?.(...)` again and throws a second time. That second throw escapes the listener into socket.io's `nextTick` (see above), so the process exits.
  - The other handlers are safe: `lobby:create`, `lobby:join`, `lobby:spectate`, `lobby:addBot`, `lobby:removeBot` and `player:reconnect` check `typeof callback !== 'function'` first. `lobby:resetGame`, `lobby:restartGame`, `room:leave` and `disconnect` take no callback.
- **Repro (run live against the real `setupParlorSocketHandlers` on Node 22.14):**
  - Connect and immediately emit `socket.emit('lobby:ready', true, 0)`. No room, host role or token is needed: the very first statement, `callback?.(false, 'Not in a room')`, throws.
  - The server log shows `TypeError: callback is not a function at lobbyHandlers.ts:191`, then the process exits with code 1.
  - Reproduced the same way with `emit('lobby:startGame', 'x')` (crash at lobbyHandlers.ts:285), `emit('lobby:selectGame', 'nope', 1)` (crash at socketServer.ts:124) and `emit('lobby:ready', 'notbool', {})`.
  - Consequence: every room on the instance is lost, because all state is in memory. Anyone who can open a websocket can do this in a loop.
- **Suggested fix (core):**
  - Normalize the ack once at the top of every handler: `const ack = typeof callback === 'function' ? callback : noop`.
  - Better, register every handler through one `safeOn(socket, event, handler)` wrapper that normalizes the ack, wraps the body in try/catch, logs with room and player tags, and never re-throws from its catch.
  - Add a fuzz test that sends every event with non-function trailing args (Phase 4.1).

### B-02 No process-level safety net, and socket.io does not isolate listener errors
- **Severity:** high (it turns every other bug in this section into a whole-process outage)
- **Location:**
  - `apps/parlor/server/index.ts` (whole file)
  - `games/{booty-dice,crazy-eights,kings-corner,liars-dice,quixx}/server/index.ts`
  - `packages/multiplayer/src/server.ts:108-153` (`setupGracefulShutdown` only handles SIGTERM/SIGINT)
  - `grep -rn "uncaughtException\|unhandledRejection"` outside node_modules finds nothing.
- **Issue:**
  - There is no `process.on('uncaughtException')` or `process.on('unhandledRejection')` handler anywhere.
  - Combined with socket.io's unguarded `nextTick` dispatch and Node 22's default `throw` mode for rejections, any synchronous throw outside a local try/catch exits the process. That covers listeners, `setTimeout`/`setImmediate` callbacks and RoomManager grace timers. So does any rejected promise without a `.catch`.
  - The Docker image runs a single `node` process (`CMD ["node","--import","tsx","server/index.ts"]`). A crash drops every room, and rooms are not persisted, so nothing can be restored after a restart.
  - Graceful shutdown itself was checked and works: an in-flight HTTP request finished before exit (drain took about 5s because of keep-alive). It only runs on signals, not on crashes.
- **Repro:** B-01, or any future throw in one of the timer paths listed in B-06 → `exit 1` → all games end.
- **Suggested fix (core, plan 3.4):**
  - Add `installProcessSafetyNet({ logger })` to `@parlor/multiplayer` and call it from every `server/index.ts`. It should log `unhandledRejection` and keep running, and log `uncaughtException` and increment an error counter on `/healthz`.
  - Decide explicitly whether to keep running after an `uncaughtException` (Node's guidance is to exit). If the boundary wrappers from B-01 and B-06 are in place, the process handler becomes a rarely hit last resort, so keeping it alive is a reasonable trade-off for an in-memory game server.

### B-03 Client-supplied nested objects are stored in engine state and break every later broadcast for that room
- **Severity:** high
- **Location:**
  - `games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts:128` (`this.discardPile.push(card)` pushes the *client's* object, not the hand's)
  - `games/kings-corner/src/lib/server/game/KingsCornerEngine.ts:134` (`pile.push(card)`, same problem)
  - `games/booty-dice/src/lib/server/game/GameEngine.ts:140` (`action.targetPlayerId = targetPlayerId`, no validation at all)
  - The broadcast helpers that then throw: `games/*/src/lib/server/definition.ts` `broadcastViews`
- **Issue:**
  - Validation compares only `suit`/`rank` (`cardEquals`). The full client object, with any extra properties, is stored and then sent to every player and spectator in `game:state`.
  - A property nested about 10k levels deep (a ~20 KB packet, well under the 1 MB `maxHttpBufferSize`) makes socket.io-parser's recursive `hasBinary` throw `RangeError: Maximum call stack size exceeded` on every later `emit` of that state.
  - The action handler's try/catch stops this from killing the process. But by then the engine has already mutated, so the move commits, the turn advances, and nobody ever receives state again.
  - Knock-on effects:
    - `onPlayerReconnect` emits the view inside `player:reconnect`'s try, so the throw makes it ack `false` and players cannot reconnect.
    - In kings-corner, `scheduleAITurnIfNeeded` runs after `broadcastViews` in `play-card`/`end-turn` (`definition.ts:225-239`) and in `onPlayerDisconnect`, so it is skipped and bots stop taking turns.
    - Each victim's client gets `socket.emit('error', 'Maximum call stack size exceeded')`, which leaks internals (cross-ref D).
  - If the same kind of poisoned value ever reached a path with no try/catch, the process would crash: Quixx bot and phase timers, RoomManager expiry (B-06). Today Quixx stores only values that pass validation, so this is not exploitable there.
- **Repro (crazy-eights, run live):**
  - Two players start a game. The active player writes a raw frame: `2["game:action",{"type":"play-card","card":{"suit":"clubs","rank":"K","junk":[[[[…20000 levels…]]]]}}]`.
  - Both clients get `error: Maximum call stack size exceeded` and **0** `game:state` packets. Follow-up `draw-card` actions from either player also produce 0 states.
  - The process stays up, but the room is dead until the host resets it.
  - Booty-dice: during `selecting_targets`, send `selectTarget` with `targetPlayerId: <deep array>`. By reading, the room stays unbroadcastable until `endTurn` clears `pendingActions` (unverified live).
- **Suggested fix:**
  - Per-game: store the server's own card (`const [played] = player.hand.splice(idx, 1)`), and check that `targetPlayerId` is the id of an alive opponent.
  - Core (plan 3.1): schema-validate actions and **strip unknown keys** before the handler runs, and lower `maxHttpBufferSize` (3.3).
  - Core: broadcast in a try/catch per recipient so one bad view cannot block the others.

### B-04 Quixx with bots stalls permanently in ordinary play: nobody rolls after a bot's turn
- **Severity:** high (overlaps C)
- **Location:**
  - `games/quixx/src/lib/server/game/botController.ts:157-161`
  - `games/quixx/src/lib/server/game/botController.ts:66-87`
  - `games/quixx/src/lib/server/definition.ts:230-261` (`onPlayerDisconnect`)
- **Issue:**
  - With `DEFAULT_CONFIG.diceRolling === 'auto'`, the bot's phase-2 timer calls `advanceTurn()` and then only `setTimeout(scheduleBotActions, 600)`, on the assumption that "auto-roll handles itself".
  - `autoRollIfNeeded` is only called from the human `phase2-*` handler and from the turn timer. In `rolling` phase, `scheduleBotActions` returns without doing anything when `shouldAutoRoll()` is true.
  - So once a bot finishes its turn and the next active player is also a bot, `rollDice` is never called again.
  - `onPlayerDisconnect` has the same gap. It can `resolvePhase1()` or `advanceTurn()` without calling `scheduleBotActions`, `autoRollIfNeeded` or the phase timers.
- **Repro (run live):** Host plus two bots, quixx. The human always passes or rolls when active. Phase trace: `rolling/0(me) → phase1 → phase2 → rolling/1(bot) → phase1 → phase2 → rolling/2(bot)`, then nothing for the remaining ~10s of a 15s window. The room is stuck forever, and `lobby:resetGame` is the only way out.
- **Suggested fix:**
  - Per-game: one `advance()` function that every caller (human handler, bot timer, disconnect, turn timer) uses. It should run `advanceTurn` → auto-roll if configured → reschedule bots and timers.
  - Core: the room scheduler (3.2) should own this "after state change, re-plan timers" hook.

### B-05 The `game:action` router has no boundary, and the contract allows async handlers whose rejections would crash
- **Severity:** medium (latent today)
- **Location:**
  - `apps/parlor/src/lib/server/socketServer.ts:129-140`
  - `games/*/src/lib/server/socket/socketServer.ts:19-23`
  - `packages/multiplayer/src/gameDefinition.ts:18-23`
- **Issue:**
  - The router calls `definition.handleGameAction(...)` directly. Its safety depends on every game remembering to wrap its own switch body.
  - All five games do this today, and their pre-try code (`socket.data.roomCode`, `getGameData`) cannot throw. Verified live: `game:action null` and `{type:'play-card', card:null}` return `error` and the process survives.
  - The type `=> void` also accepts an `async` implementation. A rejection from one would be unhandled and kill the process (Node 22).
  - Any future game, or a refactor that moves code before the `try`, becomes a B-01-class crash.
- **Repro:** (hypothetical) a sixth game whose handler reads `action.card.suit` outside a try. One `game:action {}` then crashes the server.
- **Suggested fix (core, 3.1):**
  - The router wraps the call in try/catch and also handles a returned promise: `Promise.resolve(ret).catch(...)`.
  - It sends sanitized errors back as an ack.
  - The per-game try/catch blocks can then be removed.

### B-06 Timer callbacks run engine and emit code with no try/catch, so one throw ends the process
- **Severity:** medium (no current input found that triggers it; any engine bug would be fatal)
- **Location:**
  - `packages/multiplayer/src/RoomManager.ts:352-356`, which calls `lobbyHandlers.ts:36-61` `emitExpiry`. That runs `callbacks.onPlayerRemoved` (no game implements it yet) and several `io.to().emit` calls inside a bare timer.
  - `games/quixx/src/lib/server/definition.ts:44-67` (`resolvePhase1`, `broadcastViews`, `startPhase2Timer`, `scheduleBotActions` outside the try)
  - `games/quixx/src/lib/server/definition.ts:83-106` (`advanceTurn`, broadcast and scheduling outside the try)
  - `games/quixx/src/lib/server/definition.ts:197-218` (`scheduleBotActions` outside the try)
  - `games/quixx/src/lib/server/game/botController.ts:100-127` (`resolvePhase1` and `broadcastViews` outside the try)
  - `games/quixx/src/lib/server/game/botController.ts:159-161`
- **Issue:**
  - These callbacks run outside any socket handler, so nothing catches them. `onPlayerRemoved` is the documented hook for games to forfeit a seat, which makes it the most likely place for new engine code to throw.
  - The Quixx phase timers are dormant by default (`turnTimer`/`phase1Timer: null`), but they become live as soon as the planned per-lobby timers ship.
  - I tried to make Quixx's timer paths throw with crafted `row`/`cellIndex` values (prototype keys, arrays, strings). Validation held, so I found no current trigger.
  - Other timer paths are already guarded: liars-dice's `setTimeout(startNextRound)` blocks, and quixx's `autoRollIfNeeded` and bot roll.
- **Repro:** (hypothetical) a game implements `onPlayerRemoved` and it throws, for example on an engine that was already reset to `null`. When a disconnected player's 60s grace expires, the process exits.
- **Suggested fix (core, 3.2):** `roomManager.schedule(roomCode, fn, ms)` wraps every callback in try/catch, logs with the room tag, and drops the room's timers on reset or delete. Also wrap `emitExpiry`'s callback invocation in try/catch inside RoomManager.

### B-07 Bot-turn failures are swallowed, leaving the room stuck; Promise.race timeouts leak and let turns overlap
- **Severity:** medium
- **Location:**
  - `games/booty-dice/src/lib/server/definition.ts:79-84, 100-141, 183-187, 232-236`
  - `games/kings-corner/src/lib/server/definition.ts:55-59, 73-135`
  - `games/liars-dice/src/lib/server/definition.ts:55-59, 74-152`
- **Issue:**
  - `handleAITurn(...).catch(console.error)` keeps the process alive, which is good. But nothing ends the bot's turn after the catch.
    - In booty-dice, the catch block itself calls `engine.finishRolling()` and `handleEndTurn()` without a try. If that throws, the turn is never ended, every human action gets "not your turn" or is ignored, and the room is stuck until reset.
    - The kings-corner callbacks use `catch {}` with no logging, which hides engine errors completely.
  - Verified safe: Promise.race does not leave the loser rejection unhandled.
  - The 30s timeout timer is never cleared after the race settles. Each AI turn leaves a timer and a closure (engine, io) alive for 30s.
  - When the timeout does win, `aiPlayer.takeTurn` keeps running at the same time as the fallback.
    - Booty-dice engine methods (`roll`, `lockDice`, `selectTarget`, `finishRolling`) take no player id, so the stale coroutine would act on whoever's turn it now is. Today this needs a turn longer than 30s (normal total is about 12s), which only happens if the event loop is starved.
    - Liars-dice uses `activePlayer.id` and kings-corner uses `botId`, so the engine rejects the stale moves there.
- **Repro:** (by reading) booty-dice bot turn → `handleEndTurn` throws inside the fallback → the `.catch` logs "[AI Turn] Error" → `currentPlayerIndex` stays on the bot forever.
- **Suggested fix:**
  - Core: a bot runner owned by the scheduler. It uses `AbortController` and `clearTimeout` once the race settles, and on failure applies a game-provided `forfeitTurn(botId)`.
  - Per-game: engine methods should take the acting player id and validate it.

### B-08 Lobby start and restart leave half-updated room state when a game callback throws or is missing
- **Severity:** medium
- **Location:**
  - `packages/multiplayer/src/RoomManager.ts:191-197` (`startGame` sets `status='playing'` before the game exists, and never checks `status==='waiting'`)
  - `packages/multiplayer/src/lobbyHandlers.ts:275-283, 311-324`
  - `apps/parlor/src/lib/server/socketServer.ts:41-46` (returns silently when `gameId` is null)
- **Issue:**
  - The room becomes `playing` and `lobby:gameStarting` goes out before `onGameStart` runs.
  - If `onGameStart` throws (engine constructor, view build, emit), or no game has been selected (`getGameId` returns null and the callback silently does nothing), the room is left in this state:
    - `status='playing'`
    - `gameData` is null, or an engine already stored by `setGameData` that never sent its views
    - clients are already on the game page
    - joins are rejected with "Game already in progress"
  - The host gets `callback(false, err.message)`, which leaks the raw error text (cross-ref D).
  - `startGame` does not require `waiting`, and ready flags stay true after a start. So a host re-sending `lobby:startGame` mid-game builds a new engine over the old one, while the old engine's bot timers keep broadcasting stale views to the same players (cross-ref C).
- **Repro (by reading):**
  - Host has two ready players and no game selected, then sends `lobby:startGame`. The ack is `true`, everyone navigates to `/game`, no `game:state` ever arrives, and the room is stuck until the host resets.
  - Host sends `lobby:startGame` twice during a liars-dice game with a bot. Two engines are now live, and views from both interleave.
- **Suggested fix (core):**
  - Validate the game selection and `status==='waiting'` before any mutation.
  - Build the engine first and commit `status`/`gameData` only after it succeeds. On a throw, roll back to `waiting` and emit `lobby:state`.

### B-09 Mutate-before-validate and non-atomic multi-step mutations in engines and handlers
- **Severity:** medium
- **Location:**
  - `games/quixx/src/lib/server/definition.ts:320` (`clearRoomTimer` runs before `submitPhase2` validates the sender)
  - `games/booty-dice/src/lib/server/game/GameEngine.ts:136-147` (`selectTarget` takes any target, including self, eliminated players or junk, and can re-target already-resolved actions)
  - `games/booty-dice/src/lib/server/game/GameEngine.ts:83-88` (`lockDice` has no phase or player check; the handler guards it, AI callbacks do not)
  - `games/booty-dice/src/lib/server/definition.ts:203-238` (disconnect auto-resolve is a five-step sequence)
  - `packages/multiplayer/src/lobbyHandlers.ts:405` (`catch {}` with no logging)
  - `games/quixx/src/lib/server/game/QuixxEngine.ts:123-132`, `games/quixx/src/lib/game/validation.ts:4-35`
  - The general pattern in every `definition.ts`: engine mutation → `broadcastViews` → bot/timer scheduling. A throw at the broadcast step commits the mutation but skips the scheduling (see B-03).
- **Issue:**
  - Quixx: when `turnTimer` is configured, *any* player, including a non-active one, can cancel the active player's turn timer by sending `phase2-pass`. The engine then rejects the action, but the timer is already gone and is never restarted, so an AFK player stalls the room.
  - Booty-dice: the disconnect auto-resolve calls finishRolling → selectTarget ×N → resolveTurn → endTurn → broadcast. A throw part-way is silently swallowed by the disconnect handler. For example, if `resolveTurn` is applied but `endTurn` is not, a reconnecting player can end the turn again and the effects apply twice.
  - Quixx `phase1-mark` with `cellIndex: "10"` (or `[10]`) passes `numberAtCell` and `canMark` through string coercion. The strict `cellIndex === 10` checks are then skipped, which bypasses the "5 marks before locking" rule and leaves the row silently unlocked. Verified with the engine directly: a red row with 0 prior marks became `[…false, true]` with `lockedRows []`. This mainly belongs to area A, but it is the same validate-then-mutate weakness.
- **Repro:** see each item above. The Quixx timer cancel needs `turnTimer` set (not the default). The coercion bypass was verified live against `QuixxEngine`.
- **Suggested fix:**
  - Per-game: validate everything, then mutate. Move `clearRoomTimer` after a successful `submitPhase2`. Validate `targetPlayerId` and `cellIndex` with `Number.isInteger`.
  - Core: schema validation (3.1) removes most of this. Log in the disconnect `catch`.

### B-10 The 45 `no-floating-promises` sites: none can crash the server today
- **Severity:** low
- **Location:**
  - Server side (12):
    - `packages/multiplayer/src/lobbyHandlers.ts:91,92,120,121,163,335,336,365,366` (`socket.join`/`socket.leave`)
    - `packages/multiplayer/src/server.ts:131` (`io.close`)
  - Client side (33):
    - `goto()` calls in `apps/parlor/src/routes/+page.svelte:92,114`, `apps/parlor/src/routes/game/[roomCode]/+page.svelte:38,46`, `apps/parlor/src/routes/lobby/[roomCode]/+page.svelte:44` and the matching routes in each game
    - async `handleJoin()`/`handleCreate*()` called from `onkeydown` in `apps/parlor/src/routes/+page.svelte:148,152` and `games/*/src/lib/components/lobby/JoinForm.svelte:69,73`
    - `tick().then` in `games/booty-dice/src/lib/components/game/GameLog.svelte:14`
- **Issue / classification:**
  - `socket.join`/`leave`: with the default in-memory adapter, `Socket.join` returns `adapter.addAll(...)`, which is synchronous and returns `void`. There is no promise to reject. This becomes real only if a Redis or cluster adapter is adopted, and then a rejection would crash the process (B-02).
  - `io.close` (4.8.3 `index.js:489-513`) is `async`, but it uses `Promise.allSettled` and a resolve-only promise, so it cannot reject. Shutdown drain was verified to work.
  - The 33 client sites run in the browser. The handlers already wrap their bodies in try/catch, and the worst case is a console "unhandled rejection". None of them affect the server.
- **Repro:** n/a
- **Suggested fix:** mark the sites intentionally with `void`, and keep the rule at `error` for server code so a future async handler or adapter cannot introduce a silent crash path.

### B-11 Internal exception text is sent to clients
- **Severity:** low (cross-ref D)
- **Location:**
  - `packages/multiplayer/src/lobbyHandlers.ts:101,142,168,191,225,258,285,301,326,350`
  - `apps/parlor/src/lib/server/socketServer.ts:124`
  - Every `games/*/src/lib/server/definition.ts` catch (`socket.emit('error', err.message)`)
- **Issue:** Raw `err.message` from TypeErrors and RangeErrors is forwarded to clients, for example `Cannot read properties of null (reading 'type')` and `Maximum call stack size exceeded` (both observed live). This exposes implementation details and helps attackers tune B-01/B-03 style probes.
- **Repro:** `game:action null` → client receives `error: Cannot read properties of null (reading 'type')`.
- **Suggested fix (core):** Separate user-facing errors (a `GameRuleError` class) from unexpected errors. Unexpected errors should be logged server-side, and the client should only get a generic "Something went wrong".

### Coverage
- Read in full:
  - `apps/parlor/server/index.ts`, `apps/parlor/src/lib/server/socketServer.ts`, `apps/parlor/src/lib/server/gameRegistry.ts`, `apps/parlor/src/lib/server/games/index.ts`
  - `packages/multiplayer/src/{RoomManager,lobbyHandlers,server,gameDefinition}.ts`
  - all 5 `games/*/src/lib/server/definition.ts`
  - engines: `CrazyEightsEngine`, `KingsCornerEngine`, `QuixxEngine`, `GameEngine` (booty-dice), `LiarsDiceEngine`
  - AI and bots: `quixx botController`/`botStrategy`, `booty/kings/liars AIPlayer`
  - validation: `crazy-eights`, `kings-corner` and `quixx` `game/validation.ts`, `booty-dice validation.ts`
  - entry and wiring: `games/quixx/server/index.ts`, `games/quixx/src/lib/server/socket/socketServer.ts` (the other four are the same pattern), `Dockerfile` CMD
- Skimmed: `booty-dice ActionResolver` (target handling), `liars-dice AIStrategy` (loops only).
- socket.io internals checked:
  - `socket.js` `dispatch`/`onevent`/`ack`/`emit`/`join`
  - `socket-types.js` `RESERVED_EVENTS`
  - `index.js` `close`
  - socket.io-parser 4.2.5 `isPayloadValid` and `is-binary.js`
- Live experiments (throwaway harness in the scratchpad that loads the real `setupParlorSocketHandlers` with tsx; no repo files modified; `git status` clean):
  - B-01 crash with four payload variants, including one sent with no room joined
  - `game:action` with malformed and null payloads (process survives)
  - B-03 crazy-eights room poisoning (40 KB raw frame)
  - B-04 Quixx two-bot stall
  - parser decode/encode depth thresholds
  - Node 22 default behaviour for unhandled rejections, timer throws and the Promise.race loser
  - graceful-shutdown drain
  - B-09 Quixx `cellIndex: "10"` coercion
- Lint: classified all 45 `no-floating-promises` sites (B-10).
- Not done or not verified:
  - Booty-dice `targetPlayerId` poisoning was not reproduced live (verified by reading).
  - B-07 and B-08 are verified by reading, not run.
  - Vite dev-server plugins were not read beyond confirming they register the same handlers.
  - `clientRuntime.ts` and client stores were out of scope for server crash isolation.
  - Cross-refs for other areas: stale-engine timers after reset or room deletion, and Quixx's untracked timers clearing the *new* game's bot timer through `clearBotTimers(roomCode)` (area C). No game implements `onPlayerRemoved`, so expired players stay seated in engines (C/E). The unbounded `gameLog` is re-sent with every broadcast (E).


# Audit C: Lifecycle & timers

Auditor scope: room and game state machine, every timer and async bot loop, reset/restart/delete/switch races.
Repro scripts (throwaway, not in repo): `/private/tmp/claude-501/-Users-paul-projects-parlor/5b70d13c-53ac-4494-8565-10b59126b38a/scratchpad/c/`
(`vclock.mts` is a deterministic virtual clock; `fake.mts` drives the real `RoomManager` + `setupLobbyHandlers` with a fake io/socket. Each script imports the real game `definition.ts`. Run with `games/quixx/node_modules/.bin/tsx <script>` from a game dir.)

## State machine & timer inventory

### Room / game state machine (as implemented)

```
                    lobby:create
                         |
                         v
   +-------------- [waiting] <------------------------------------+
   |  join/addBot/removeBot/ready/selectGame only allowed here    |
   |                     |                                        |
   |  lobby:startGame    |  (guard: canStartGame = >=2 players,   |
   |  (host)             |   <=max, all ready; NO status check,   |
   |                     |   NO gameId check)                     |
   |                     v                                        |
   |               [playing]  --- game ends inside engine ------> (status stays 'playing';
   |                     |                                         'finished' is never set)
   |   lobby:resetGame   |  RoomManager.resetGame -> status=waiting, gameData=null,
   |   (host)            |  humans un-readied -> onGameReset(gameId) ---------------+
   |                     |
   |   lobby:restartGame |  resetGame -> onGameReset -> readyAllHumans (incl. disconnected)
   |   (host, any status)|  -> startGame -> onGameStart (new engine, same room code)
   |
   +--> room destroyed when the last human is removed (room:leave or grace expiry).
        No game callback runs on destroy (onGameReset is not called; onPlayerRemoved is
        routed via getGameId(), which is null once the room is gone).

Player: join -> connected
        socket disconnect -> connected=false, 60s grace timer (keyed by playerId)
          -> player:reconnect / recovered socket (rebindSocket) -> timer cleared, connected=true
          -> expiry -> removePlayer (host reassigned to first connected human, else first human;
             room destroyed if no humans) -> lobby:playerLeft, onPlayerRemoved if wasInGame
        room:leave -> removePlayer immediately (no onPlayerRemoved, even mid-game)
Spectator: keyed by socket id, removed immediately on disconnect, never replayed state on join.
Game switch: lobby:selectGame only while status==='waiting' (so only after a reset).
```

### Timer inventory

| # | Location | Purpose | Tracked? | Cleared on reset/restart? | Cleared on room delete? | Guards when it fires |
|---|---|---|---|---|---|---|
| 1 | packages/multiplayer/src/RoomManager.ts:352 | 60s disconnect grace | yes, `disconnectTimers` keyed by playerId, `unref` | n/a | yes (`destroyRoom`) | re-checks room exists and `player.connected` |
| 2 | packages/multiplayer/src/server.ts:124 | shutdown force-exit | yes, cleared on drain | n/a | n/a | n/a |
| 3 | packages/multiplayer/src/clientRuntime.ts:119 | client reconnect ack timeout | local `settled` latch | n/a | n/a | ok |
| 4 | packages/multiplayer/src/clientRuntime.ts:261 | client action ack timeout | local `settled` latch | n/a | n/a | ok |
| 5 | games/quixx/src/lib/server/definition.ts:44 | phase1 turn timer | yes, `roomTimers[roomCode]` | yes (`cleanupRoomTimers` in onGameReset) | **no** | captured `engine` phase. Never armed today (`DEFAULT_CONFIG.phase1Timer=null`) |
| 6 | games/quixx/src/lib/server/definition.ts:83 | phase2 turn timer | yes, `roomTimers` | yes | **no** | same. Never armed today (`turnTimer=null`) |
| 7 | games/quixx/src/lib/server/definition.ts:115 | auto-roll after human phase2 (500ms) | **no** | **no** | **no** | captured engine phase only |
| 8 | games/quixx/src/lib/server/definition.ts:197 | initial auto-roll in onGameStart (500ms) | **no** | **no** | **no** | captured engine phase only, then calls `scheduleBotActions` unconditionally |
| 9 | games/quixx/src/lib/server/game/botController.ts:74/100/138 | bot roll / phase1 / phase2 (700-1200ms) | yes, `botTimers[roomCode]` (one slot per room, not per engine) | yes (`clearBotTimers`) | **no** | captured engine phase |
| 10 | games/quixx/src/lib/server/game/botController.ts:159 | re-schedule bots after bot phase2 (600ms) | **no** | **no** | **no** | none. Calls `scheduleBotActions(oldEngine)`, which runs `clearBotTimers(roomCode)` |
| 11 | games/crazy-eights/src/lib/server/definition.ts:17 | `roomTimers` map | declared but **never populated** (dead code) | no-op | no-op | — |
| 12 | games/liars-dice/src/lib/server/definition.ts:55 | `setImmediate` AI turn | **no** | **no** | **no** | captured engine `gameOver`/phase |
| 13 | games/liars-dice/src/lib/server/ai/AIPlayer.ts:13 | AI think delay 1.5-2.5s | **no** (awaited promise) | **no** | **no** | callbacks check only `engine.gameOver` |
| 14 | games/liars-dice/src/lib/server/definition.ts:75 | 30s AI timeout | **no**, never cleared after the race settles | **no** | **no** | rejection ignored once the race has settled |
| 15 | games/liars-dice/src/lib/server/definition.ts:99, :119, :210 | 3s auto next round (AI challenge/spot-on, disconnect auto-challenge) | **no** | **no** | **no** | try/catch on phase only |
| 16 | games/booty-dice/src/lib/server/definition.ts:79, :183, :232 | `setImmediate` AI turn | **no** | **no** | **no** | captured engine phase |
| 17 | games/booty-dice/src/lib/server/ai/AIPlayer.ts:77 | AI delays (1.5s, 0.8s, 0.5s, 1s; about 6-11s per turn) | **no** | **no** | **no** | callbacks check only `phase==='ended'`. Engine mutators act on the *current* player (no playerId) |
| 18 | games/booty-dice/src/lib/server/definition.ts:101 | 30s AI timeout | **no**, never cleared | **no** | **no** | fallback runs even though the loop is not cancelled |
| 19 | games/kings-corner/src/lib/server/definition.ts:55 | `setImmediate` AI turn | **no** | **no** | **no** | captured engine `isGameOver` |
| 20 | games/kings-corner/src/lib/server/ai/AIPlayer.ts:13 | AI delays 1000ms / 700ms per action | **no** | **no** | **no** | callbacks check `isGameOver`, engine validates botId |
| 21 | games/kings-corner/src/lib/server/definition.ts:74 | 30s AI timeout | **no**, never cleared | **no** | **no** | as #18 |
| 22 | apps/parlor/src/routes/lobby/[roomCode]/+page.svelte:89,93 and games/*/LobbyView.svelte | "copied" UI flag | n/a (UI) | — | — | harmless |

Summary: the only correctly scoped server timer is the core grace timer (#1). `cleanupRoomTimers` is only called from each game's own `onGameReset`: it does nothing in crazy-eights and covers only the dormant phase timers in quixx. It is never called on room deletion. No game cancels an AI loop. All AI and bot work captures the `engine` object in a closure and never checks that `roomManager.getGameData(roomCode) === engine`.

---

## C. Lifecycle & timers

### C-01 Old-engine timers and AI loops survive reset/restart/switch and broadcast stale `game:state` into the room
- **Severity:** high
- **Location:** games/booty-dice/src/lib/server/definition.ts:79,105-133,183; games/liars-dice/src/lib/server/definition.ts:55,81-131,210; games/kings-corner/src/lib/server/definition.ts:55,79-118; games/quixx/src/lib/server/definition.ts:115,197 and game/botController.ts:159; onGameReset in each game (booty :191, liars :192, kings :178 only null `gameData`)
- **Issue:** Each `broadcastViews` takes the *captured* engine but fans out to the room's *current* player list (`roomManager.getPlayersInRoom(roomCode)`). Nothing ties a pending timer or AI loop to a particular engine instance, so after `lobby:resetGame`, `lobby:restartGame`, or reset followed by `lobby:selectGame` to another game, the old loop keeps going. It mutates the detached engine, emits that engine's views to every human and spectator in the room, and (for bots) chains further AI turns until it reaches a human seat. On the client, the lobby page navigates to `/game` whenever `gameState.view` is set (apps/parlor/src/routes/lobby/[roomCode]/+page.svelte:42-46). A stale view therefore pulls everyone out of the lobby into the old game. After a game switch, the renderer receives a payload shaped for a different game.
- **Repro (confirmed by script):**
  - `booty.mts` T2: host plus 2 bots, host ends turn, bot starts thinking, host sends `lobby:resetGame`. Room status is `waiting` and `gameData` is null, yet **21 `game:state` emits from the old engine** reach the room afterwards.
  - `liars-stale.mts`: A bids, B bids back, B disconnects (auto-challenge arms the 3s timer), host sends `lobby:restartGame`. After 3s both players receive `engine#1 phase=bidding` while the room's engine is #2.
- **Suggested fix:** **Core.** Add a room-scoped scheduler (plan item 3.2) with a per-room *generation* counter that is bumped on reset, restart and destroy. `schedule()` drops callbacks whose generation is stale, and AI loops receive an `isCurrent()` / AbortSignal they check after every `await`. Also make `broadcastViews` (ideally a core helper) refuse to emit unless `getGameData(roomCode) === engine`.

### C-02 Quixx: old engine's untracked 600ms timer cancels the new engine's bot timer, so the restarted game is stuck forever
- **Severity:** high
- **Location:** games/quixx/src/lib/server/game/botController.ts:14,20-26,62,159-161; games/quixx/src/lib/server/definition.ts:197-218
- **Issue:** `botTimers` has one slot per **room code**, not per engine. `scheduleBotActions` always calls `clearBotTimers(roomCode)` before checking the phase. The untracked 600ms re-schedule after a bot's phase2 (#10) and the untracked onGameStart auto-roll (#8) both later call `scheduleBotActions(oldEngine)`. If a restart happened in between, that call clears whatever bot timer the *new* engine had armed, and for the old engine (phase `rolling`, human active, auto-roll) it schedules nothing. The new game's bot never submits phase1, so `allPhase1Submitted()` never becomes true.
- **Repro (confirmed, `quixx-race.mts`, virtual clock):** Host plus 1 bot. Play until the bot finishes phase2 (old 600ms timer pending), then `lobby:restartGame`. The new engine auto-rolls at +500ms and arms the bot's phase1 timer (700-1200ms). The old timer fires at +600ms and clears it. The human passes. After 5s and again after 2 minutes, the new engine is still in `phase1` with decisions `[Host: pass, Bot: null]`. The game is permanently stuck. A double `lobby:startGame` (C-06) hits the same window through timer #8.
- **Suggested fix:** Per-game: key timers by engine (or store the timer on the engine) and track #7, #8 and #10. In the long term, the generation-checked core scheduler from C-01 fixes this structurally.

### C-03 Quixx with auto-roll: nobody rolls when a bot's turn follows a bot's phase2, or after the disconnect auto-pass
- **Severity:** high
- **Location:** games/quixx/src/lib/server/game/botController.ts:66-88,151-164; games/quixx/src/lib/server/definition.ts:230-261
- **Issue:** `DEFAULT_CONFIG.diceRolling === 'auto'`. Only the human phase2 path (definition.ts:330 and :100) calls `autoRollIfNeeded`. After a bot's phase2, `advanceTurn()` sets phase `rolling` and the bot path only re-schedules `scheduleBotActions`. That function returns early for `rolling` + `shouldAutoRoll()` (line 71) and never rolls. If the next player is a bot, nothing ever rolls. Humans have a Roll button, so a human next player only masks this. `onPlayerDisconnect` has the same gap: its phase2 auto-pass plus `advanceTurn()` and its phase1 `resolvePhase1()` neither auto-roll nor call `scheduleBotActions`. A bot that becomes active (rolling or phase2) is never driven.
- **Repro (confirmed, `quixx-restart.mts` T1):** Host plus 2 bots; host always passes. After about 40 polls the game sits at `phase=rolling active=Bot Bob round=1` forever.
- **Suggested fix:** Per-game: in the bot phase2 branch, call the same `autoRollIfNeeded` the human path uses (and remove the "auto-roll handles itself" assumption). In `scheduleBotActions`, also auto-roll when the active bot is in `rolling` and `shouldAutoRoll()`. `onPlayerDisconnect` should end with the same "advance → autoRoll → scheduleBotActions" tail.

### C-04 Removed or still-disconnected seats are never skipped: the turn reaches them and the game stalls forever
- **Severity:** high
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:330-352 (`room:leave` never calls `onPlayerRemoved`); no game implements `onPlayerRemoved` (grep: only the core type and the socketServer router reference it); per-game `onPlayerDisconnect` only acts on the *currently active* seat: games/crazy-eights/src/lib/server/game/CrazyEightsEngine.ts:289-319, games/kings-corner/src/lib/server/game/KingsCornerEngine.ts:262-285, games/booty-dice/src/lib/server/definition.ts:203, games/liars-dice/src/lib/server/definition.ts:204 (only when `currentBid` exists), games/quixx/src/lib/server/definition.ts:235-257 (only the current phase1/phase2)
- **Issue:** The core fires `onPlayerRemoved` on grace expiry, but every game ignores it, so the engine keeps the seat. `room:leave` mid-game doesn't fire it at all. Engines' `advanceTurn` doesn't skip `connected=false` players. A player who disconnects while *not* active, or stays disconnected past their own turn, blocks the table until they reconnect. Once they expire, the block is permanent and nobody can act for that seat. In quixx, phase1 requires every player's decision, so a disconnected player blocks every roll after the first.
- **Repro (confirmed, `c8-kc.mts` [C8]):** Crazy Eights with A, B, C. C (not active) disconnects and 61s later is removed from the room (room `[A,B]`, engine `[A,B,C:false]`). A and B draw and pass. The active seat becomes C, phase `playing`, and no one can ever act. `core.mts` T3 confirms that `room:leave` mid-game makes 0 `onPlayerRemoved` calls.
- **Suggested fix:** Core: call `onPlayerRemoved` from `room:leave` when `wasInGame`, and fire it before the room is destroyed (see C-09). Per-game: implement `onPlayerRemoved` (forfeit the seat or mark it eliminated, advance if active). Make `advanceTurn` auto-play or skip disconnected seats, or give the core a generic per-turn "absent player" timeout that calls a definition `autoAct(playerId)` hook.

### C-05 Kings Corner maps the engine's turn index onto the room's player list, so after any mid-game removal bots stop being scheduled
- **Severity:** high
- **Location:** games/kings-corner/src/lib/server/definition.ts:50-53
- **Issue:** `scheduleAITurnIfNeeded` does `roomManager.getPlayersInRoom(roomCode)[engine.getActivePlayerIndex()]`. The room list shrinks when a player leaves or expires, but the engine's does not. The index then points at the wrong player, or past the end. Bot turns are silently skipped (stuck), or a bot is scheduled during a human's turn (its moves throw and are swallowed).
- **Repro (confirmed, `c8-kc.mts` [KC]):** Players `[A, B, bot]`. A ends turn, then A sends `room:leave`. B draws and ends turn. The engine's active index is 2 (Bot Alice), but the room list has only 2 entries, so no AI turn is scheduled. After 2 minutes the active index is still 2, phase `drawing`. Permanently stuck.
- **Suggested fix:** Per-game: read the active player id from the engine (`engine.getPlayers()[idx].id` or an `isBot` flag stored in the engine, as quixx and liars do). Never index the room list with engine indices.

### C-06 `lobby:startGame` has no status guard: a double-click or a mid-game start spawns a second engine and orphans the first
- **Severity:** high
- **Location:** packages/multiplayer/src/RoomManager.ts:183-197 (`canStartGame` / `startGame` ignore `status`); packages/multiplayer/src/lobbyHandlers.ts:263-287
- **Issue:** Ready flags stay `true` for the whole game, so `canStartGame` keeps returning true while `status === 'playing'`. Every extra `lobby:startGame` from the host re-runs `onGameStart`: it creates a new engine, overwrites `gameData` and emits `lobby:gameStarting` again. Nothing resets the old engine's timers or AI loops, so the C-01 and C-02 effects follow. (`lobby:restartGame` is likewise accepted in any status, including `waiting`, where it force-readies unready players.)
- **Repro (confirmed, `booty.mts` T1):** Two back-to-back `lobby:startGame` calls get acks `[true, true]`, two different engines, and 2 `lobby:gameStarting` emits.
- **Suggested fix:** **Core:** `startGame` must require `status === 'waiting'` (and a non-null `gameId`, see C-11). `restartGame` should only be accepted from `playing` and must run the same teardown as reset (scheduler generation bump).

### C-07 A late `disconnect` from a superseded socket marks a reconnected player offline, and 60s later removes them
- **Severity:** high
- **Location:** packages/multiplayer/src/RoomManager.ts:434-454 (`handleReconnect`), :466-476 (`rebindSocket`), :393-413 (`handleDisconnect`)
- **Issue:** `handleReconnect` adds `newSocketId → playerId` but leaves the old socket's mapping in place. When the old (half-open) socket finally times out, `handleDisconnect(oldSocketId)` still resolves to the player. It sets `connected=false`, arms the grace timer, emits `player:disconnected`, and mid-game calls `onPlayerDisconnect`, which auto-plays or forfeits their turn. Because `player.connected` is false at expiry, the player is removed even though their live socket is fine. The same applies to a second tab.
- **Repro (confirmed, `core.mts` [dup]):** Host on socket `old`. The client reconnects on socket `new` (`player:reconnect` returns true), then `old` fires `disconnect` (as after pingTimeout following a Wi-Fi to cellular switch). The player shows as disconnected, and after 61s A has been removed from the room and B made host.
- **Suggested fix:** **Core:** track `playerId → currentSocketId`. In `handleReconnect` and `rebindSocket`, delete the previous socket's mapping. In `handleDisconnect`, ignore the event unless the socket is the player's current one.

### C-08 Client treats every mid-game `lobby:state` as "game was reset", so any player's disconnect or reconnect kicks everyone out of the game
- **Severity:** high
- **Location:** packages/multiplayer/src/clientRuntime.ts:200-207; server emits `lobby:state` mid-game at packages/multiplayer/src/lobbyHandlers.ts:395 (disconnect), :372 (reconnect), :52 (expiry), :188 (ready); apps/parlor/src/routes/game/[roomCode]/+page.svelte:34-40 and the lobby page at :42-46
- **Issue:** `lobbyState.gameStarting` is set by `lobby:gameStarting` and stays true for the whole game; only the "Back to lobby" button clears it. The runtime's reset heuristic `if (gameState.view && lobbyState.gameStarting) gameState.reset()` therefore fires on the first in-game `lobby:state`. The game page then navigates to `/lobby` (view became null). Quixx, crazy-eights and kings-corner re-broadcast views right after a disconnect, so clients bounce lobby → game. Liars-dice and booty-dice re-broadcast only when the disconnecting player was active, so everyone else stays parked in the lobby until some other event sends `game:state`. The active human is in the lobby too and can't act, so in practice only a reload recovers. The reverse also fails: a client that reached the game by reload/reconnect has `gameStarting=false`, so it never learns about a host reset and sits on a stale game screen (onGameReset emits nothing game-specific). The existing unit test (clientRuntime.test.ts:370) codifies the heuristic.
- **Repro (code-read, not executed in a browser):** Liars Dice with A (host), B and C, all entered via Start. It's A's turn. C's tab closes, the server emits `lobby:state`, and A and B are routed to `/lobby/CODE` with no view. No `game:state` follows because C wasn't active. The game is frozen until someone reloads.
- **Suggested fix:** **Core:** send an explicit `game:reset` (or `lobby:state` carrying `status`/`gameId`) and have the client reset only on that. Drop the `gameStarting` heuristic.

### C-09 Room destruction never reaches the game layer; `cleanupRoomTimers` is never called on delete
- **Severity:** medium
- **Location:** packages/multiplayer/src/RoomManager.ts:311-316,329-336; packages/multiplayer/src/lobbyHandlers.ts:45-48; apps/parlor/src/lib/server/socketServer.ts:69-74
- **Issue:** When the last human leaves or expires, `destroyRoom` deletes the room without any callback. `emitExpiry` does call `onPlayerRemoved` (wasInGame), but the parlor router first does `roomManager.getGameId(roomCode)`, which is null for a deleted room, so the call is dropped. `room:leave` sends nothing at all. Pending quixx `botTimers` and `roomTimers` entries, every untracked timer, and AI loops keep running against the detached engine. I found no *unbounded* loop: each chain stops at the next human seat or at game over (liars and booty bots play out if every human is eliminated). This is a bounded CPU and memory tail rather than a perpetual leak. Room codes can be reused while those timers are alive (quixx timers keyed by code would then hit the new room's map slot).
- **Repro (confirmed, `core.mts` [destroy-leave]/[destroy-expiry]):** Host plus bot start a game, then the host sends `room:leave`. The room is gone and the callbacks seen are `['start']`, with no reset/cleanup. With expiry, the raw core callback gets `removed`, but in parlor the router discards it because `gameId` is already null.
- **Suggested fix:** **Core:** add `onRoomDestroyed(roomCode, gameId)` (or always call `onGameReset` with the captured gameId before `rooms.delete`), plus a scheduler generation bump. Have the router capture `gameId` before removal.

### C-10 `lobby:restartGame` seats players who are in their disconnect grace window, and the new engine thinks they are connected
- **Severity:** medium
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:311-320; packages/multiplayer/src/RoomManager.ts:214-220
- **Issue:** `readyAllHumans` readies everyone, including `connected=false` players. `onGameStart` builds engines with every seat connected, and `onPlayerDisconnect` is never replayed for the new engine. The disconnected player's first turn stalls (C-04). If they expire, the stall is permanent.
- **Repro (confirmed incidentally in `liars-stale.mts`):** B disconnects and the host restarts. The restart succeeds with B seated in engine #2 as a normal player.
- **Suggested fix:** **Core:** either exclude or forfeit disconnected players at start, or after `onGameStart` call `onPlayerDisconnect` for each `connected=false` seat. `readyAllHumans` should skip disconnected players.

### C-11 The server lets a game start with no `gameId` (and bots in a no-bot game); the room wedges in `playing`
- **Severity:** medium
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:275-282; apps/parlor/src/lib/server/socketServer.ts:41-46,94-97
- **Issue:** Only the UI blocks starting without a selected game, or with bots in a game without `supportsBots` (lobby +page.svelte `botsBlockStart`). Server-side, `startGame` sets `status='playing'` and the router returns early when `gameId` is null. The room is then `playing` with no engine, so `selectGame` is refused ("Cannot change game after it has started") and clients show "Loading game..." until the host resets. Bots in crazy-eights get a seat no one ever plays (C-04-style stall). (Code-read.)
- **Suggested fix:** **Core:** the parlor `onGameStart` path should reject (ack false, leave status `waiting`) when `gameId` is null or the definition doesn't support the room's bots. This is better handled as a `canStart(room)` hook on the definition.

### C-12 `status: 'finished'` is never set; a finished game keeps the room in `playing`
- **Severity:** low
- **Location:** packages/multiplayer/src/RoomManager.ts:13,191-211 (only `'waiting'`/`'playing'` are ever assigned)
- **Issue:** When an engine reaches game-over, the room stays `playing`. Joins ("Game already in progress"), `addBot` and `selectGame` stay blocked until the host resets. Grace expiry after the end still counts as `wasInGame` and fires `onPlayerRemoved` on a finished engine. If the host is gone (in grace), nobody can return the room to the lobby for up to 60s.
- **Suggested fix:** **Core:** add a `roomManager.finishGame(roomCode)` that games call (or the core infers from a standard `isGameOver()` on the definition), and allow `selectGame`/`reset` from `finished`.

### C-13 AI 30s timeout timers are never cleared, and a timeout doesn't cancel the AI loop
- **Severity:** low
- **Location:** games/booty-dice/src/lib/server/definition.ts:100-141; games/liars-dice/src/lib/server/definition.ts:74-152; games/kings-corner/src/lib/server/definition.ts:73-135
- **Issue:** Each AI turn arms a 30s timer that is never cleared and holds the engine closure for 30s after the turn. If the timeout ever wins (for example under event-loop starvation), the fallback ends the turn while `takeTurn` keeps running. In booty-dice the engine mutators (`roll`, `lockDice`, `finishRolling`, `selectTarget`) act on whoever is *current* with no player id. A late loop could therefore roll or lock for the next (possibly human) player. (Unverified in practice: normal AI turns take about 6-11s.)
- **Suggested fix:** Clear the timeout in a `finally`, pass an AbortSignal into `takeTurn`, and make booty-dice mutators take and verify `playerId`. This belongs to the core scheduler and AI-runner helper.

### C-14 Spectator lifecycle gaps
- **Severity:** low
- **Location:** packages/multiplayer/src/RoomManager.ts:329-336 (`destroyRoom` doesn't clear `spectatorToRoom`), :236-243; packages/multiplayer/src/lobbyHandlers.ts:148-171
- **Issue:** After a room is destroyed, `spectatorToRoom` still maps the spectator's socket (confirmed, `core.mts` [spec]: `isSpectator` is still true) until that socket disconnects. A spectator who joins mid-game gets no `game:state` until the next broadcast. Spectators are keyed by socket id, so a spectator who reconnects silently drops out. Spectators do survive reset and restart correctly (onGameStart sends them the new view).
- **Suggested fix:** **Core:** clear spectators in `destroyRoom`. Add an `onSpectatorJoin` callback (or a core-level "send current spectator view") on `lobby:spectate`.

### C-15 Host in grace blocks host-only lifecycle actions for up to 60s
- **Severity:** low
- **Location:** packages/multiplayer/src/RoomManager.ts:318-323, lobbyHandlers.ts host checks
- **Issue:** Host reassignment only happens on removal, so while the host is in grace nobody can start, reset, restart, select a game or manage bots. If every human is disconnected when the host expires, `humans[0]` (also disconnected) becomes host and the cycle repeats. Acceptable by design, but worth a note.
- **Suggested fix:** Optionally hand the host to a connected human immediately on disconnect (keeping a "returning host" preference), or allow any player to reset once the game is over.

### C-16 Dead or latent timer code (hygiene)
- **Severity:** low
- **Location:** games/crazy-eights/src/lib/server/definition.ts:17-29 (map never written); games/quixx/src/lib/server/definition.ts:32-107 (phase timers never armed with the default config; if enabled, the bot phase1 resolve path at botController.ts:120-125 doesn't start the phase2 timer, and `onPlayerDisconnect` doesn't clear or re-arm it)
- **Issue:** It looks like timers are managed when they aren't, and enabling turn timers would expose the missing paths.
- **Suggested fix:** Delete it in favour of the core scheduler (plan 3.2), and give turn timers one owner.

---

## Coverage

- **Read in full:**
  - packages/multiplayer/src/RoomManager.ts
  - lobbyHandlers.ts
  - gameDefinition.ts
  - server.ts (shutdown timer)
  - clientRuntime.ts (timers and lobby/game event handling)
  - apps/parlor/src/lib/server/socketServer.ts
  - apps/parlor client stores and lobby/game routes (lifecycle-relevant parts)
  - all five `games/*/src/lib/server/definition.ts`
  - quixx botController.ts
  - AIPlayer.ts for liars, booty and kings
  - the relevant engine methods (turn advance, disconnect/reconnect, phase guards)
- **Timer grep:** `setTimeout|setInterval|clearTimeout` across packages, games and apps (excluding tests and `node_modules`), plus `setImmediate` AI scheduling. All are inventoried above.
- **Confirmed with scripts:** C-01 (booty reset, liars restart), C-02, C-03, C-04 (crazy-eights expiry, `room:leave` with no `onPlayerRemoved`), C-05, C-06, C-07, C-09, C-10 (incidental), C-14 (spectator map).
  - Scripts are in `/private/tmp/claude-501/-Users-paul-projects-parlor/5b70d13c-53ac-4494-8565-10b59126b38a/scratchpad/c/`: `quixx-race.mts`, `quixx-restart.mts`, `liars-stale.mts`, `booty.mts`, `c8-kc.mts`, `core.mts`.
- **Code-read only:** C-08 (client), C-11, C-12, C-13 (unverified timing), C-15, C-16, and the quixx `onPlayerDisconnect` part of C-03.
- **Checked, no issue found:**
  - `callbackCache` in socketServer.ts holds one closure set per game, bound to the single `roomManager` and `io`. Nothing is per-room, so it is not stale in a harmful way. The real routing problem is C-09, where `gameId` is null after destroy.
  - Core grace-timer races: reconnect cancels it, expiry re-checks `connected`, and `destroyRoom` clears it. Reconnect after a reset works, though `onPlayerReconnect` sends nothing when `gameData` is null, which is fine.
  - Host reassignment on removal.
  - No unbounded "bots play forever after the last human leaves" loop exists (see C-09). The cost is a bounded tail.
  - The module-level `aiPlayer` singletons in liars and booty use stateless strategies, so there is no cross-room bleed.
- **Not covered:**
  - Standalone per-game socket servers (`games/*/src/lib/server/socket/socketServer.ts`). They reuse the same definitions, so C-01 through C-05 apply there too.
  - Socket.io `connectionStateRecovery` buffering semantics.
  - Browser/E2E confirmation of C-08.


# Audit D: Information leakage & security

Audited at `2cba304`, branch `core-hardening-phase-0`. The audit was read-only: no repo files were changed. The empirical checks used throwaway scripts in the scratchpad:
- `leakcheck.ts`: plays 400 randomized Crazy Eights and Kings Corner games and 300 Liar's Dice games. On every step it diffs each player view and the spectator view against the engine's private state.
- `live.mts`: runs the real `setupParlorSocketHandlers` on a live socket.io server and drives it with socket.io-client.
- `spec.mts`: drives a Liar's Dice action through the real definition from a spectator socket.
- `err.mts`: checks which error strings malformed payloads produce.

## Hidden-information matrix

| Game | Secret state | Player view | Spectator view | Evidence |
|---|---|---|---|---|
| Crazy Eights | Other players' hands, draw-pile order and contents, the card just drawn | ✅ | ✅ | `CrazyEightsEngine.ts:215-287`: only `cardCount` and `drawPileCount` are exposed. `drewCard` goes only to the active player (`:226-234`). leakcheck found 0 leaks over 200 games played to completion. |
| Kings Corner | Other players' hands, draw-pile contents | ✅ | ✅ | `KingsCornerEngine.ts:191-260`: counts only; the piles are public by the rules. The bot uses `getPlayerView(botId)` (`definition.ts:117`). leakcheck found 0 leaks over 200 games. |
| Liar's Dice | Every other player's dice until a challenge or spot-on | ✅ | ✅ | `LiarsDiceEngine.ts:56-126`: `players[].dice` and `revealedDice` stay null until `challenge`/`spotOn`. `startNextRound` clears the reveal (`:309-311`). Log text carries only counts. leakcheck found 0 leaks over 300 games. One caveat: the bot is handed the full `getState()` (D-11). |
| Quixx | Pending simultaneous phase-1 choices (until resolved) | ✅ | ✅ | `QuixxEngine.ts:262-335`: only `phase1Submitted: boolean` is exposed. The decision is applied to `sheet` only in `resolvePhase1` (`:152-154`). Sheets and dice are public. |
| Booty Dice | None: the game is perfect-information (dice, coins, lives and targets are public) | ✅ (n/a) | ✅ (n/a) | `GameEngine.ts:60-77` spreads the whole `GameState`. It holds no seed, socket ids or tokens (`types/game.ts:101-113`). |

Other emit paths:
- `lobby:state`, `lobby:playerJoined`, `lobby:hostChanged`, `player:(dis|re)connected` and `lobby:gameSelected` go to the room code. They carry `LobbyPlayer` (`{id,name,connected,isReady,isBot}`) and no token. `reconnectToken` lives in the separate `room.reconnectTokens` map and is returned only in the creator's or joiner's own ack.
- `room:updated`, `chat:message` and `player:joined`/`player:left` are declared in the types but never emitted.
- Every `game:state` emit goes to `io.to(player.id)` (stable UUID) or `io.to(spectatorSocketId)`. No game emits a view to `io.to(roomCode)`.
- Only server code calls `socket.join`. The `playerId` room is joined only after create, join or a token-validated reconnect, so a client cannot subscribe to another player's id room.
- The standalone `games/*/src/lib/server/socket/socketServer.ts` reuse the same definitions and lobby handlers, so the result is the same.
- No `{@html}`, `innerHTML` or dynamic `href`/`src` sinks exist in any `.svelte` file.

---

## D. Information leakage & security

### D-01 Room codes can be enumerated in seconds; spectate needs no permission and joins any lobby
- **Severity:** high
- **Location:**
  - `packages/multiplayer/src/utils.ts:1-9`: 4 characters from a 32-character alphabet, so 32^4 = 1,048,576 codes.
  - `packages/multiplayer/src/lobbyHandlers.ts:148-171`: `lobby:spectate` accepts any room in any status.
  - `packages/multiplayer/src/lobbyHandlers.ts:105-146` and `packages/multiplayer/src/RoomManager.ts:107-133`: `lobby:join` works on any `waiting` room, and rooms return to `waiting` after every game (`RoomManager.ts:199-211`).
  - No rate limit anywhere; `k8s/ingress.yaml` has no middleware.
- **Issue:**
  - One socket can fire unlimited `lobby:spectate` acks.
  - A successful spectate silently subscribes the socket to the room broadcast. That stream carries player names and ids, ready and host state, and every spectator `game:state`.
  - Spectators are never announced to the players; no spectator list is broadcast.
  - Any lobby between games can be joined as a player by a stranger, and the host has no kick.
- **Repro:**
  - In `live.mts`, a single websocket client probed **20,001 codes in ~300 ms** and found the one live room. At that rate the whole code space takes about 15 s.
  - The attacker then received that room's spectator stream with no prompt to the players.
  - A loop of `lobby:join` over the found codes puts an uninvited player into every lobby that is between games.
  - Combined with D-02, a stranger can also disrupt Liar's Dice games in progress.
- **Suggested fix (core):**
  - Add a per-socket and per-IP token bucket on `lobby:join`, `lobby:spectate` and `player:reconnect`. Disconnect the socket after N consecutive "Room not found" results.
  - Lengthen codes (6+ characters, about 2^30) or add a join secret in the share link.
  - Make spectating opt-in per lobby, and broadcast the spectator count to players.
  - Add a host `kick` action.

### D-02 Spectators (and any seated player) can force `nextRound` in Liar's Dice
- **Severity:** medium
- **Location:**
  - `games/liars-dice/src/lib/server/definition.ts:272-277`
  - `games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts:256` (`startNextRound` takes no actor)
  - Router: `apps/parlor/src/lib/server/socketServer.ts:129-140`, which only checks `socket.data.roomCode`, and spectate sets that field (`lobbyHandlers.ts:164`).
- **Issue:**
  - `game:action` is routed for any socket that has `socket.data.roomCode`, and that includes spectators.
  - Most game actions fail safely, because the engines compare `playerId` (undefined for spectators) with the active player. For example, a spectator's `challenge` produced "No bid to challenge" and its `bid` produced "Not your turn" in `live.mts`.
  - Liar's Dice `nextRound` has no identity check at all.
- **Repro:**
  - `spec.mts` puts the game in the `challenge` phase (round 1).
  - A spectator socket (`data.playerId` undefined) sends `{type:'nextRound'}`.
  - The phase becomes `bidding`, the round becomes 2 and `revealedDice` becomes null.
  - Result: anyone who guessed the code (D-01), or any player, can cut the reveal short and start the next round. The reveal is the only moment players can check the outcome, and this also races the 3 s auto-advance timers.
- **Suggested fix:**
  - Core: reject `game:action` from spectator sockets in the router (`roomManager.isSpectator(socket.id)`), and require `socket.data.playerId` to belong to `socket.data.roomCode`.
  - Per game: make `nextRound` host-only or timer-only.

### D-03 Room codes, shuffles and dice all come from the process-wide `Math.random`
- **Severity:** medium (unverified exploitability)
- **Location:**
  - `packages/multiplayer/src/utils.ts:6`
  - `games/crazy-eights/src/lib/game/deck.ts:17`
  - `games/kings-corner/src/lib/game/deck.ts:17`
  - `games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts:384,435`
  - `games/booty-dice/src/lib/server/game/DiceRoller.ts:20` and `shuffle.ts:4`
  - `games/quixx/src/lib/server/game/dice.ts:4`
- **Issue:**
  - V8's `Math.random` is xorshift128+, which is not cryptographically secure. Its state can be recovered from a run of observed outputs with a SAT solver. This is a published, practical technique.
  - Players observe many outputs: their own Liar's Dice rolls, all Quixx and Booty Dice dice, and the room codes of rooms they create.
  - All rooms share one generator. Recovering its state would predict deck order, other players' dice and future room codes.
- **Repro:** Not attempted. On a quiet server, an attacker could create rooms and roll dice to collect outputs, solve for the state, then predict the next Crazy Eights shuffle or opponents' Liar's Dice rolls. Interleaved calls from other rooms make this harder but not impossible.
- **Suggested fix (core):**
  - Add a `secureRandomInt(n)` helper in a shared package, backed by `crypto.randomInt`.
  - Use it for room codes, shuffles and dice. Bot "thinking" delays can keep `Math.random`.

### D-04 Reconnect tokens never rotate, and one seat can have several live sockets
- **Severity:** low
- **Location:**
  - `packages/multiplayer/src/RoomManager.ts:79,119` (token creation)
  - `packages/multiplayer/src/RoomManager.ts:434-454` (`handleReconnect`: plain `!==` compare, no rotation, no eviction of the previous socket)
  - `packages/multiplayer/src/lobbyHandlers.ts:362-368`
  - `packages/multiplayer/src/client.ts:41-60` (token stored in `localStorage['parlor-session']`)
- **Issue:**
  - The token is a v4 UUID (`crypto.randomUUID`, 122 bits), which is fine, and knowing a `playerId` alone is useless: a wrong token returned `false` in `live.mts`. A timing-safe compare is not practically needed at this entropy over the network, but would be cheap.
  - However, the token is valid for the seat's whole lifetime and is reusable any number of times.
  - A successful reconnect does not disconnect or unbind the old socket.
- **Repro:**
  - In `live.mts`, a second socket called `player:reconnect` with the host's token twice while the host was still connected. Both calls succeeded.
  - The second socket received the host's private Liar's Dice view (`myDice: [3,1,6,5,6]`), and the host stayed connected.
  - Result: anyone who gets the token once (shared device, copied localStorage, or a future XSS) shadows that seat for the whole session, both reading and acting.
- **Suggested fix (core):**
  - Rotate the token on every successful reconnect and return the new one in the ack.
  - On reconnect, `disconnectSockets()` the previous socket(s) bound to that playerId (`io.in(playerId)`).
  - Optionally use `crypto.timingSafeEqual`.

### D-05 Socket identity and room membership are not cleared when switching rooms or after removal
- **Severity:** low
- **Location:**
  - `packages/multiplayer/src/lobbyHandlers.ts:119-124` (join), `:162-164` (spectate) and `:364-368` (reconnect): none of these leave the socket's previous rooms or clear `socket.data.playerId`.
  - `packages/multiplayer/src/lobbyHandlers.ts:74-76`: a failed `rebindSocket` leaves the restored `socket.data` in place.
  - `packages/multiplayer/src/server.ts:17` (recovery window 120 s) vs `packages/multiplayer/src/RoomManager.ts:66` (grace window 60 s).
  - No game implements `onPlayerRemoved` (grep finds nothing in `games/*/src/lib/server/definition.ts`).
- **Issue:**
  - A socket can belong to several rooms at once. For example, after spectating room B it still holds `playerId` X from room A and stays in A's socket.io rooms.
  - A socket that drops and recovers between 60 s and 120 s keeps `socket.data.{roomCode,playerId}` and its room memberships, even though `RoomManager` has already removed the player and deleted the token. That socket goes on receiving the room's broadcasts.
  - Because no engine removes the seat, the socket can keep sending `game:action` as that playerId.
  - Separately, a socket that spectated B and then reconnected as a player in A is still in `spectatorToRoom`. On disconnect it is treated as a spectator, so the player seat never greys out.
- **Repro:** Code-reading (timing not exercised). Drop the network for about 90 s, then come back. `socket.recovered` is true, `rebindSocket` returns false, and the socket stays subscribed to room A and keeps acting as a seat the lobby considers gone.
- **Suggested fix (core):**
  - Before join, spectate or reconnect, leave the previous `roomCode` and `playerId` rooms and remove the socket from spectator maps.
  - When `rebindSocket` fails, clear `socket.data` and leave the rooms.
  - Keep `recoveryDurationMs` at or below `graceMs`.
  - Have games implement `onPlayerRemoved`.

### D-06 CORS is `'*'` in production, and WebSocket connections are never origin-checked
- **Severity:** low
- **Location:**
  - `packages/multiplayer/src/server.ts:24-33,54`: the fallback is `'*'`.
  - `k8s/deployment.yaml:25-29`: `CORS_ORIGIN` is not set, so production uses `'*'`.
  - `apps/parlor/server/index.ts:11`
- **Issue:**
  - The production deployment always gets `origin: '*'`.
  - Socket.io's `cors` option only governs HTTP long-polling. WebSocket upgrades are not checked unless `allowRequest` validates the `Origin` header. `live.mts` connected with `Origin: https://evil.example` over websocket and was fully functional.
  - There are no cookies or credentials, so a cross-site socket gains no privilege. But any third-party page can make its visitors' browsers run D-01 enumeration or griefing from many IPs.
- **Suggested fix (core):**
  - Fail closed when `NODE_ENV=production` and `CORS_ORIGIN` is unset.
  - Add `allowRequest` that checks `req.headers.origin` against the same allowlist.
  - Set `CORS_ORIGIN=https://parlor.whatsdoom.com` in `k8s/deployment.yaml`.

### D-07 Raw exception messages are returned to clients
- **Severity:** low
- **Location:**
  - `packages/multiplayer/src/lobbyHandlers.ts:101,142,168,191,225,258,285,301,326,350`
  - `apps/parlor/src/lib/server/socketServer.ts:124`
  - The `catch` block in every game's `definition.ts`: `games/crazy-eights/src/lib/server/definition.ts:152-155`, `games/kings-corner/src/lib/server/definition.ts:243-246`, `games/liars-dice/src/lib/server/definition.ts:279-282`, `games/quixx/src/lib/server/definition.ts:338-340` and `games/booty-dice/src/lib/server/definition.ts:327-329`.
- **Issue:**
  - `err.message` from any exception is emitted as-is. Malformed payloads leak internal shapes: `playCard(pid, undefined)` produced "Cannot read properties of undefined (reading 'suit')" (`err.mts`).
  - The engines' deliberate messages reveal only the caller's own state; for example, Quixx `QuixxEngine.ts:127` echoes the caller's own sheet value. No engine message reveals hidden state, and no stack traces are sent.
- **Suggested fix (core):** Throw a `GameRuleError` class for user-facing messages and send only those. Log anything else server-side and send a generic "Invalid action".

### D-08 The container runs as root and ships the source and the tsx runtime; no k8s securityContext
- **Severity:** low
- **Location:**
  - `Dockerfile:17-33`: no `USER`, `src/` is copied, and the app starts with `node --import tsx`.
  - `k8s/deployment.yaml:19-36`: no `securityContext`, no `automountServiceAccountToken: false`, a mutable `:main` tag with `imagePullPolicy: Always`, and no NetworkPolicy.
  - Resource requests and limits are set correctly.
- **Issue:**
  - Any RCE in the Node process (dependency or prototype-pollution class) runs as uid 0, with a writable root filesystem, Linux capabilities and the service-account token.
  - The `.dockerignore` correctly excludes `.env*` and `.git`.
- **Suggested fix:**
  - Add `USER node` (the alpine image ships it).
  - Precompile `server/index.ts` so that `src/` and `tsx` are not needed at runtime.
  - Set the pod or container `securityContext` to `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` and `seccompProfile: RuntimeDefault`.
  - Set `automountServiceAccountToken: false`.
  - Deploy by `sha-` tag or digest.

### D-09 Workflows lack top-level `permissions` and actions are not SHA-pinned
- **Severity:** low
- **Location:**
  - `.github/workflows/ci.yml` (no `permissions:` key)
  - `.github/workflows/docker-publish.yml:14-16`: the `ci` job inherits the default token scope. Only `build-and-push` is scoped, to `contents: read` and `packages: write`.
  - All `uses:` lines are pinned to tags like `@v4` or `@v3`.
- **Issue:**
  - If the repo's default workflow permission is read/write (the legacy default), CI steps, including third-party actions and `pnpm install` lifecycle scripts, run with a write token on pushes to main.
  - Moving tags is a supply-chain risk.
  - PRs use `pull_request`, not `pull_request_target`, so fork PRs are read-only.
- **Suggested fix:** Add `permissions: contents: read` at the top of both workflows, and pin actions to commit SHAs (with Dependabot to update them).

### D-10 Player names are unbounded and not normalized on the server
- **Severity:** low
- **Location:**
  - `packages/multiplayer/src/lobbyHandlers.ts:31-33,81-88,108-113`: only non-empty and `trim` are checked.
  - `packages/multiplayer/src/RoomManager.ts:113-116`: the uniqueness check is `toLowerCase` only.
  - The only length limit is client-side, `maxlength="20"` (`apps/parlor/src/routes/+page.svelte:181,247`).
- **Issue:**
  - A raw client can send names up to the 1 MB socket.io buffer, with control, bidi-override or homoglyph characters. For example, a Cyrillic "Аlice" sits beside "Alice", which enables impersonation in chat-free social games.
  - Large names are re-broadcast in every `lobby:state` and `game:state`.
  - Rendering is text-only (no `{@html}`), so there is no XSS.
- **Suggested fix (core):** On the server, NFKC-normalize names, strip control and bidi characters, cap the length at about 20, and compare normalized forms for uniqueness. (This overlaps with audit A.)

### D-11 The Liar's Dice bot is handed every player's dice
- **Severity:** low
- **Location:** `games/liars-dice/src/lib/server/definition.ts:68-80`, which passes `engine.getState()` to `aiPlayer.takeTurn`, and `games/liars-dice/src/lib/server/ai/AIStrategy.ts:16-17`.
- **Issue:**
  - `getState()` contains all hidden dice. Today the strategy reads only `me.dice` and counts, so bots don't cheat.
  - Nothing enforces that, and a future strategy change could silently make bots omniscient.
  - Kings Corner already does the right thing, using `getPlayerView(botId)`. Quixx and Booty Dice have no hidden information.
- **Suggested fix (per-game):** Pass `engine.getPlayerView(botId)` to the AI, matching Kings Corner.

---

## Coverage

- **Read in full:**
  - `packages/multiplayer/src/RoomManager.ts`, `lobbyHandlers.ts`, `server.ts`, `utils.ts`, `client.ts` and `gameDefinition.ts`
  - The reconnect section of `clientRuntime.ts`
  - `packages/game-types/src/index.ts`
  - `apps/parlor/src/lib/server/socketServer.ts`, `gameRegistry.ts` and `apps/parlor/server/index.ts`
  - Every `games/*/src/lib/server/definition.ts`
  - The full Liar's Dice engine
  - The view functions of the Crazy Eights, Kings Corner, Quixx and Booty Dice engines
  - The standalone `socket/socketServer.ts` and `server/index.ts` files
  - `Dockerfile`, `.dockerignore`, `k8s/*.yaml` and both workflows
- **Grepped:**
  - All `.svelte` files for `{@html}`, `innerHTML` and dynamic attributes
  - All `Math.random` uses
  - `localStorage`
  - Every emit in `games/*/src/lib/server`
- **Verified empirically:**
  - View cleanliness for the three hidden-information games (randomized engine fuzz, 0 leaks)
  - The room-code enumeration rate
  - Websocket access from a foreign Origin
  - Spectator `nextRound`
  - Token reuse with concurrent sockets
  - Wrong-token rejection
  - `err.message` leakage
- **Not verified:**
  - D-03: the Math.random state-recovery attack was not run.
  - D-05: the 60–120 s recovery timing was read from code only, not exercised.
- **Not examined in depth:**
  - Game UI components beyond the XSS sink grep
  - `vite.config.ts` dev servers, which use the same options
  - The internals of each engine's per-action validation (area A)


# Audit E: Contract & resource bounds

Branch `paul-schwendenman/core-hardening-phase-0` @ 2cba304, audited 2026-11-25. Read-only.
Throwaway probes: `scratchpad/rm/probe.ts`, `scratchpad/rm/mem.ts` and `scratchpad/rm/stale.ts`. Each one runs a copy of `RoomManager.ts` under `node --experimental-transform-types`.

## Cast inventory (server/core path, plus the one client router)

`pnpm lint` now reports **5** `as unknown as` warnings, not the 10 the plan lists. The Phase 0 `--fix` removed the other five. All five remaining ones are the action cast in the games. Grep found no `as any` on the server path.

| file:line | cast | why it exists | removable by a typed contract? |
|---|---|---|---|
| games/booty-dice/src/lib/server/definition.ts:263 | `rawAction as unknown as BootyDiceAction` | `ServerGameDefinition.handleGameAction` takes `Record<string, unknown>` | Yes. `ServerGameDefinition<Action>` + schema parse in core |
| games/crazy-eights/src/lib/server/definition.ts:124 | `as unknown as CrazyEightsAction` | same | Yes |
| games/kings-corner/src/lib/server/definition.ts:213 | `as unknown as KingsCornerAction` | same | Yes |
| games/liars-dice/src/lib/server/definition.ts:245 | `as unknown as LiarsDiceAction` | same | Yes |
| games/quixx/src/lib/server/definition.ts:284 | `as unknown as QuixxAction` | same | Yes |
| games/crazy-eights/.../definition.ts:41,48,77,84,108 | `view as never` (5) | `'game:state'` is typed `(state: BaseGameState)`, but no game's view matches it | Yes. Use a generic `game:state<View>` or `unknown` plus a typed per-game emitter |
| games/quixx/.../definition.ts:139,146,183,191,204,210,268 | `as never` (7) | same | Yes |
| games/quixx/src/lib/server/game/botController.ts:38,45 | `as never` (2) | same (duplicate broadcastViews) | Yes |
| games/booty-dice/.../definition.ts:34,43,51,167,175,247 | `as never` (6) | same | Yes |
| games/liars-dice/.../definition.ts:31,38,177,184,229 | `as never` (5) | same | Yes |
| games/kings-corner/.../definition.ts:30,37,163,170,197 | `as never` (5) | same | Yes |
| packages/multiplayer/src/RoomManager.ts:294 | `room?.gameData as T` inside `getGameData<T>()` | `gameData: unknown`; the generic is an unchecked cast that every game relies on (`getGameData<CrazyEightsEngine>` etc.) | Yes. Use a typed per-definition store, or a brand/instance check against the engine the definition created |
| packages/multiplayer/src/RoomManager.ts:380 | `spectatorToRoom.get(socketId)!` | guarded by `.has()` on the line above | Safe; trivially removable |
| games/crazy-eights/.../CrazyEightsEngine.ts:56,187,353; kings-corner/.../KingsCornerEngine.ts:56,107,297; liars-dice/.../LiarsDiceEngine.ts:184,185,270,416 | `!` on pop/find/get | engine invariants, all guarded by a length check or by game logic | Out of the core contract; fine |
| apps/parlor/src/lib/components/games/GameRenderer.svelte:21,23,25,27,29 | `view as any` (5) | the client runtime stores the view as `unknown`; every GameView expects its own view type | Yes. A discriminated `{gameId, view}` union, or have each game export a `parseView` |

Totals: 35 `as never`, 5 `as unknown as`, 5 `as any`, 1 unchecked generic cast at the core (`getGameData<T>`), and 1 `!` at the core. A typed `ServerGameDefinition<State, Action, View>` removes all of them except the engine `!`s.

## Dead/legacy types (`packages/game-types/src/index.ts`)

Searched across `apps/`, `games/` and `packages/`, excluding `dist`, `build` and `.svelte-kit`.

| symbol | used anywhere? | where |
|---|---|---|
| `room:create` (C→S) | **No** | declared only |
| `room:join` (C→S) | **No** | declared only |
| `room:leave` (C→S) | **Server only**. Handled at `lobbyHandlers.ts:330` and tested at `lobbyHandlers.test.ts:204`, but **no client ever emits it**. There is no "leave" UI; seats only free up when the 60s grace expires. | Live handler, dead on the client. Keep it (rename to `lobby:leave`) and wire up a UI, or delete it |
| `game:start` (C→S) | **No** | declared only |
| `chat:send` (C→S) | **No** | declared only |
| `chat:message` (S→C) | **No** | declared only |
| `room:updated` (S→C) | **No** | declared only |
| `player:joined` (S→C) | **No** | declared only |
| `player:left` (S→C) | **No** | declared only |
| `Room` interface | **No** | only referenced by the dead `room:*` events |
| `RoomStatus` type | **No** | `GameRoom.status` redeclares the literal union inline |
| `BaseGameState` | **Type only**. It's the payload type of `game:state`, so every emitter casts to `as never` | It has no fields in common with any real view. Replace it |
| `ChatMessage` | **No** | only referenced by `chat:message` |
| `lobby:create` 3rd param `gameId?` | **No**. The server handler ignores it (`lobbyHandlers.ts:78`); the client sends `lobby:selectGame` after creating (`clientRuntime.ts:288`) | dead param |
| `lobby:playerJoined`, `lobby:playerLeft` (S→C) | Emitted (`lobbyHandlers.ts:43,135,340`), **no listener anywhere** | redundant with `lobby:state` |
| `lobby:spectate` (C→S) | Server handler only; **no client emits it** | Spectating can't be reached from any shipped UI, but any custom client can reach it (see E-06) |
| `GameRoom.status` value `'finished'` | **Never assigned** (`RoomManager.ts:195,204` set only `playing`/`waiting`) | dead state. Finished games stay `'playing'` |
| `createGameServer` + `GameServerOptions.maxPlayersPerRoom` (`server.ts:155-179`) | **Unused**. `maxPlayersPerRoom` is also ignored inside it | dead export |
| `client.ts` `createRoom()` / `joinRoom()` helpers (`client.ts:62-80`) | **Unused** (the runtime emits directly) | dead exports |
| `GameEngine.getStateForBroadcast()` (booty-dice `GameEngine.ts:56`) | **Unused** | dead, see E-09 |
| crazy-eights `roomTimers` / `cleanupRoomTimers` (`definition.ts:17-29`) | Map is never `.set()` | dead copy-paste |
| `@parlor/multiplayer` root `index.ts` re-exports client code (`createGameClient`, session helpers) | Server imports pull `socket.io-client` into the server graph | hygiene |

---

## E. Contract & resource bounds

### E-01 One socket can create (or join) unlimited rooms; every room but the last becomes immortal
- **Severity:** critical
- **Location:** packages/multiplayer/src/RoomManager.ts:103, :131 (`socketToPlayer.set` overwrites); RoomManager.ts:393 (`handleDisconnect` resolves only the latest player); lobbyHandlers.ts:78-103, :105-146 (no "already in a room" check, no rate limit)
- **Issue:**
  - `lobby:create` and `lobby:join` never check whether the socket already holds a seat. Each call overwrites `socketToPlayer[socket.id]`, so earlier seats lose their socket binding.
  - When the socket disconnects, only the last seat gets a grace timer. Every earlier seat keeps `connected: true` forever and never expires, so its room is never destroyed.
  - The socket also stays `socket.join()`ed to every earlier room, so it receives every broadcast from all of them.
- **Repro:** `probe.ts` creates 5 rooms from `sockA`, then disconnects, then waits past the grace period. Result: 4 rooms survive and each host shows `connected: true`. The same happens with `lobby:join` into other people's rooms:
  - Each victim lobby gets a permanent "connected, not ready" ghost seat.
  - `canStartGame` is false forever, and the host has no way to kick a human.
  - Joining every live code is a cheap way to grief every lobby.
- **Suggested fix (core):**
  - In `lobby:create` and `lobby:join`, reject the request (or `leaveRoom` the old seat first) when `socket.data.playerId` or `socketToPlayer.has(socket.id)` is set.
  - Track `socketId → Set<playerId>` defensively, or better, enforce one seat per socket.
  - Add a per-socket rate limit (area A).

### E-02 No cap on total rooms; code-space exhaustion is an infinite loop
- **Severity:** critical (reachable trivially through E-01; even without E-01 it is unbounded)
- **Location:** packages/multiplayer/src/RoomManager.ts:72-76; packages/multiplayer/src/utils.ts:1-9
- **Issue:**
  - `createRoom` loops `while (this.rooms.has(code)) code = generateRoomCode()`. There's no attempt limit and no cap on the number of rooms.
  - The code space is 32^4 = 1,048,576.
  - At 100% full the loop never ends, and the single-threaded process hangs. Health checks still pass, because `/healthz` only answers once the event loop is free, and by then it's too late.
  - Before that point, memory runs out first.
- **Repro:** `mem.ts` measured the following (synthetic, in-process):
  - About 1.76 KB of heap per minimal room (100k rooms ≈ 176 MB).
  - It created 1,000,299 rooms in about 3s, leaving 48,277 free codes.
  - A loop of `lobby:create` reaches about 1.8 GB of immortal rooms (E-01) and OOMs the container. With a bigger heap, it reaches exhaustion and hangs instead.
  - With 1 MB names (E-03), roughly 1,000 calls is enough to OOM.
- **Suggested fix (core):**
  - Add a `maxRooms` option (reject `lobby:create` with "Server full").
  - Bound the collision loop, e.g. 20 tries, then fall back to a longer code or an error.
  - Add caps per IP and per socket (E-05).

### E-03 Player name length and charset are unbounded
- **Severity:** high
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:31-33 (`isNonEmptyString` is the only check), :88, :113; RoomManager.ts:113-124
- **Issue:**
  - Names are only `trim()`med, so up to `maxHttpBufferSize` (1 MB default) is accepted.
  - Control, zero-width and RTL characters are all accepted.
  - The uniqueness check runs on the trimmed name, but `joinRoom` stores `name` (already trimmed by the handler). That's fine, but invisible characters still allow look-alike duplicates.
  - The name is re-broadcast in full in every `lobby:state` to every room member (every ready toggle, join or disconnect), and embedded in every game view.
  - booty-dice and liars-dice also copy it into each `gameLog` message, and the whole log is sent in every view (see E-09).
- **Repro:** `probe.ts` stored a name of 1,000,000 characters. In a 6-seat booty-dice room, each action then re-sends N log entries × 6 players × the full log, where each entry contains the name. That's megabytes per action.
- **Suggested fix (core):**
  - Normalize names (NFKC), strip control and zero-width characters, and cap them at about 24 characters in `lobbyHandlers` before they reach the RoomManager.
  - Lower `maxHttpBufferSize` (area A).

### E-04 A reconnect while the old socket is still alive evicts the live player 60s later (and can move the host)
- **Severity:** high
- **Location:** packages/multiplayer/src/RoomManager.ts:434-454 (`handleReconnect` adds the new socket without unbinding the old one), :393-413 (`handleDisconnect` marks the player disconnected without checking for other live sockets), :362-371 (expiry only checks `player.connected`)
- **Issue:**
  - After `player:reconnect` on socket B, socket A (stale, waiting on ping timeout) still maps to the same player.
  - When A finally drops, the player is marked `connected = false` and a grace timer starts, even though B is live.
  - Sixty seconds later the player is removed, the host is reassigned, and `lobby:playerLeft` is emitted. Meanwhile `socketToPlayer[B]` still points at the removed player.
  - This is also a resource issue: stale socket→player entries survive the player.
- **Repro:** `stale.ts` runs: create room on `old` → `handleReconnect(..., 'new')` → `handleDisconnect('old')`. Results:
  - `retained=true`, then the `EXPIRED` outcome fires with `newHostId` set.
  - The host is no longer in the room, but socket `new` still maps to them.
  - In real life this happens on a mobile network switch: the old socket lingers for about 45s (ping 25s + timeout 20s), and the client reconnects sooner.
- **Suggested fix (core):**
  - Keep `playerId → currentSocketId`.
  - In `handleReconnect` and `rebindSocket`, delete the previous socket's mapping (and optionally `disconnectSockets` it).
  - In `handleDisconnect`, ignore a socket that is no longer the player's current socket.

### E-05 No caps on sockets per IP/connection count, and connection-state-recovery buffers are unbounded by count
- **Severity:** high
- **Location:** packages/multiplayer/src/server.ts:53-65 (no `maxHttpBufferSize`, no connection middleware); apps/parlor/server/index.ts:11
- **Issue:**
  - There's no `io.use()` middleware, no per-IP connection count, and no global socket cap.
  - `connectionStateRecovery` (2 min) keeps a session and its missed-packet buffer for every dropped socket in the in-memory adapter. Connect/disconnect churn grows that buffer without bound for 2 minutes at a time.
  - This combines with E-01 and E-02: one IP can open thousands of sockets.
- **Repro:** (unverified load test) open N sockets from one IP, each calling `lobby:create`, then disconnect. Rooms, recovery sessions and grace timers all scale with N, and nothing pushes back.
- **Suggested fix (core):**
  - Add an `io.use` middleware with a per-IP connection cap, using `socket.handshake.address` or the `X-Forwarded-For` header (only trusted behind the proxy).
  - Add a global `maxConnections`, and a token bucket per socket.

### E-06 Spectator bookkeeping leaks; a player who spectates becomes an immortal ghost; no spectator cap
- **Severity:** medium (no shipped UI emits `lobby:spectate`, but any raw client can)
- **Location:** packages/multiplayer/src/RoomManager.ts:236-243 (`addSpectator` doesn't remove a previous spectatorship and doesn't check whether the socket is a player), :379-391 (`handleDisconnect` takes the spectator branch first), :329-336 (`destroyRoom` doesn't clear `spectatorToRoom`); lobbyHandlers.ts:148-171
- **Issue:**
  1. When one socket spectates room A and then B, `spectatorToRoom` points only to B. A's `spectators` Set keeps the socket id forever, and the socket stays joined to A's channel and keeps receiving A's views.
  2. When a seated player spectates any room, their disconnect is treated as a spectator disconnect (returns `retained: false`). The seat stays `connected: true` with no grace timer, so the room becomes immortal (same effect as E-01).
  3. There's no cap on spectators per room, and each one costs an emit per broadcast.
  4. `destroyRoom` leaves `spectatorToRoom` entries pointing at a dead room code. If that code is reused later, those entries alias the new room.
  5. Spectating overwrites `socket.data.roomCode` while keeping `socket.data.playerId`. After that, `lobby:ready` sets readiness in the player's real room (`setPlayerReady` uses `playerToRoom`) but broadcasts `lobby:state` to the spectated room.
- **Repro:** `probe.ts` showed:
  - After spec spectates A and B and then disconnects, A's spectators are `['spec']` and B's are `[]`.
  - After player `p1` spectates room A and disconnects, `retained=false` and `connected=true`.
- **Suggested fix (core):**
  - Enforce one role per socket: reject `lobby:spectate` if the socket is seated, and remove the previous spectatorship.
  - Clear `spectatorToRoom` in `destroyRoom`.
  - Cap spectators per room (e.g. 20).

### E-07 `selectGame` doesn't enforce the new game's `maxPlayers` (or `supportsBots`) against current occupants; the UI then shows the wrong reason
- **Severity:** medium
- **Location:** apps/parlor/src/lib/server/socketServer.ts:119-120; packages/multiplayer/src/RoomManager.ts:166-171, :183-189; apps/parlor/src/routes/lobby/[roomCode]/+page.svelte:51-54, :198-207
- **Issue:**
  - `setMaxPlayers` lowers the cap even when more players are already seated. `canStartGame` then returns false (`size > maxPlayers`), so start is blocked rather than corrupted.
  - The client hint falls through to "Waiting for all players to ready up", and nobody can kick a human. Only bots can be removed, and `room:leave` has no UI.
  - The lobby stays stuck until someone closes their tab and their 60s grace expires.
  - Clearing the selection (`gameId === null`, :100-104) doesn't restore the default cap of 8. After choosing Kings Corner (4) and pressing "Change", the room stays capped at 4.
  - The default cap of 8 (`RoomManager.ts:72`) is higher than every game's max (4-6), so the over-capacity state happens under normal play.
- **Repro:** `probe.ts` showed that with 6 players all ready, `canStart` is true. After `setMaxPlayers(5)` there are still 6 players and `canStart` is false. In the app: 6 friends join → host picks Quixx (max 5) → Start is disabled with a misleading hint.
- **Suggested fix (core):**
  - Have `lobby:selectGame` reject a game whose `maxPlayers` is below the current player count (or whose `supportsBots` is false while bots are seated), and return the reason through the ack.
  - Disable those games in the picker.
  - Restore the default cap when the selection is cleared.

### E-08 Start preconditions (game selected, `minPlayers`, `supportsBots`) are enforced only by the client
- **Severity:** medium
- **Location:** packages/multiplayer/src/RoomManager.ts:183-197 (hard-coded `< 2`, ignores `meta.minPlayers`, ignores `gameId`); lobbyHandlers.ts:197-228 (`addBot` ignores `meta.supportsBots`), :263-287; apps/parlor/src/lib/server/socketServer.ts:41-46 (`onGameStart` returns silently when `gameId` is null); lobby `+page.svelte:51-54` (the only place the checks exist)
- **Issue:**
  - `lobby:startGame` with no game selected sets `status='playing'` and emits `lobby:gameStarting`, but no engine is created. Everyone is routed to the "Unknown game type" screen and joins are refused ("Game already in progress") until the host resets.
  - Bots can be added to and started in crazy-eights, which has no bot driver, so the game stalls forever on the bot's turn.
  - `minPlayers` is declared on every `GameMeta` but never read on the server. It only works today because every game uses 2.
- **Repro:** A host with a modified client (or a race: "Change" then "Start") emits `lobby:startGame` with `gameId` null. The room gets stuck in `playing` with no `gameData`.
- **Suggested fix (core):** Move start validation into the core. The lobby layer should receive the selected definition's `meta` (as a `canStart(room, meta)` hook) and check that:
  - a gameId is set
  - `minPlayers ≤ n ≤ maxPlayers`
  - no bots are seated unless the game has `supportsBots`
  - every player is ready

  Have `addBot` check `supportsBots` too.

### E-09 Game logs grow without bound and are re-sent in full on every view; booty-dice re-broadcasts once per new log entry
- **Severity:** medium
- **Location:** games/booty-dice/src/lib/server/definition.ts:21-54; games/booty-dice/src/lib/server/game/GameEngine.ts:46-58, :290-297; games/liars-dice/src/lib/server/game/LiarsDiceEngine.ts:56-123, :423-430
- **Issue:**
  - Both dice games push to `state.gameLog` with no cap.
  - `getPlayerView`/`getSpectatorView` spread the whole log (booty via `...state`, liars via `[...gameLog]`) into every view, for every player, on every broadcast.
  - booty-dice's `broadcastViews` emits the *full identical view* to every human once **per new log entry**. It was evidently meant to send log deltas: `getStateForBroadcast()` strips `gameLog` but is never called.
  - Per action, booty-dice costs O(newEntries × players × logLength) in bytes and in calls to `getPlayerView`.
  - liars-dice calls `getNewLogEntries()` only to advance a cursor and throws the result away.
- **Repro:** In a 6-player booty-dice game, a turn summary adds several entries, so each human receives the same snapshot k times, and each snapshot holds the whole log. Late in the game the payload is already big and keeps growing. Long names (E-03) multiply this.
- **Suggested fix:**
  - Core: a `broadcast(roomCode)` helper that emits exactly once per human or spectator.
  - Per game: cap the log (e.g. last 50) or send deltas through a separate event.

### E-10 No game implements `onPlayerRemoved`; kings-corner looks up bots by lobby index, which drifts from the engine seat order after a removal
- **Severity:** high
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:45-48 (the only caller); none of the 5 `games/*/src/lib/server/definition.ts` define it; games/kings-corner/src/lib/server/definition.ts:50-53
- **Issue:**
  - The contract makes `onPlayerRemoved` optional and gives it no default. All five games ignore it, so a player removed after grace expiry stays seated in the engine forever.
  - kings-corner then resolves "is the active seat a bot?" with `roomManager.getPlayersInRoom(roomCode)[engine.getActivePlayerIndex()]`. Lobby order shifts left after a removal, but engine order doesn't.
  - When the turn reaches a bot, lobby[i] is a human, so the AI is never scheduled and **the game stalls**.
  - Conversely, a bot can be triggered out of turn. Its engine calls throw and are swallowed, and the 30s fallback runs `handleDisconnect(botId)`.
  - Engines also hold the seat list as a copy, and the contract has no API for "forfeit this seat".
- **Repro:** In kings-corner, seats are [Human1, Bot1, Human2]. Human1 closes the tab, and after 60s they're removed from the lobby. The lobby is now [Bot1, Human2] while the engine still has 3 seats. When the turn reaches engine index 1 (Bot1), lobby[1] is Human2, so the bot never moves.
- **Suggested fix:**
  - Core: make `onPlayerRemoved` required in a typed contract, or give it a default that ends the game.
  - Per game: implement seat forfeit.
  - kings-corner: use engine seat data (`isBot`) like the other games do, not the lobby index.

### E-11 Duplicated per-game plumbing that the core should own, with copies that diverge into latent bugs
- **Severity:** medium (the divergences are real bugs; the duplication itself is low)
- **Location:** games/*/src/lib/server/definition.ts (1,364 lines total), games/quixx/src/lib/server/game/botController.ts:28-48
- **Issue:** How much is duplicated:
  - **6** named `broadcastViews` copies. quixx has two: `definition.ts:129` and `botController.ts:28`.
  - **6** inline copies of the same loop (each `onGameStart`, plus quixx's auto-roll at `definition.ts:201-212`).
  - **35** `emit('game:state', … as never)` sites.
  - **5** `handleGameAction` bodies, each with the same prelude (`roomCode`/engine lookup → cast → `switch` → `try/catch` → `socket.emit('error', err.message)`).
  - **3** copies of the AI-turn loop (`Promise.race` with a 30s timeout), in booty, liars and kings.
  - **22** raw `setTimeout`/`setImmediate` sites across definitions and bot code.
  - **3** separate module-level timer maps.

  Divergences that are latent bugs:
  - **Reset cleanup:**
    - quixx clears `roomTimers` and `botTimers` but not its untracked timeouts (`definition.ts:115,197`, `botController.ts:159`).
    - crazy-eights clears a map it never fills.
    - booty, liars and kings clear **nothing**: their AI and 3s next-round timers keep acting on the captured old engine after reset or room destruction, and emit stale `game:state` to the room (overlaps area C).
  - **Engine connected flag:**
    - crazy-eights and kings call `engine.handleDisconnect/handleReconnect`.
    - quixx and liars expose `connected` in views, but it's never updated (always `true`), so their UIs can't grey out a disconnected seat.
    - booty and liars don't call `handleReconnect` at all.
  - **Bot identity:** kings uses the lobby index plus the `bot-` prefix (E-10). The others use engine flags (`isBot` / `isAI`).
  - **AI timeouts:** the 30s `setTimeout` is never cleared after the race resolves, so one pending timer is left per AI turn (booty `:100`, liars `:74`, kings `:73`). kings also builds a new `AIPlayer` each turn, where the others use a singleton.
  - **Turn and payload checks:**
    - only booty-dice validates payloads (`validation.ts`) and checks "your turn" in the handler
    - quixx checks only on `roll-dice`
    - the others rely on the engine
  - **Log handling:** see E-09.
- **Repro:** Liar's Dice with a bot: the bot challenges, which schedules `startNextRound` in 3s. The host hits "Back to lobby" (reset) and picks a new game within 3s. The old timer fires on the old engine and broadcasts a liars-dice `game:state` into the room that is now playing the new game. The client GameRenderer casts it `as any` into the new GameView (unverified at the UI level).
- **Suggested fix (core):** This is Phase 3.1 + 3.2:
  - `ServerGameDefinition<State, Action, View>` exposing `getPlayerView` / `getSpectatorView`, with a core `broadcast()` helper
  - a core action router (validate, then look up the engine, then dispatch inside try/catch)
  - `roomManager.schedule()` for every timer
  - a shared bot-turn driver

### E-12 Abandoned-room cleanup gaps: no room lifetime or idle TTL; ghost games continue after destruction
- **Severity:** medium
- **Location:** packages/multiplayer/src/RoomManager.ts:301-336 (rooms are destroyed only when the last human is removed); games/quixx/src/lib/server/game/botController.ts:50-173; games/booty-dice/src/lib/server/definition.ts:56-142; games/liars-dice/src/lib/server/definition.ts:43-153
- **Issue:** What works:
  - A room whose humans are all in grace is cleaned up correctly (each timer expires, and the last one destroys the room).
  - A bot-only room is destroyed as soon as the last human goes.

  What's missing:
  - There's no TTL. A room with one tab left open (kiosk or TV) lives forever, and so does any E-01 or E-06 ghost.
  - Games never reach `'finished'`, so there's no "finished for X minutes" sweep.
  - `destroyRoom` has no callback to the game layer. quixx, booty and liars bot loops capture the engine and keep running bot-vs-bot to game end after the room is gone, using timers and CPU and emitting to empty channels. kings stops, because its lookup goes through `getPlayersInRoom`, which returns `[]`.
- **Repro:** (reasoned; timers are untracked) Start booty-dice with 1 human and 5 bots, then close the tab. After 60s the room is destroyed, but the AI chain (`setImmediate` → `handleAITurn` → `handleEndTurn`) keeps playing until someone wins.
- **Suggested fix (core):**
  - Add `onRoomDestroyed` and cancel room-scoped timers (Phase 3.2).
  - Add an idle/lifetime sweeper (e.g. destroy rooms with no human socket activity for 2h, or `createdAt` older than 24h).
  - Set `status='finished'` on game over.

### E-13 Bot naming and cap hygiene
- **Severity:** low
- **Location:** packages/multiplayer/src/lobbyHandlers.ts:195-212; RoomManager.ts:63, :135-151
- **Issue:**
  - Bots are capped only by `maxPlayers`, which is 8 before a game is selected. Only 4 `BOT_NAMES` exist, so bots 5-7 get duplicate names.
  - `addBot` doesn't check whether a human already uses that name. `joinRoom` enforces uniqueness for humans only.
  - `botCounter` is process-global (harmless).
- **Repro:** Add 5 bots before choosing a game, and two of them are named "Bot Alice".
- **Suggested fix (core):** Use a per-room `maxBots` (≤ `maxPlayers - 1`) and generate unique bot names.

### E-14 Standalone servers: no behavioural drift in the reconnect, grace and validation code, but 5× scaffolding duplication and a different room cap
- **Severity:** low
- **Location:** games/*/src/lib/server/socket/socketServer.ts (5 × ~25 lines), games/*/server/index.ts (5 × 25), games/*/vite.config.ts (5 × ~42), games/*/src/lib/stores/*.ts (client stores ≈ 6 copies, now textually diverged from apps/parlor)
- **Issue:**
  - The standalone servers call the same `setupLobbyHandlers` and the same `ServerGameDefinition`, so they **do** get the reconnect, grace and recovery fixes.
  - They pass `defaultMaxPlayers: meta.maxPlayers`, so standalone rooms are capped correctly from creation. The unified app starts at 8 (E-07).
  - They have no `lobby:selectGame` and `gameId` is always null. That's harmless there because the callbacks are bound directly.
  - The unified router (`socketServer.ts:129-140`) has no try/catch, while the standalone servers call `handleGameAction` directly. Both rely on each game's own try/catch, so they behave the same (area B).
  - The connection and socket client stores are copied into every game and already differ from `apps/parlor` (all 10 `diff -q` comparisons differ). Client-side drift is the real maintenance risk here.
- **Repro:** n/a (hygiene)
- **Suggested fix:** Add a core `createStandaloneGameServer(definition)` covering the server, vite plugin and socket wiring, and a shared client-store package. Or retire the standalone servers once the unified app is canonical.

### E-15 Client↔server `game:action` and `game:state` are untyped end to end
- **Severity:** low
- **Location:** packages/game-types/src/index.ts:81, :104; apps/parlor/src/lib/components/games/GameRenderer.svelte:21-29; packages/multiplayer/src/clientRuntime.ts:41,59
- **Issue:**
  - The client emits `game:action` as `Record<string, unknown>`, so a typo in a GameView action type compiles fine and the server's `switch` drops it silently. No default branch exists, so nothing is acked.
  - Views arrive as `unknown` and are cast `as any` per game, with nothing tying `gameId` to the view shape. A stale view from the previous game (E-11) would render with the wrong component.
- **Repro:** Change `'draw-card'` to `'draw'` in a GameView. `turbo check` passes, and the button does nothing.
- **Suggested fix (core):** Generic event maps (`GameEvents<Action, View>`), an action schema shared between client and server, a `default:` branch that acks "unknown action", and a `{gameId, view}` envelope on `game:state`.

### E-16 Observability: essentially none on the core path
- **Severity:** medium (for prod operation)
- **Location:** packages/multiplayer/src/server.ts:84-90 (`/healthz` returns only `{status, uptime}`); RoomManager.ts:53-63 (all maps private, no stats accessor); lobbyHandlers.ts:100-102, :376, :405 (errors go back to the client or are swallowed, never logged); apps/parlor/server/index.ts:22
- **Issue:**
  - The core and the app server log exactly one line between them: startup. Room create/destroy, joins, reconnects, grace expiries, rejected actions and caught exceptions are all invisible to the operator.
  - Each game has only a few `console.error` calls on AI failures (14 `console.*` calls across all server paths).
  - There's no metric for room count, socket count, players, spectators, pending grace timers, or game timers.
  - There's no process-level `uncaughtException` / `unhandledRejection` logging (area B).
  - In prod, none of E-01, E-02, E-05 or E-12 would be detectable until OOM.
- **Repro:** Run the E-01 loop against prod. `/healthz` reports ok until the process dies, and nothing appears in the logs.
- **Suggested fix (core):**
  - `RoomManager.stats()` (rooms by status, players, spectators, grace timers), plus `io.engine.clientsCount`, exposed on `/healthz` or `/metrics`.
  - A structured logger (pino) injected into `setupLobbyHandlers` and the action router, tagged with roomCode, playerId and gameId.
  - Log rejected actions at debug level and caught exceptions at warn level.

---

## Coverage

- **Read in full:**
  - packages/multiplayer/src: `gameDefinition.ts`, `index.ts`, `RoomManager.ts`, `lobbyHandlers.ts`, `server.ts`, `utils.ts`, `client.ts`
  - packages/game-types/src/index.ts
  - apps/parlor: `src/lib/server/{socketServer,gameRegistry,games/index}.ts`, `server/index.ts`, `vite.config.ts`, `GameRenderer.svelte`, and the relevant parts of the lobby `+page.svelte`
  - All 5 `games/*/src/lib/server/definition.ts`, quixx `botController.ts`, all 5 standalone `socket/socketServer.ts`, `server/index.ts` and `vite.config.ts`
  - The relevant parts of the booty-dice, liars-dice and kings-corner engines and the kings-corner AIPlayer
- **Skimmed:** clientRuntime.ts (`emit`/`on` sites only); the client stores were diffed only, not read.
- **Tools run:**
  - `pnpm lint` (162 warnings; 5 `as unknown as`)
  - repo-wide greps for casts, events and symbols
  - 3 RoomManager probes that verified E-01, E-02 (sizing and near-exhaustion timing), E-03, E-04, E-06 and E-07
- **Reasoned but not executed:**
  - E-05 load
  - E-09 byte counts
  - E-10 kings-corner stall (traced from code; no live game)
  - E-11 stale-timer repro at the UI level
  - E-12 ghost bot loop
- **Not covered (other areas):**
  - payload validation details, the `maxHttpBufferSize` value, rate-limit design (A)
  - crash paths (B)
  - full timer lifecycle races (C)
  - view leaks, token and code guessability (D)
  - game rule correctness (out of scope)

