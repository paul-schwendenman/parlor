# New Games: Build Plan (2026-11-27)

Handoff for the implementation session. Each game has an implementation-ready brief in `docs/games/`
(verified rules, Parlor name/IP, state + redacted views, actions, codebase mapping, board UI, bot, test plan,
open questions, sources). Read the brief's **Open questions** before starting a game.

| Brief | Parlor name (id) | Players | Notes |
|---|---|---|---|
| FARKLE.md | Farkle (`farkle`) | 2–6 | Untracked draft already in `games/farkle/`; brief lists what it must change |
| YAHTZEE.md | Yacht (`yacht`) | 2–6 | Never show "Yahtzee" to players; forced-Joker default |
| CANT_STOP.md | Top Out (`top-out`) | 2–4 | Climbing theme |
| GOLF.md | Golf (`golf`) | 2–6 | 6-card Golf; two decks at 5–6p, address cards by slot |
| PRESIDENT.md | President (`president`) | 4–7 | Fixed seats; "Peasant" not "Scum" |
| GIN_RUMMY.md | Gin Rummy (`gin-rummy`) | 2 | Auto meld arrangement; meld logic reusable for Rummy 500 |
| LOVE_LETTER.md | Calling Card (`calling-card`) | 2–6 | 2019 21-card deck default; classic 16-card option |
| SUSHI_GO.md | Potluck (`potluck`) | 2–5 | Simultaneous draft; tongs/gravy/pie re-theme |
| SKULL.md | Bad Apple (`bad-apple`) | 3–6 | Lost-disc identity must never leak |
| COUP.md | Cloak & Coin (`cloak-and-coin`) | 2–6 | Timed challenge/block windows; 3 FAQ rulings unverified |
| THE_MIND.md | Quiet Count (`quiet-count`) | 2–4 | Real-time; settle window for near-simultaneous plays |

Runners-up not specced: Cribbage (best next pick), Rummy 500 (build on Gin meld logic), Go Fish, Spit, Durak,
Pinochle, Old Maid, Blackjack.

## Cross-cutting issues (decide/build before or alongside the games)

1. **Per-game host options.** Every brief wants variant toggles; the lobby has no channel for them and
   `createState` takes no options. Briefs put options on the engine with defaults, so games can ship on
   defaults first. Build one shared "House rules" path (lobby UI → room → `createState(options)`) once,
   rather than per game.
2. **Shelf colours.** Nearly every brief picked linen (Kings Corner's) because the six palette colours are
   all taken by games or seat colours. Needs a palette decision (extend it, or allow sharing with a rule).
3. **Bot seat colours.** `SeatChip`/`GameOver` render all bots in one dark colour; Top Out (and any game
   colouring pieces by seat) needs bots in their own seat colours.
4. **`docs/ADDING_GAMES.md` is stale on wiring.** Home shelf and lobby picker now read from
   `apps/parlor/src/lib/games/catalog.ts`, not the page files listed in §7.
5. **Dead-connection detection.** Socket.io heartbeat (~45s to notice) stalls Quiet Count's ready-check and
   Cloak & Coin's windows. Tighten before those two.
6. **Previous winner starts** on Play again (Coup brief asks for `createState` to receive it).

## Board-kit additions (build once, in `@parlor/ui`)

- **Dice:** `DiceTray` (hold toggles, rolls-left, blank pre-roll), `rolling` prop on `PipDie`,
  `RollStopBar`. Used by Farkle, Yacht, Top Out.
- **Generic cards:** `CardFrame` (refactor `PlayingCard` onto it), generic `CardHand<T>`,
  `CharacterCard` (named + numbered), number face for The Mind. Used by Calling Card, Cloak & Coin,
  Potluck, Quiet Count, Bad Apple.
- **Standard deck:** `DiscardPile` (extract from Crazy Eights `Table.svelte`), `CardGrid` (Golf),
  `MeldSpread` (Gin Rummy).
- **Misc:** `CountdownBar` (Cloak & Coin), `GameLog` (move from Booty Dice).

## Suggested build order

Easiest/highest-reuse first; each game introduces the kit pieces the later ones lean on.

1. **Farkle**: draft exists; builds the dice kit.
2. **Yacht**: reuses the dice kit; scorecard pattern from Quixx.
3. **Golf**: simple standard-deck game; extracts `DiscardPile`, adds `CardGrid`.
4. **Top Out**: dice kit + new column board; needs bot seat colours (#3).
5. **Calling Card**: builds `CardFrame` / `CardHand<T>` / `CharacterCard`.
6. **Potluck**: generic hand; first simultaneous-pick game.
7. **President**: reuses multi-select hand; 7-player layout.
8. **Bad Apple**: hidden penalty choice; token stack.
9. **Gin Rummy**: meld/layoff solver is the main work.
10. **Cloak & Coin**: hardest turn flow (response windows, timers); after #5 for `CharacterCard`.
11. **Quiet Count**: real-time; after heartbeat fix (#5 above).

Host options (#1) can land any time; the earlier it lands, the fewer games ship defaults-only.
