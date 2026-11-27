# Lobby Fix Plan

Started: 2026-11-27. Source: the Impeccable critique of the lobby, which scored 21/40. The full report is at `apps/parlor/.impeccable/critique/2026-11-27T15-11-04Z__src-routes-lobby-roomcode-page-svelte.md`.

Target: `apps/parlor/src/routes/lobby/[roomCode]/+page.svelte` (about 950 lines), plus `lib/components/lobby/` and the lobby handlers in `packages/multiplayer`.

## Decisions already made

- **Seats model.** Once a game is confirmed, the lobby shows **seats**, not just a list of players. If the room has fewer people than the game needs, the missing seats appear as dashed "Open seat" rows. Each one offers *Add bot* and a reminder to share the code. This replaces the current dead end where everyone is ready but nothing explains why START is off.
- **Scope: all issues.** That covers P0 to P2 plus the minor observations (copy, dead code, QR/share sheet).
- **Order.** Work through the phases in the order below. Each phase is one PR-sized unit that leaves the lobby working.

## Workflow

- **One fresh subagent per phase.** Give it this file, the critique report path, `apps/parlor/DESIGN.md` and the phase number. Don't carry context between phases; the plan and the checkboxes are the shared state.
- **UI work:** the agent runs `/impeccable` setup with `--target "src/routes/lobby/[roomCode]/+page.svelte"` (cwd `apps/parlor`) and reads `craft-floor.md` before editing. Follow the DESIGN.md rules: One Lid, Deep Clay, Shout Once, No-Eyebrow, Ink Outline, and sentence-case labels.
- **Agents never commit.** The user commits after reviewing each phase.
- **Verification for every phase:**
  - Run `pnpm check`, `pnpm lint` and `pnpm test`.
  - Drive a fresh `pnpm dev --port 3020` with Playwright. Restart the server after any `packages/multiplayer` change, because server code doesn't hot-reload reliably.
  - Take screenshots at 390x844 and 1440x900 and look at them.
  - Use separate browser contexts for extra players.
  - Use `allTextContents()` for optional elements, to avoid 30-second waits.
- **Server changes come with tests.** Any `packages/multiplayer` change gets a Vitest test. A rejected request must leave the room state unchanged, and the server must still accept a valid request afterwards.
- **After each phase:** tick the boxes, add a row to the log, and note anything deferred under "Notes" at the bottom.

---

## Phase 1: Quick fixes and cleanup (P1 sticky vote, minor issues)

Small, low-risk changes that clear the way before the bigger work.

- [x] **1.1 Sticky "Voted ✓" on touch.**
  - **Cause:** `.pill:hover:not(:disabled)` (around `:863`) comes after the pressed-state rule (`:611`) at the same specificity, so the hover fill wins on touch screens, where hover sticks after a tap.
  - **Fix:** wrap pill hover styles in `@media (hover: hover)`, as `.copy` already does (around `:473`), and make the pressed rule win regardless.
  - **Check:** the voted pill and the Add Bot pill both look right after a tap with touch emulation.
  - **Done:** Pill hover is inside `@media (hover: hover)` and wrapped in `:where()` so it can never outrank the pressed/Confirm fill; the same gating was applied to the lobby's other hover fills, the home page pills/shelf buttons and LeaveRoomButton. Checked with touch emulation: the voted pill stays espresso and Add bot stays clear after a tap. (Playwright note: a `fullPage` screenshot drops Chromium's touch emulation and flips `(hover: none)` back to hover; take viewport shots on touch pages.)
