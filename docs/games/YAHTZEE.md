# Yacht (Yahtzee rules): implementation brief

Status: implementation-ready brief, 2026-11-27. Replaces the pre-platform draft. Package `@parlor/yacht`, id `yacht`.

## 1. Overview

Five dice, up to three rolls a turn, and a 13-box scorecard. On each turn a player rolls, holds any dice, re-rolls the rest up to twice, then must write a score in one empty box. After 13 rounds every box is full and the highest total wins. **2–6 players** (bots can fill seats), about **3–5 minutes per player** (13 turns of ~20 s), so `estimatedMinutes: '15-35'`. **Peer mode** only (every player on their own phone; the platform has no Jackbox mode yet). No hidden information: every die, hold and scorecard is public.

Why it fits Parlor: everyone already knows it (grandparents and 8-year-olds alike), turns are short and readable while you wait, the luck/choice balance suits mixed-age tables, and it is the classic of the roll-and-write shelf next to Quixx. Its only hard part (the scorecard on a phone) is solved below the same way Quixx solved its sheet.

## 2. Naming & IP

| | |
|---|---|
| Proposed name | **Yacht** (shelf name "Yacht", id `yacht`) |
| Why | "Yahtzee" is a Hasbro trademark (docs/LEGAL.md: rename trademarked games). Yacht is the public-domain ancestor (in print by 1938) and the generic name already used for Yahtzee-rules dice games. The mechanics are not protectable. |
| Category names | Ones … Sixes, 3 of a kind, 4 of a kind, Full house, Small straight, Large straight, **Yacht** (the five-alike box), Chance. All generic dice/poker terms. |
| Bonus names | "Upper bonus" (+35), "Yacht bonus" (+100). |
| Must not use | The word Yahtzee anywhere players see it (UI, meta, RulesModal, shelf, e2e titles); Hasbro's logo, scorecard layout or art, cup/box imagery, "Aces" wording copied as a set from the Hasbro sheet, and any rulebook prose. Rules text is our own words. Internal docs/code comments may say "Yahtzee rules" factually (LEGAL.md allows this). |
| Fallback names | "Five Alike", "Full House". |

Note: Parlor's meta uses the real names for Quixx today; Yacht should not follow that precedent, because Yahtzee is a strong, actively enforced US mark.

## 3. Rules (verified)

Default ruleset = current Hasbro rules (forced Joker). Sources in §12; the Hasbro PDF is image-only, so its content was cross-checked against Wikipedia, Verhoeff's rules page and the Yahtzee Manifesto rulebook archive.

### Setup
- 5 six-sided dice, one scorecard per player, 13 empty boxes each.
- Seat order = lobby order. **First player is random** (`randomInt(n)`); the published "everyone rolls, highest starts" is equivalent and slower. Play passes to the next seat.
- Same rules for every player count. 13 rounds; each player takes one turn per round.

### Turn
1. **Roll** all five dice (roll 1). You cannot score before the first roll.
2. Optionally **hold** any dice and **re-roll** the others (roll 2), then again (roll 3). Holds are free to change between rolls: a die held after roll 1 may be released and re-rolled on roll 3. Rolling with all five held is rejected (it would waste a roll; nothing changes).
3. After any roll (1, 2 or 3) you may **score**; after roll 3 you must. Score exactly one **empty** box with the current five dice. Any empty box may take a 0 ("scratch") if the dice don't fit it, subject to the Joker rule below. Filled boxes never change.

### Scorecard

