# New Games: Build Plan (2026-11-27)

Implementation checklist for the November game plan. The linked briefs in `docs/games/` describe the playable games. Traditional games use their established names. The Parlor adaptations have their own names, rules, and presentation.

| Brief | Parlor name (id) | Players | Notes |
|---|---|---|---|
| FARKLE.md | Farkle (`farkle`) | 2–6 | Already implemented on the starting branch |
| HARBOR_DICE.md | Harbor Dice (`harbor-dice`) | 2–6 | Five-dice scorecard with original categories |
| RIDGE_RUN.md | Ridge Run (`ridge-run`) | 2–4 | Three dice, two routes per turn, and a summit race |
| GOLF.md | Golf (`golf`) | 2–6 | 6-card Golf; two decks at 5–6p, address cards by slot |
| PRESIDENT.md | President (`president`) | 4–7 | Fixed seats; "Peasant" not "Scum" |
| GIN_RUMMY.md | Gin Rummy (`gin-rummy`) | 2 | Auto meld arrangement; meld logic reusable for Rummy 500 |
| CIPHER_POST.md | Cipher Post (`cipher-post`) | 2–6 | Private passes and public clues |
| NIGHT_MARKET.md | Night Market (`night-market`) | 2–5 | Simultaneous draft with sell-or-display picks |
| FAULT_LINE.md | Fault Line (`fault-line`) | 3–6 | Hidden caches, public bounties, and secret openings |
| COUNCIL_LEDGER.md | Council Ledger (`council-ledger`) | 2–6 | Private permits and simultaneous timed challenges |
| SIGNAL_RELAY.md | Signal Relay (`signal-relay`) | 2–4 | Cooperative timed antenna routing |

Runners-up not specced: Cribbage (best next pick), Rummy 500 (build on Gin meld logic), Go Fish, Spit, Durak,
Pinochle, Old Maid, Blackjack.

## Implementation checklist

- [x] Farkle — playable on the starting branch. Added engine variants and a shared dice tray and roll/bank controls.
- [x] Golf — nine-hole default, bots, shared card grid and discard pile. Verified engine, five-seat socket play, and phone browser flow.
- [x] Harbor Dice — Parlor’s five-dice scorecard adaptation. Uses ten categories, including Twin docks and Lighthouse.
- [x] Ridge Run — Parlor's push-your-luck climbing adaptation. Pair three dice, bank steps, and race to seven summit points.
- [x] Cipher Post — Parlor's compact deduction adaptation. Pass a seal, expose one value, and guess what a rival kept.
- [x] Night Market — Parlor's simultaneous drafting adaptation. Sell goods for coins or display them for stall points.
- [x] President — fixed seats, private card exchanges, and a shared bot and reveal scheduler. Verified engine, seven-seat socket play, and phone browser flow.
- [x] Fault Line — Parlor's hidden-cache bluffing adaptation. Bounties create a public signal before opening choices are locked.
- [x] Gin Rummy — standard rules, bot play, automatic melds and layoffs, and final bonuses. Verified engine, socket redaction, and phone browser flow.
- [x] Council Ledger — Parlor's timed challenge adaptation. Settle challenges together and race to twelve standing.
- [x] Signal Relay — Parlor's real-time cooperative adaptation. Clear four relays using two antennas and a shared reroute.

All eleven slots are implemented, including seven original Parlor adaptations.

## Shared implementation decisions

1. **Per-game host options.** Every brief wants variant toggles; the lobby has no channel for them and
   `createState` takes no options. Briefs put options on the engine with defaults, so games can ship on
   defaults first. Build one shared "House rules" path (lobby UI → room → `createState(options)`) once,
   rather than per game.
2. **Shelf colours.** New games reuse the existing palette. Their colours are set in the game catalog.
3. **Bot seat colours.** Ridge Run shows a seat-colour swatch for each player and bot and matches it to their route markers.
4. **App wiring.** The home shelf and lobby picker both read `apps/parlor/src/lib/games/catalog.ts`.
5. **Dead-connection detection.** Signal Relay and Council Ledger run server deadlines independently of the socket heartbeat.
6. **Play again.** Council Ledger chooses its first proposer at random.

## Shared components

- **Dice:** `DiceTray` supports selections and blank pre-roll slots. `PipDie` supplies the roll animation. `RollStopBar` supplies the two turn actions. Farkle, Harbor Dice, and Ridge Run use this kit.
- **Standard deck:** Golf and Gin Rummy share `DiscardPile`. Golf adds `CardGrid`, and Gin Rummy adds `MeldSpread`.
- **Timed play:** `Countdown` and an absolute server deadline are shared by Signal Relay and Council Ledger.

## Faithful versions (2026-11-28)

The commercial games behind the Parlor adaptations, built from their briefs in `docs/games/` under their real names with Parlor's own wording and art.

| Brief | Game (id) | Built on | Notes |
|---|---|---|---|
| CANT_STOP.md | Can't Stop (`cant-stop`) | Ridge Run's board, the dice kit | Four dice, three runners, claim three columns. Rule-of-28 bot. |
| YAHTZEE.md | Yahtzee (`yahtzee`) | Harbor Dice's scorecard | Forced Joker and Yahtzee bonus. Expected-value bot. |
| SKULL.md | Skull (`skull`) | Fault Line's hidden-cache flow | Simultaneous ante, blind and own-skull penalties, starter choice. |
| LOVE_LETTER.md | Love Letter (`love-letter`) | Cipher Post | 2019 deck (classic as an engine option), private Priest/Baron reveals, hints. |
| SUSHI_GO.md | Sushi Go (`sushi-go`) | Night Market's simultaneous draft | Chopsticks, Wasabi, maki splits, puddings. Absent players pick last. |
| THE_MIND.md | The Mind (`the-mind`) | Signal Relay's real-time loop | Focus/breath, 150ms settle window for near-ties, stars by vote. Blind encore not built. |
| COUP.md | Coup (`coup`) | Council Ledger's timed windows | Sequential challenge/block windows with window ids and deadlines. |
| BOGGLE.md | Boggle (`boggle`) | Word Split's word list | 4x4 classic cubes, tap-to-trace or type, only unique words score. |

Shared additions: `CharacterCard` in `@parlor/ui` (named or numbered cards with the PlayingCard stock and back), used by Love Letter, Coup, Sushi Go and The Mind.

Host options (variants, timers, edition) are engine constructor options only; they need the shared "House rules" path above.

Still to build, with no Parlor sibling to start from: Codenames, Telestrations, Welcome To, Bang! Dice.
