# New Games: Build Plan (2026-11-27)

Handoff for the implementation session. Each game has an implementation-ready brief in `docs/games/`
(verified rules, naming/IP, state + redacted views, actions, codebase mapping, board UI, bot, test plan,
open questions, sources). Traditional games use their established names. Commercial references guide Parlor adaptations with their own names, scoring, and presentation. Read the brief's **Open questions** before starting a game.

| Brief | Parlor name (id) | Players | Notes |
|---|---|---|---|
| FARKLE.md | Farkle (`farkle`) | 2–6 | Already implemented on the starting branch |
| HARBOR_DICE.md | Harbor Dice (`harbor-dice`) | 2–6 | Five-dice scorecard with original categories |
| RIDGE_RUN.md | Ridge Run (`ridge-run`) | 2–4 | Three dice, two routes per turn, and a summit race |
| GOLF.md | Golf (`golf`) | 2–6 | 6-card Golf; two decks at 5–6p, address cards by slot |
| PRESIDENT.md | President (`president`) | 4–7 | Fixed seats; "Peasant" not "Scum" |
| GIN_RUMMY.md | Gin Rummy (`gin-rummy`) | 2 | Auto meld arrangement; meld logic reusable for Rummy 500 |
| LOVE_LETTER.md | Love Letter (`love-letter`) | 2–6 | 2019 21-card deck default; classic 16-card option |
| NIGHT_MARKET.md | Night Market (`night-market`) | 2–5 | Simultaneous draft with sell-or-display picks |
| SKULL.md | Skull (`skull`) | 3–6 | Lost-disc identity must never leak |
| COUP.md | Coup (`coup`) | 2–6 | Timed challenge/block windows; 3 FAQ rulings unverified |
| SIGNAL_RELAY.md | Signal Relay (`signal-relay`) | 2–4 | Cooperative timed antenna routing |

Runners-up not specced: Cribbage (best next pick), Rummy 500 (build on Gin meld logic), Go Fish, Spit, Durak,
Pinochle, Old Maid, Blackjack.

## Implementation checklist

- [x] Farkle — playable on the starting branch. Added engine variants and a shared dice tray and roll/bank controls.
- [x] Golf — nine-hole default, bots, shared card grid and discard pile. Verified engine, five-seat socket play, and phone browser flow.
- [x] Harbor Dice — Parlor’s five-dice scorecard adaptation. Uses ten categories, including Twin docks and Lighthouse.
- [x] Ridge Run — Parlor's push-your-luck climbing adaptation. Pair three dice, bank steps, and race to seven summit points.
- [ ] Love Letter
- [x] Night Market — Parlor's simultaneous drafting adaptation. Sell goods for coins or display them for stall points.
- [x] President — fixed seats, private card exchanges, and a shared bot and reveal scheduler. Verified engine, seven-seat socket play, and phone browser flow.
- [ ] Skull
- [x] Gin Rummy — standard rules, bot play, automatic melds and layoffs, and final bonuses. Verified engine, socket redaction, and phone browser flow.
- [ ] Coup
- [x] Signal Relay — Parlor's real-time cooperative adaptation. Clear four relays using two antennas and a shared reroute.

The commercial briefs guide mechanics for distinct Parlor adaptations. Harbor Dice, Ridge Run, Night Market, and Signal Relay fill the five-dice scorecard, push-your-luck climbing, simultaneous drafting, and real-time cooperative slots.

## Cross-cutting issues (decide/build before or alongside the games)

1. **Per-game host options.** Every brief wants variant toggles; the lobby has no channel for them and
   `createState` takes no options. Briefs put options on the engine with defaults, so games can ship on
   defaults first. Build one shared "House rules" path (lobby UI → room → `createState(options)`) once,
   rather than per game.
2. **Shelf colours.** Nearly every brief picked linen (Kings Corner's) because the six palette colours are
   all taken by games or seat colours. Needs a palette decision (extend it, or allow sharing with a rule).
3. **Bot seat colours.** `SeatChip`/`GameOver` render all bots in one dark colour; Can't Stop (and any game
   colouring pieces by seat) needs bots in their own seat colours.
4. **`docs/ADDING_GAMES.md` is stale on wiring.** Home shelf and lobby picker now read from
   `apps/parlor/src/lib/games/catalog.ts`. The wiring guide was updated with Golf.
5. **Dead-connection detection.** Socket.io heartbeat (~45s to notice) stalls The Mind's ready-check and
   Coup's windows. Tighten before those two.
6. **Previous winner starts** on Play again (Coup brief asks for `createState` to receive it).

## Board-kit additions (build once, in `@parlor/ui`)

- **Dice:** `DiceTray` supports selections and blank pre-roll slots. `PipDie` supplies the roll animation. `RollStopBar` supplies the two turn actions. Farkle uses this kit.
- **Generic cards:** `CardFrame` (refactor `PlayingCard` onto it), generic `CardHand<T>`,
  `CharacterCard` (named + numbered), number face for The Mind. Used by Love Letter, Coup,
  Sushi Go, The Mind, Skull.
- **Standard deck:** Golf and Gin Rummy share `DiscardPile`. Golf adds `CardGrid`, and Gin Rummy adds `MeldSpread`.
- **Misc:** `CountdownBar` (Coup), `GameLog` (move from Booty Dice).

## Suggested build order

Easiest/highest-reuse first; each game introduces the kit pieces the later ones lean on.

1. **Farkle**: implemented. Uses the shared dice kit.
2. **Harbor Dice**: implemented. Reuses the dice tray and automated turn scheduler.
3. **Golf**: simple standard-deck game; extracts `DiscardPile`, adds `CardGrid`.
4. **Ridge Run**: implemented. Reuses the dice kit and marks each player's route progress with their seat colour.
5. **Love Letter**: builds `CardFrame` / `CardHand<T>` / `CharacterCard`.
6. **Night Market**: implemented. Locks private simultaneous picks and reveals them together.
7. **President**: reuses multi-select hand; 7-player layout.
8. **Skull**: hidden penalty choice; token stack.
9. **Gin Rummy**: meld/layoff solver is the main work.
10. **Coup**: hardest turn flow (response windows, timers); after #5 for `CharacterCard`.
11. **Signal Relay**: implemented. Uses server deadlines and rejects stale antenna plays.

Host options (#1) can land any time; the earlier it lands, the fewer games ship defaults-only.