- [x] **1.2 One game catalogue.**
  - **Problem:** the lobby (`:20-30`) and the home page (`routes/+page.svelte`) both hard-code the five older games and import the four newer ones. The home page also picks spine colours by list position (`spines[i % 5]`), so a game's colour isn't fixed.
  - **Fix:** give each older game a `src/meta.ts` and a `"./meta"` export, as Hearts, Spades, Euchre and Oh Hell already have. Then add one `apps/parlor/src/lib/games/catalog.ts` that both pages import. It lists the games in order and gives each its fixed shelf colour, matching the board colours recorded in memory and in DESIGN.md "Game boards":
    - Quixx: felt
    - Crazy Eights: mustard
    - Booty Dice: clay
    - Liar's Dice: espresso
    - Kings Corner: linen
    - The four trick-taking games: pick colours and record them in DESIGN.md.
  - **Note:** this unblocks Phase 3.
  - **Done:** Older games got `src/meta.ts` + `"./meta"` exports, and their server definitions now import the same meta, so client and server can't drift. Where the three copies disagreed, the home page's copy won (Liar's Dice: description, `15-25` min, `classic` tag; the server had `15-30` and `competitive`). Trick-game colours: Hearts clay, Spades espresso (ink), Euchre felt, Oh Hell mustard. None of the four sets `--card-back` (all use the default espresso back on felt), so the choice follows the suit (red hearts, black spades) and keeps neighbouring blocks different in both the one- and two-column shelf. Recorded in DESIGN.md (Collection Rule line) and design-full.md (Game boards → Its colour, Game shelf).
- [x] **1.3 Player-count copy.** Show "4 players" when min equals max, and "2–5 players" otherwise (`:224`, `:254`). Make "Need 1 more" say "Needs 1 more player".
  - **Done:** Formatters (`playerCount`, `playerRange`, `playersNeeded`, `minutesRange`) live in `catalog.ts`; the home shelf chip now shows "4 · 25–40m" instead of "4–4".
- [x] **1.4 Sentence-case labels.** "Ready Up" → "Ready", "Not Ready" → "Not ready", "Add Bot" → "Add bot". Keep uppercase only for the one main action (START GAME), per the Shout Once rule.
  - **Done:** Also sentence-cased the home shelf "Start Game" → "Start game" and the create dialog ("Create room", "Create a Hearts room"). E2E selectors updated (`'Ready', exact: true`; `'Add bot'`).
- [x] **1.5 Delete `lib/components/lobby/GamePicker.svelte`.** Nothing imports it. Deleting it clears most of the detector's off-system colour, font-size and radius advisories.
- [x] **1.6 Tap targets.** The PARLOR wordmark (96x40) and "Leave room" (115x40) need to reach 44px tall without making the header look heavier.
  - **Done:** The wordmark link is `min-height: 44px` (lid top padding 18→16px to compensate). LeaveRoomButton is now a 44px transparent hit area holding the unchanged 40px pill, so the game-page lid padding went 10→8px and its height is unchanged (63px).
- [x] **1.7 Name length.** Check that the name field's limit matches the server's, and that 20-character names show in full or truncate deliberately with an ellipsis ("Bartholomew Fitzgera" is cut off today).
  - **Done:** The server allowed 24 characters and every input 20. Both now use `PLAYER_NAME_MAX_LENGTH = 20` from `@parlor/game-types` (server test added: 21 rejected with room unchanged, then 20 accepted). Lobby names truncate with an ellipsis and keep the full name in `title`; a 20-character "Bartholomew Fitzgera" fits in full at 390px, a 20×W name ellipsises.

## Phase 2: Seats and the start hint (P0)

The main fix. Hearts, Spades and Euchre need exactly 4 players, and Oh Hell needs 3 or more.

- [x] **2.1 Seat-count branch in `startHint`** (`:85-90`).
  - Check seat count before readiness, using `selectedGame.minPlayers` and `maxPlayers`. For example: "Hearts needs 4 players. Invite 1 more or add a bot." The too-many case already blocks start; its hint should say so too.
  - Ordering: seats, then bots the game doesn't support, then readiness.
  - **Done:** `startHint` goes seats → unsupported bots → reconnecting players → readiness. "Hearts needs 4 players. Invite 1 more or add a bot." (range games: "needs at least 3 players"); "or add a bot" drops when the game has no bots or the room is at `MAX_BOTS`. Too many: "Hearts seats 4. Remove a bot or choose another game." Readiness names up to two people ("Waiting for Joe and Ann to get ready"), else counts ("Waiting for 3 players…"). Added "Waiting for Joe to reconnect." and a "Reconnecting" role on disconnected rows, since a disconnected guest also blocks start.
- [x] **2.2 Seat rows.**
  - After a game is confirmed, show `max(players, minPlayers)` rows. Missing seats are dashed linen "Open seat" rows, styled like the current bot rows, and for the host each one has an *Add bot* button (hidden if the game has `supportsBots: false`).
  - If the room has fewer people than `maxPlayers`, add one quieter line: "Room for N more".
  - The header count shows "3 of 4" while seats are open.
  - **Done:** Open seats are `<li>`s in the same list: dashed linen row, dashed-ring avatar with the seat number, "Open seat" in Faded Ink; the host gets an outline "Add bot" pill per seat. Its accessible name is "Add bot to seat 4" rather than "Add a bot to seat 4" so the visible label stays inside the name (WCAG 2.5.3). Below the list one quiet line: "Room for N more" (everyone) or, for the host at a full table, "All 4 seats are taken" next to a disabled Add bot. Readiness chips now only show once a game is chosen and say "Not ready" instead of "Waiting". Recorded in design-full.md (Player rows, Spacing).
- [x] **2.3 Guest messaging.** Guests should see the real reason they're waiting: "Hearts needs 1 more player. Waiting for Margaret to invite someone or add a bot." That replaces the open-ended "Waiting for the host to start…".
  - **Done:** Guests see the seat / bots reason naming the host, then (once they're ready) "Waiting for Joe to get ready." or "Waiting for Margaret to start." No hint while their own Ready is the next step and nothing else blocks.
- [x] **2.4 Bots during voting.**
  - The server already allows `lobby:addBot` without a selected game. Only the client blocks it: the actions block only renders when a game is confirmed (`:328`).
  - Show *Add bot* while voting so a host on their own can fill seats first.
  - **Done:** The plan was wrong about the server: `RoomManager.addBot` refused with no game (`!room.gameRules?.supportsBots`). It now only refuses when the chosen game has `supportsBots: false` (test added). The client shows one quiet line under the player list for the host while voting: "Short on players? Bots can fill seats." + Add bot. It still sits below the nine ballot rows until Phase 3.2 moves players up. While voting, Add bot stops at the largest catalogue table (6) even though the room cap is 8.
- [x] **2.5 Add bot limits.**
  - Disable *Add bot* when the room is at `maxPlayers` or the bot limit (`MAX_BOTS = 4` in `RoomManager.ts`), and explain why inline ("Hearts seats 4").
  - Clear `botError` whenever the selected game or ballot round changes, since today it lingers after a re-vote.
  - Rewrite the server messages so they say what to do: "The room is full. Remove a bot or a player to make space."
  - **Done:** `MAX_BOTS` moved to `@parlor/game-types` so client and server share it. Disabled reasons: "Hearts seats 4, and every seat is taken." / "Rooms can have 4 bots at most. Invite someone for the next seat." / "No game here seats more than 6." `botError` now shows under the player list (next to the buttons that cause it) and clears when the selected game or ballot round changes. Server addBot messages rewritten (full, bot limit ×2, game in progress, game without bots); tests updated and added (rejections leave the room unchanged, a valid add afterwards succeeds). Join's "Room is full" was left alone.
- [x] **2.6 Host readiness.**
  - The host shouldn't need a separate "Ready" step, because pressing START already says they're ready.
  - Recommended change: `canStartGame` in `packages/multiplayer/src/RoomManager.ts` stops requiring the host to be ready, and the lobby hides the Ready button for the host.
  - Needs server tests: start succeeds when every non-host player is ready, and fails when any guest isn't.
  - **Done:** `canStartGame` requires every seat to be connected and every non-host seat ready. The host has no Ready button and no status chip ("Host" stays in the roles text). Tests in `lobbyHandlers.test.ts`: host never ready + guests ready starts; one guest not ready is rejected with the room unchanged, then starts once they ready; a ready guest who disconnects blocks start. E2E specs updated to stop clicking the host's Ready and to use "Add bot to seat N": hearts, spades, euchre, oh-hell, crazyEights, reconnect, gameOverSocket, smoke (not run here).

## Phase 3: Ballot redesign (P1 wall of options, P1 wrong leader)

Redesign the voting state. It should feel like pulling a box off the shelf, not filling in a form.

- [ ] **3.1 Fix the "Leading" summary** (`:77-82`).
  - Today it filters out games the room can't play, so Hearts on 2 votes loses to Quixx on 1. Rank all games by votes and add the constraint: "Leading · Hearts (needs 1 more player)".
  - Ties: "Tied · Hearts, Quixx".
- [ ] **3.2 Players before the ballot.** The player and seat list must be visible while voting:
  - Phone: compact avatars above the ballot.
  - Desktop: a side column.
  - Nobody should need to scroll past nine games to see who's in the room.
- [ ] **3.3 Shelf-spine rows.** Each ballot row uses its game's catalogue colour (from 1.2) and shows its description and play time. Rows should be recognisable at a glance by colour, for kids and older relatives.
- [ ] **3.4 Collapse games the room can't play.**
  - Games the room has too many players for go into a muted group at the bottom: "Not for 6 players (3)". The group can be expanded.
  - Games that need more players stay in the main list, since a bot can fix that, but show "Needs 1 more player".
- [ ] **3.5 Who voted, not just how many.**
  - Show small seat-colour avatars of the voters on each row instead of "N votes". This needs `GameBallotSnapshot` (in `packages/game-types`) to include `votes: Record<playerId, gameId>`, which is fine in a private room.
  - Label each row's count for screen readers with the game name ("Hearts: 2 votes, Margaret and Joe").
  - Add a small acknowledgement when a vote arrives, honouring reduced motion.
- [ ] **3.6 One Confirm for the host.**
  - Remove the nine per-row Confirm buttons. The host gets a single bottom main button, "Play Hearts", tied to the leading game (or the host's own vote if there's a tie), plus a way to pick any other playable game, for example a long-press or a "Play this" button inside the rules modal.
  - Guests only ever see Vote.
  - This also removes most of the "what's the difference between Vote and Confirm" confusion.
- [ ] **3.7 How the lobby works.** Add one short line under the ballot heading: "Tap to vote. Margaret picks the game." No tour, no modal.

## Phase 4: Changing games safely (P2)

- [ ] **4.1 "Vote for next game" → "Change game".**
  - Today one tap clears the confirmed game, even when everyone is ready.
  - The new flow reopens the ballot with the current game marked "Current" and leading by default, and the host can back out ("Keep Hearts").
  - Fix the label wrapping onto two lines on a phone in the green panel.
- [ ] **4.2 Readiness on reopen.** Decide whether reopening the ballot clears readiness, and say so in the UI. Test: reopen and then cancel leaves the room in exactly the state it was in before.

## Phase 5: Address-bar links (P2)

- [ ] **5.1 A pasted `/lobby/CODE` link with no session** currently shows "This lobby doesn't exist or has ended" while the room is live. Copy-link is fine because it uses `?join=`.
  - Fix: check whether the room exists. If it does, show the join-by-name prompt for that code, or redirect to `/?join=CODE`. Show not-found only when the room really is gone.
  - Needs a server check that doesn't reveal anything beyond what joining by code already reveals.

## Phase 6: Rules modal and sharing (minor)

- [ ] **6.1 Rules modal on a phone.** Pin the footer (Close / Vote) so it doesn't scroll away. Add a line for player count and bots ("4 players · bots can fill seats"). Don't put the highlighted button on "Clear vote"; a voted state should read as plain toggled state.
- [ ] **6.2 Rules jargon.** Add short inline explanations for trick-game terms ("led suit", "bags", "bowers") in the Hearts, Spades, Euchre and Oh Hell rules. These live in each game's meta or rules content.
- [ ] **6.3 QR code and native share.** `PRODUCT.md` promises a share link, a QR code and a room code.
  - Add `navigator.share` where the browser supports it, falling back to copy.
  - Add a "Show QR code" option, in a modal, for the shared-screen case.
  - Keep the header to one terracotta block (One Lid rule).

## Phase 7: Re-critique

- [ ] **7.1** Run `/impeccable critique` on the lobby again and compare against 21/40. Then run `/impeccable polish` on whatever's left.

---

## Log

| Date | Phase | Change | Commit / PR |
|---|---|---|---|
| 2026-11-27 | — | Critique run (21/40); plan written | — |
| 2026-11-27 | 1 | Quick fixes: touch-safe pill states, shared game catalogue with fixed shelf colours, player-count copy, sentence-case labels, GamePicker removed, 44px header targets, 20-char name limit shared with the server | uncommitted |
| 2026-11-27 | 2 | Seats and the start hint: open-seat rows with per-seat Add bot, "N of M" count, "Room for N more", seat-first start hint and guest copy naming the host, Add bot while voting (server now allows it), Add bot limits with inline reasons, rewritten addBot errors, host no longer needs Ready | uncommitted |

## Notes

- Detector advisories in `RulesModal.svelte` (`#B8372B`, `#2F5C8A`) may be deliberate suit or team colours. Check before "fixing" them, and if they stay, record them as tokens in DESIGN.md.
- Open question from the critique, not decided: should "Ready" exist at all for guests in a private room, replaced by START plus a short "Margaret is starting Hearts…" countdown? Revisit after Phase 2.
- Phase 1 deferrals: the standalone game apps' own `JoinForm.svelte` inputs still hard-code `maxlength="20"` (matches the server, but could import `PLAYER_NAME_MAX_LENGTH`). The "Voted ✓" label uses a Unicode glyph as an icon (craft floor); replace it during the Phase 3 ballot redesign. The trick-taking boards could set `--card-back` to their new shelf colour (design-full says a game's colour shows on its pieces); not done here. The design-full shelf spec says the solid shelf button reads "Start a room"; the UI says "Start game" — pick one. The `startHint` copy ("Need at least 2 players", "ready up") is left for Phase 2.
- Phase 2 deferrals: the voting-time Add bot line still sits under the whole ballot (Phase 3.2 moves the player list up). The plan's "reminder to share the code" on open seats was left to the hint ("Invite 1 more…"); a per-row Copy link could follow with 6.3's share work. Guests now see a "Not ready" chip on their row and a "Not ready" button below; the button could read "I'm not ready" or "Cancel ready" if that confuses anyone. While voting the client caps Add bot at 6 (largest game) but the server room cap is still 8. The bot-name pool and `MAX_BOTS` are both 4; a human named "Bot Alice" shrinks the pool and the handler's message still says 4. `joinRoom`'s "Room is full" / "Game already in progress" weren't rewritten. The open question above (does Ready exist at all for guests?) is still open; the host side is settled.