| Box | Needs | Scores |
|---|---|---|
| Ones … Sixes | anything | sum of dice showing that face (0 if none) |
| **Upper bonus** | upper subtotal ≥ 63 | +35 (automatic; zeros in upper boxes don't block it) |
| 3 of a kind | ≥3 dice the same | sum of all 5 dice |
| 4 of a kind | ≥4 dice the same | sum of all 5 dice |
| Full house | exactly 3 of one face + 2 of another | 25 |
| Small straight | 4 consecutive faces among the dice (1234, 2345, 3456; a duplicate fifth die is fine, e.g. 1-2-3-4-4) | 30 |
| Large straight | 12345 or 23456 | 40 |
| Yacht | all 5 the same | 50 |
| Chance | anything | sum of all 5 dice |
| **Yacht bonus** | see below | +100 each |

Total = upper subtotal + upper bonus + lower subtotal + 100 × Yacht bonuses. Yacht bonuses never count toward the 63.

Clarifications (chosen defaults):
- Five alike satisfies 3 of a kind and 4 of a kind (≥3, ≥4) and scores the full sum there.
- Five alike is **not** a Full house (needs two different faces), **except** as a Joker (below). A large straight also satisfies Small straight.
- A five-alike roll while the Yacht box is **empty** is ordinary: score it anywhere legal at its normal value (e.g. Fours = 20, Full house = 0). No Joker, no bonus.

### Yacht bonus and Joker rule (exact)
Applies when the final dice are five alike (face *f*) **and the Yacht box is already filled (with 50 or 0)**.

1. **Bonus:** if the Yacht box holds **50**, add **+100** (one per such turn). If it holds **0**, no bonus, but the Joker rule (2–3) still applies. With "Yacht bonus" off, never award it.
2. **Forced placement** (default "forced Joker"):
   - a. If the upper box for *f* is empty, it is the **only** legal box; score 5×*f* there.
   - b. Else, any **empty lower** box is legal, scored as a Joker: Full house 25, Small straight 30, Large straight 40, 3 of a kind / 4 of a kind / Chance = 5×*f*.
   - c. Else (upper *f* filled and all lower boxes filled), any **empty upper** box is legal and scores **0**. The +100 bonus is still awarded.
3. The bonus is decided by the dice actually scored at the end of the turn: a Yacht rolled on roll 1 and then broken up by re-rolling earns nothing.

"Free-choice Joker" variant (host toggle): any empty box is legal; the Joker values for Full house/straights apply only if the upper box for *f* is filled; otherwise they score as normal (0). Bonus unchanged.

### End and ties
- Game ends after the scoring turn that fills the last box of the last seat (13 × players turns).
- Highest total wins. **Ties are shared** (no published tie-break): `winnerIds` lists all, and the standings share a place (`Standing.place`).

### Common misplays / FAQ rulings
| Situation | Ruling |
|---|---|
| Score without rolling | Not allowed. |
| "My Yacht is a full house" | Only as a Joker (Yacht box filled). House-rule toggle exists. |
| Zero in Yacht box, roll another five alike | No +100, but forced Joker still applies (Verhoeff: "zeroes are OK"). |
| Joker but matching upper box empty | Must take the upper box (forced). |
| Joker with everything but an upper box full | Score 0 in an upper box, keep the +100. |
| Upper bonus with a 0 in Ones | Still possible; only the subtotal matters. |
| Re-hold a die you released | Yes, holds are freely toggled before each roll. |
| Yacht bonus toward 63 | No. |
| Small straight 1-2-3-4-6 / 2-3-4-5-5 | Both qualify. 1-2-3-5-6 does not. |

Reference: optimal solitaire play averages ≈254.6 under these rules (Verhoeff/Glenn); a casual human scores ~200–230.

## 4. Host options

Parlor has **no per-game host-options plumbing yet** (no options in `GameMeta`, `RoomManager` or the lobby). Build the engine to take an `options` object with these defaults now; expose toggles when the lobby gains options (open question 1).

| Option | Values | Default | Effect |
|---|---|---|---|
| `joker` | `'forced'` / `'free'` / `'off'` | `'forced'` | §3 Joker rule; `'off'` = five alike only scores normally (Yatzy/Yacht style). |
| `yachtBonus` | on / off | on | +100 for extra Yachts. |
| `fiveAlikeFullHouse` | on / off | off | House rule: five alike always counts as Full house (25). |
| `scorePreview` | on / off | on | Show pencilled potential scores in empty boxes. Off is a "purist" mode; kids want it on. |
| Turn timer | (platform-wide, future) | off | Not built in core; stand-ins already cover disconnects. |

Later variants (do not build now): Triple scoring (three columns ×1/×2/×3), classic 1938 Yacht scoring (no upper bonus, no 3-kind, straights 30, full house = sum).

## 5. State model

`rules.ts` (pure, client-safe):

```ts
export type Face = 1 | 2 | 3 | 4 | 5 | 6;
export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht', 'chance'] as const;
export type UpperCategory = (typeof UPPER)[number];
export type LowerCategory = (typeof LOWER)[number];
export type Category = UpperCategory | LowerCategory;
export const CATEGORIES: readonly Category[] = [...UPPER, ...LOWER];

export type Scorecard = Record<Category, number | null>; // null = empty box

export interface YachtOptions {
  joker: 'forced' | 'free' | 'off';
  yachtBonus: boolean;
  fiveAlikeFullHouse: boolean;
  scorePreview: boolean;
}
export const DEFAULT_OPTIONS: YachtOptions = { joker: 'forced', yachtBonus: true, fiveAlikeFullHouse: false, scorePreview: true };

/** One empty box's outcome for the current dice. Filled boxes are omitted. */
export interface ScoreOption {
  category: Category;
  points: number;
  legal: boolean;   // false only when the forced Joker restricts the choice
  joker: boolean;   // scored through the Joker rule
}

export function baseScore(dice: readonly Face[], c: Category, o: YachtOptions): number;
export function scoreOptions(card: Scorecard, dice: readonly Face[], o: YachtOptions): {
  options: ScoreOption[]; bonus: boolean; jokerActive: boolean; forced: Category | null;
};
export function totals(card: Scorecard, yachtBonuses: number): {
  upper: number; upperBonus: 0 | 35; lower: number; total: number; upperNeeded: number; // 63 - upper, floored at 0
};
```

`engine.ts` (server only):

```ts
type Phase = 'turn' | 'scored' | 'game-over';

interface Seat {
  id: string; name: string; bot: boolean; connected: boolean;
  card: Scorecard;
  yachtBonuses: number;
}

interface LastScore {
  playerId: string; category: Category; points: number;
  bonus: boolean;      // +100 awarded this turn
  joker: boolean;
  upperBonusEarned: boolean; // this score crossed 63
}

class YachtEngine {
  private phase: Phase = 'turn';
  private seats: Seat[];
  private active: number;           // random start
  private round = 1;                // 1..13
  private dice: Face[] | null = null; // null before roll 1 of a turn
  private held: boolean[] = [false, false, false, false, false];
  private rollsUsed: 0 | 1 | 2 | 3 = 0;
  private lastScore: LastScore | null = null;
  private winnerIds: string[] = [];
  constructor(players: { id: string; name: string; bot: boolean }[], options?: Partial<YachtOptions>, randomInt?: RandomInt);
}
```

State machine:

```
turn(rollsUsed 0) --roll--> turn(1) --hold* / roll--> turn(2) --roll--> turn(3)
turn(rollsUsed >= 1) --score--> scored
scored --advanceReveal--> turn(next seat, rollsUsed 0, dice null, held all false)
                        | game-over (every seat has 13 filled boxes)
```
`round` increments when play wraps back to the first seat.

View (`types.ts`). Nothing is secret, so every seat and spectators get the same data; only `myId` differs.

```ts
export interface YachtPlayerView {
  id: string; name: string; bot: boolean; connected: boolean;
  card: Scorecard;
  yachtBonuses: number;
  upper: number; upperBonus: 0 | 35; upperNeeded: number; lower: number; total: number;
}

export interface YachtView {
  phase: 'turn' | 'scored' | 'game-over';
  round: number; totalRounds: 13;
  players: YachtPlayerView[];        // seat order; seat index = array index
  activePlayerId: string | null;     // null at game-over
  myId: string | null;               // null for spectators
  dice: Face[] | null;
  held: boolean[];                   // length 5
  rollsUsed: number; rollsLeft: number;
  /** For the active player's current dice; [] before the first roll. Public. */
  scoreOptions: ScoreOption[];
  yachtRoll: { bonus: boolean; joker: boolean; forced: Category | null } | null;
  canRoll: boolean;   // viewer is active, rollsLeft > 0, phase turn, not all held
  canScore: boolean;  // viewer is active, rollsUsed >= 1, phase turn
  lastScore: LastScore | null;       // drives the reveal animation
  options: YachtOptions;
  winnerIds: string[];
}

export type YachtAction =
  | { type: 'hold'; held: boolean[] }
  | { type: 'roll' }
  | { type: 'score'; category: Category };

declare module '@parlor/game-types' {
  interface GameViewMap { yacht: YachtView }
  interface GameActionMap { yacht: YachtAction }
}
```

## 6. Actions

All turn-based; only the active seat acts. Every rejection is a `GameRuleError` thrown before any state change.

| Action | Payload validation (`validateAction`) | Engine rules | Result |
|---|---|---|---|
| `hold` | `hasExactKeys(['type','held'])`, array of exactly 5 booleans | phase `turn`, your turn, `1 <= rollsUsed <= 2` ("Roll first." / "No rolls left. Pick a box.") | `held` replaced (whole array: idempotent, no toggle races). Broadcast so the table sees holds live. |
| `roll` | `hasExactKeys(['type'])` | phase `turn`, your turn, `rollsUsed < 3`, not all five held after roll 1 ("Release at least one die.") | Roll 0: all five rolled, holds cleared. Later: un-held dice re-rolled with `randomInt(6)+1`. `rollsUsed++`. |
| `score` | `hasExactKeys(['type','category'])`, category in `CATEGORIES` | phase `turn`, your turn, `rollsUsed >= 1`, box empty ("That box is already filled."), legal under Joker ("Five alike must go in Fives.") | Write points, add bonus, set `lastScore`, phase `scored`. |

Timing (`definition.ts` `drive`, copy Hearts): in `scored`, schedule `advanceReveal` after **1400 ms** (2400 ms when `lastScore.bonus`, a Yacht, or the upper bonus was just earned). Automatic moves every **700 ms** (slower than Hearts' 400 ms so watchers can follow holds then rolls). Each automatic step is one action: a bot's hold+roll is one step (engine sets holds then rolls; broadcast shows the result), score is another.

Connections: `setConnected`. Disconnected or removed humans get a stand-in using the bot strategy (Hearts pattern: the seat stays, its card keeps filling). `automaticMove()` returns `undefined` when no connected human remains (pauses the table).

## 7. Mapping to this codebase

Copy `games/hearts` (new-style package) per docs/ADDING_GAMES.md.

| File | Notes |
|---|---|
| `games/yacht/package.json` | `@parlor/yacht`; exports `./meta`, `./server-definition`, `./game-view`. No `@parlor/cards`. |
| `tsconfig.json`, `turbo.json` | copy from `games/hearts` unchanged |
| `src/types.ts` | §5 view/actions + module registration |
| `src/meta.ts` | `{ id:'yacht', name:'Yacht', description:'Roll five dice up to three times and fill a 13-box scorecard. Most points wins.', minPlayers:2, maxPlayers:6, estimatedMinutes:'15-35', tags:['dice','classic','family'], displayModes:['peer'], supportsBots:true }` |
| `src/rules.ts` | `baseScore`, `scoreOptions`, `totals` (pure; GameView imports `totals`, labels) |
| `src/bot.ts` | §9 strategy, pure function `(card, dice, held, rollsUsed, options) => BotStep` |
| `src/engine.ts` | class per §5, `secureRandomInt` default, `GameRuleError` |
| `src/definition.ts` | copy `games/hearts/src/definition.ts` (drive/STEP, lifecycle hooks) |
| `src/GameView.svelte`, `src/Scorecard.svelte`, `src/ScoreTable.svelte`, `src/DiceRow.svelte` (unless shared, below) | board |

Patterns to copy:
- Engine/definition/stand-ins: `games/hearts/src/engine.ts` (`automaticMove`, `setConnected`, `view(id?)`), `games/hearts/src/definition.ts`.
- Dice tray, hold, "N of 3 rolls left", roll/keep buttons: `games/booty-dice/src/lib/components/game/GameView.svelte` (lines ~100–125).
- Scoresheet that never scrolls sideways + select-then-confirm + viewer modal with player tabs: `games/quixx/src/lib/components/game/Scoresheet.svelte` (`repeat(12, minmax(0,1fr))`, `clamp()` type), `GameView.svelte` (`selectedMove` cleared on phase change, "Cross it off" confirm), `ScoresheetViewer.svelte` (Modal + tabs).

`@parlor/ui` reuse: `TurnBanner`, `SeatChip` (stat = "142 pts"), `PipDie` (`picked` = held; value 0 renders a blank face before the first roll), `Felt` (dice tray), `Button` (`shout`), `Modal`, `GameOver` (+ `more` snippet for the score table), `seatTone`.

**Board-kit addition (flag):** `DiceTray` in `packages/ui/src/lib/dice/`: a row of `PipDie` with hold toggles, blank state, rolls-left dots and the tumble animation for un-held dice. Booty, Quixx and Liar's each draw their own; Farkle (being specced in parallel) needs the same thing. Build it once here or in Farkle, whichever lands first; coordinate. Everything else is game-local.

App wiring: the six places in ADDING_GAMES.md §7, plus `apps/parlor/src/lib/games/catalog.ts` (`shelf: 'linen'`, tagline `'Roll five dice, fill the scorecard'`) and the shelf list in `apps/parlor/.impeccable/design-full.md` / the Collection Rule line in `apps/parlor/DESIGN.md`.

## 8. Board UI

Shelf colour: **linen**. Every palette colour is already used (felt ×2, mustard ×2, clay ×2, ink ×2, linen ×1); linen has one user (Kings Corner, a card game), so no other dice game shares it. Place Yacht in the catalog next to a non-linen spine. Linen shows on the spine and on the scorecard's section bands; dice are paper with espresso pips (PipDie default) on the standard `Felt` tray. Held dice are butter (`picked`), never linen.

### Phone (390 px; content 358 px)

```
┌ TurnBanner: "Your turn · roll 2 of 3"  "Tap dice to hold them." ┐
 (Mo 142)(Bot Ada 118)(Lu 97)          ← SeatChips, wrap; tap = view card
┌ Felt ─────────────────────────────────┐
│  [3] [3] [5] [3] [2]    ● ● ○         │ ← 52px dice; butter = held; rolls-left dots
└───────────────────────────────────────┘
┌ Scorecard (paper, 2.5px ink) ─────────┐
│ Upper (linen band) │ Lower (linen)    │ ← two columns, 175px each
│ ⚀ Ones       3     │ 3 of a kind  ·16 │   filled = ink number
│ ⚁ Twos      ·4     │ 4 of a kind   ·0 │   ·n = pencilled preview (Faded Ink, dashed box)
│ ⚂ Threes    ·9     │ Full house    25 │
│ ⚃ Fours      –     │ Small str.    ·0 │
│ ⚄ Fives     15     │ Large str.     – │
│ ⚅ Sixes     ·0     │ Yacht         50 │
│ Bonus  needs 39    │ Chance        ·16│
├────────────────────┴──────────────────┤
│ Upper 18 · Lower 75 · Yacht +100 · 193 │ ← totals strip, total in Nunito 900
└───────────────────────────────────────┘
╞ sticky bar: [Roll again (1 left)]  [SCORE 9]  ╡
```

Height budget: banner 64 + seats 44–96 + tray 96 + sheet 7×44+44 = 352 + bar 72 + gaps ≈ 700–750 px: fits an 844 px phone under the lid for up to 4 players without scrolling; 5–6 players may scroll a little (seats wrap), never sideways. Like Quixx, columns are `minmax(0,1fr)` with `clamp()` type so nothing overflows; the upper column uses a 20px `PipDie` instead of words ("⚀ 1s" if space is tight: label `aria-label="Ones"`).

Others' cards: Quixx's answer (only your own sheet on the board, others as SeatChips with their total). Tapping a SeatChip opens a `Modal` with player tabs (copy `ScoresheetViewer.svelte`) showing that card read-only, plus an **All** tab: a compact comparison table (rows = 13 boxes + totals, columns = players by avatar initial; 6 × 43 px + 100 px label = 358 px, fits). During another player's turn your sheet stays yours (no previews); the banner names their roll ("Ada rolled 4-4-4-2-6, holding the 4s") and the tray shows their dice and holds live.

### Desktop (≥ 900 px)
Two columns, max 960 px: left = banner, tray, actions, seats; right = the full comparison table (one column per player, your column interactive with previews, active player's column header in felt). 600–900 px: phone layout at 52 px dice.

### Interactions
- Before roll 1: tray shows five blank dice; only action is **ROLL** (shout).
- Dice: tap toggles hold (`hold` emitted with the whole array; render optimistically, the next view reconciles). 44 px+ targets. Disabled when it's not your turn or rolls are used up.
- Boxes: tap an empty legal box → butter, banner "Score 25 in Full house?"; bar shows **SCORE 25** (shout) and Roll again as secondary. Tap the same box again deselects (Quixx). Selection clears whenever `rollsUsed`, `dice` or phase changes. Illegal boxes under forced Joker are faded with the banner explaining "Five alike with Fives open must go in Fives."
- Scratching for 0 while rolls remain: the confirm reads **SCRATCH CHANCE (0)** so a zero is never an accident.
- Shout once: SCORE is the shout when a box is selected, otherwise ROLL / ROLL AGAIN.
- Game over: `GameOver` (headline "You win!" / "Mo wins!" / "Tie: Mo and Lu"), standings detail "243 points", `more` = the comparison table.

### Animation (moderate; all off under `prefers-reduced-motion`, crossfade only)
- Roll: un-held dice tumble (±25° rotate, 3 face swaps, 350 ms, 40 ms stagger); held dice stay still. Same for watchers.
- Score: number inks into the box (scale 1.15→1, 200 ms); preview pencils fade out.
- Upper bonus earned: a mustard "+35" stamp on the bonus row. Yacht (50) or Yacht bonus: "Yacht!" stamp on the tray + "+100" chip popping onto the totals strip (that's why the reveal is 2.4 s).

## 9. Bot AI

Pure `bot.ts`, deterministic for a given state (tests are seedable through the engine's `randomInt`). Matches Hearts: `automaticMove()` returns one step for the active seat when it is a bot or a disconnected human.

Value of scoring box *c* with dice *d*: `v(c,d) = points(c,d) − par(c) + upperAdj(c)`.
- `par` (≈ expected box value under good play): ones 2, twos 5, threes 8.5, fours 12, fives 15.5, sixes 19, 3-kind 21.5, 4-kind 13, full house 22.5, small 29.5, large 32.5, yacht 17, chance 22. Tune in tests.
- `upperAdj`: while the upper bonus is still reachable, `+0.6 × (points − 3×face)` (rewards being at/above the 63 pace, punishes below).
- Five alike with the Yacht box empty: always score Yacht (50).
- Chance: extra −4 while ≥ 5 rounds remain (save it).
- Scratch preference when every option is ≤ 0: lowest `par` box first (Ones, then Yacht late (round ≥ 10), then 4 of a kind).
- Respect `legal` from `scoreOptions` (Joker).

Turn:
1. Roll 1 always.
2. With rolls left, compute `now = max_c v(c,d)`. For each distinct hold multiset (≤ 32 masks, dedupe), compute exact expectation over the re-rolled dice (enumerate the ≤ 252 multisets with multinomial weights) of `max_c v(c, d')`. With 2 rolls left add +1.5 per re-rolled die as a crude look-ahead bonus.
3. If `now ≥ bestHoldEV`, score now; else hold that mask and roll. After roll 3, score `argmax v`.

Cost: 32 × 252 × 13 ≈ 105k evaluations per decision, well under a millisecond-scale budget. Target: average ≥ 190 over 500 seeded solo-sim games (test asserts ≥ 180 to avoid flakiness).

## 10. Test plan

Engine/rules unit tests: `apps/parlor/src/lib/server/yacht.test.ts` (pattern: `hearts.test.ts`), with a scripted `randomInt` queue to force dice.

`rules.ts`:
1. Every category on representative dice; upper boxes with zero matches = 0.
2. Full house: 3+2 = 25; five alike = 0 (default), 25 with `fiveAlikeFullHouse`; 4+1 = 0.
3. Small straight: 1-2-3-4-6 = 30, 2-3-4-5-5 = 30, 1-2-3-5-6 = 0, 12345 = 30. Large: 23456 = 40, 1-2-3-4-6 = 0.
4. 3/4 of a kind with five alike = sum.
5. Upper bonus at exactly 63 (35) and 62 (0); zeros in upper boxes; Yacht bonus not counted toward 63.
6. Joker forced: Yacht box 50, Fours empty, dice 4×5 → only Fours legal, 20 pts, bonus true.
7. Joker forced: Fours filled → all empty lower boxes legal, FH 25, SS 30, LS 40, Chance 20, 3K 20; upper boxes illegal.
8. Joker forced: Fours + all lower filled → empty upper boxes legal at 0, bonus still true.
9. Yacht box 0 + five alike: bonus false, Joker still forced (cases 6–8 with no bonus).
10. Yacht box empty + five alike: no Joker, all empty boxes legal at normal values (FH 0), bonus false.
11. Free-choice Joker: all empty legal; FH 25 only if matching upper filled; `joker:'off'` → FH 0, no bonus.
12. `yachtBonus:false` → never +100.

Engine:
13. Score before rolling, roll a 4th time, hold before roll 1, roll with all held, act out of turn, score a filled box, illegal Joker box: each throws `GameRuleError` and `view()` is unchanged (deep-equal before/after).
14. Holds persist across a roll and held dice keep their values; releasing and re-rolling a previously held die works.
15. New turn resets dice to null, holds to false, rollsUsed 0; reveal advances to the next seat; round increments on wrap; random first seat honoured.
16. Full game: 2 and 6 players play 13 × n turns to `game-over`; every card has 13 filled boxes; totals match `totals()`.
17. Tie: two players with equal totals → both in `winnerIds`, shared place.
18. Bot: always takes 50 for an open Yacht; never picks an illegal box; solo-sim average ≥ 180 over 500 seeded games; a bot turn ends in ≤ 3 rolls.
19. Stand-ins: disconnected human's turn is played automatically; no automatic move when all humans are disconnected; reconnect returns control mid-turn (holds kept).
20. View: spectator `myId` null, `canRoll`/`canScore` false for non-active and spectators; `scoreOptions` empty before roll 1.

Socket: add Yacht to `seededPlaythroughs.test.ts`; add malformed `hold` (4 items, non-booleans, extra keys) and `score` (unknown category, number) to `actionBoundary.test.ts`.

Playwright smoke `apps/parlor/e2e/yacht.test.ts` (390×844, pattern `e2e/spades.test.ts`): open "How to play" for Yacht on the shelf; create room; vote Yacht; add a bot; start; ROLL; tap die 1 (assert `aria-pressed=true`); ROLL AGAIN; tap Chance; SCORE; assert Chance box shows the dice sum and the banner names the bot's turn; wait for the bot's score to land and the banner to return "Your turn". Assert no horizontal scroll (`scrollWidth <= clientWidth`).

## 11. Open questions

1. Host options: build lobby per-game options now (Yacht would be the first user), or ship defaults only and add toggles later? Recommendation: defaults only.
2. Solo play (1 player, high-score chase): the lobby replaces START with the invite while the host is alone. Allow `minPlayers: 1` and a solo START, or keep 2–6 with a bot? Recommendation: 2–6 now.
3. Name: "Yacht" ok, or prefer "Five Alike"?
4. Shelf colour linen (shared with Kings Corner) ok? Coordinate with Farkle's choice.
5. Shared `DiceTray` in `@parlor/ui`: build here or in Farkle first?

## 12. Sources

- Hasbro, Yahtzee instructions (PDF, image-only, could not text-extract): https://www.hasbro.com/common/instruct/Yahtzee.pdf
- Wikipedia, Yahtzee (categories, forced vs free-choice Joker, 1956→1961 Joker correction, Yatzy): https://en.wikipedia.org/wiki/Yahtzee
- Wikipedia, Yacht (dice game) (1938 public-domain ancestor, differences): https://en.wikipedia.org/wiki/Yacht_(dice_game)
- T. Verhoeff, Yahtzee rules as used for optimal-solitaire analysis (Joker applies when Yahtzee box is 0; bonus needs 50): https://www-set.win.tue.nl/~wstomv/misc/yahtzee/rules.html and https://www-set.win.tue.nl/~wstomv/misc/yahtzee/
- The Yahtzee Manifesto, rules + archive of official rulebooks 1956–2023 (bonus needs 50; Joker order; re-rolling held dice): https://www.yahtzeemanifesto.com/yahtzee-rules.php
- Free The Dice rules PDF (zero in Yahtzee box still counts as filled for the Joker): https://www.freethedice.com/yahtzee/printables/yahtzee-rules.pdf
- gamerules.com Yahtzee rules (Joker example with a zeroed Yahtzee box): https://gamerules.com/rules/yahtzee-rules/
