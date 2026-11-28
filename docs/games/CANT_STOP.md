# Top Out (Can't Stop): implementation brief

> Internal doc. "Can't Stop" is used here only to name the source game; nothing player-facing says it (see §2).

## 1. Overview

A push-your-luck race up eleven columns numbered 2–12. On your turn you roll four dice, split them into two pairs and move up to three white **climbers** up the columns those sums name. Keep rolling to push higher, or stop and turn the climbers into permanent **camps** in your colour. A roll you can't use is a **fall**, and you lose everything you gained that turn. Reach the top of a column to claim it. The first player to claim three columns wins.

| | |
|---|---|
| Players | 2–4 (bots can fill seats) |
| Time | 15–30 min |
| Display mode | `peer` (everyone on their own device). Parlor has no Jackbox (shared screen) mode yet: `GameMeta.displayModes` allows `'jackbox'`, but nothing renders it. The old draft's TV/phone split is deferred (§11). The board has to work on a 390px phone. |
| Hidden info | None. All views are the same apart from `you`/`canAct`. |
| Why Parlor | Readable in one roll for children and grandparents alike. Every turn has table-wide tension ("stop!"). Turns are short. The board makes a strong shelf-defining visual. It also gives Farkle a "Roll / Stop" pattern to reuse later. |

## 2. Naming & IP

- **Proposed Parlor name: "Top Out"**: a climbing term for reaching the top of a route, and a plain-English phrase. Alternatives: "Summit Dash", "Ridgeline". The shelf tagline is "Push your luck up the mountain".
- **Theme (light touch):** columns are **routes** (still labelled 2–12), neutral markers are **climbers** (white), your permanent markers are **camps** (seat colour), a claimed column is **summited** (flag at its top), and a bust is a **fall**. Rule text and UI copy can still say "column" wherever it reads more clearly.
- **Do not use** the name "Can't Stop" or "Can't Stop Express", the Parker Brothers, Face 2 Face or Eagle-Gryphon box art, board graphics, the orange/yellow board look, rulebook wording, or the terms "runner"/"blowing it" as branded copy. The mechanics and the 3-5-7-9-11-13 column profile (the two-dice probability curve) are not protectable (`docs/LEGAL.md`).
- The `docs/GAMES.md` row needs updating (display mode `peer`, IP "Renamed: Top Out"). That is the implementer's change, not this doc's.

## 3. Rules (verified)

### Components and setup
- 4 six-sided dice. 3 white climbers (shared, used only by the active player). Each player has one camp marker per column.
- Column heights (number of spaces; the top space is the summit):

| Column | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Spaces | 3 | 5 | 7 | 9 | 11 | 13 | 11 | 9 | 7 | 5 | 3 |

- Positions are 1-based. 0 means "not on the column". Position `h` (the column's height) is the summit.
- Setup is the same for every player count. **First player** is chosen at random (the rulebook has players roll for it, which comes to the same thing), and play goes clockwise in seat order.

### Turn
1. **Roll** all four dice. The first roll of a turn is mandatory: a turn can't be stopped before rolling.
2. **Choose a pairing.** Four dice split into exactly three pairings: (A+B, C+D), (A+C, B+D), (A+D, B+C). Each pairing gives two sums.
3. **Place.** Apply the chosen pairing's sums one at a time:
   - The column already has a climber: it moves up 1.
   - No climber yet, and fewer than 3 climbers on the board: a climber enters at **your camp + 1** (at space 1 if you have no camp there).
   - A sum **cannot be used** if the column is **claimed** (by anyone, including you), if the climber there is **already on the summit** (it can't pass the top), or if it would need a 4th climber.
4. **Must-use rule (the precise spec):**
   - You may choose **any pairing that places at least one climber**. You don't have to pick the pairing that places the most. If at least one pairing places something, you can't fall voluntarily.
   - Within the chosen pairing, **if both sums can be used together you must use both.**
   - If both can't be used together but each can be used alone (the usual case is **one climber left** and **two different new columns**), **you choose which one to use**. The other is ignored.
   - If only one sum is usable, you use that one and the other is ignored.
   - "Together" is evaluated **sequentially**, which matters for doubles. With the last free climber and the pairing 6+6 on a new column, the first 6 places the climber and the second 6 moves it up, so both are used. With a climber one space below the summit on 4 and the pairing 4+4, the first 4 reaches the summit and the second is ignored (it can't pass the top).
5. **Decide:** **Roll** again, or **Stop**.
   - **Stop:** each climber becomes your camp at its position (your old camp in that column is replaced). Every climber that is on a summit **claims that column** for you: all other players' camps in that column are removed and the column is closed to everyone for the rest of the game. Then your turn ends.
   - **Fall:** if a roll offers **no pairing that places anything**, you fall. All climbers come off, your camps stay where they were, nothing is claimed, and your turn ends. Reaching a summit during the turn means nothing until you stop.
6. **Opponents' camps don't block.** A climber may share a space with any opponent's camp (published base rule).

### End and scoring
- After a Stop, if you hold at least `goal` claimed columns (default 3), **you win immediately**. Claims can only happen on your own Stop, so exactly one player can win at a time.
- Nobody else gets a final turn, and there are no tie-breaks for first place. For `GameOver` standings, the others are ranked by columns claimed, then by total progress (the sum of camp/height over unclaimed columns). Exact ties share a place.

### FAQ rulings and defaults

| Question | Ruling / default | Source |
|---|---|---|
| Does "if you can place, you must" force a pairing choice? | No. You pick any pairing that places at least one climber, and you must use both of its sums if they fit. Wikipedia notes the ambiguity (its 2-2-5-5 example). We take the common reading. | Wikipedia, RulesPal |
| One climber left, pairing gives two new columns | You choose which one. | RulesPal ("only one marker left… you choose") |
| Climber reached a summit mid-turn | It stays there. That column can't take more sums this turn. It is claimed only on Stop, and lost if you fall. | RulesPal |
| Can I enter a column I already claimed? | No, it is closed to everyone. | RulesPal |
| Climber on another player's camp | Allowed (base). Skip and block rules are variants. | RulesPal, Wikipedia |
| Two players' camps on the same summit? | Impossible. The first to stop on it claims it and removes the others' camps. | Rules |
| All three climbers on summits, roll again? | Faithful default: allowed (it is a guaranteed fall). The UI warns, and the shouted action becomes STOP AND WIN or STOP. See §11. | Rules |
| Common misplays the UI must prevent | Only legal moves are offered, so nobody "forgets" a usable sum or places a 4th climber. | — |

## 4. Host options

Parlor has **no per-room game-options infrastructure yet**: `createState(_room, players)` takes no options, and no game reads any. Build the engine with a constructor parameter `options: TopOutOptions = DEFAULTS` (like Hearts' `goal`) and ship **without** a lobby UI. Toggles appear when options infra lands.

| Option | Values | Default | Notes |
|---|---|---|---|
| `goal` (columns to win) | 3 / 4 / 5 | 3 | The rulebook's longer game suggests 4–5 for 2–3 players. |
| `passing` | `'share'` / `'skip'` / `'block'` | `'share'` | `skip` = Sackson's faster variant (a climber entering or moving onto an occupied space jumps to the next free space; it can't pass the summit, so it stops at the top if all spaces above are taken). `block` = you may not **Stop** with a climber on an opponent's camp. That makes Stop illegal in that state, so you must roll. It is a variant of RulesPal's "Variant B". |
| Turn timer | — | — | No infra. Out of scope. |

## 5. State model

`games/top-out/src/types.ts`:

```ts
export const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Column = (typeof COLUMNS)[number];
export const HEIGHT: Record<Column, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};
export type Dice = [number, number, number, number];
export type ColumnMap<T> = Partial<Record<Column, T>>; // plain objects, JSON-safe (no Map)

export type TopOutPhase =
  | 'first-roll'   // active player must roll (Stop not allowed)
  | 'choosing'     // dice are rolled and there is ≥1 legal move; pick one
  | 'deciding'     // a move was placed; Roll or Stop
  | 'fell'         // reveal: the roll that busted, climbers still shown; advanceReveal() ends the turn
  | 'game-over';

/** A move is the list of columns to climb, in application order; sorted ascending; length 1 or 2. */
export type Move = [Column] | [Column, Column];

export interface PairingOption {
  /** Dice indices into `dice`, e.g. [[0,1],[2,3]]. */
  pairs: [[number, number], [number, number]];
  sums: [number, number];          // 2..12
  /** Legal moves from this pairing: [] (unusable), [[a,b]] (both), [[a]] (one), or [[a],[b]] (choose one). */
  moves: Move[];
}

export interface TopOutOptions { goal: number; passing: 'share' | 'skip' | 'block' }

export type TopOutAction =
  | { type: 'roll' }
  | { type: 'climb'; columns: Move }
  | { type: 'stop' };

export interface TopOutPlayerView {
  id: string; name: string; bot: boolean; connected: boolean;
  seat: number;                    // index, for seatTone(seat)
  camps: ColumnMap<number>;        // permanent positions (unclaimed columns only)
  claimed: Column[];
}

export interface TopOutView {
  phase: TopOutPhase;
  goal: number;
  players: TopOutPlayerView[];
  activePlayerId: string | null;   // null at game-over
  claimedBy: ColumnMap<string>;    // column -> player id
  climbers: ColumnMap<number>;     // this turn's positions (also shown during 'fell')
  dice: Dice | null;               // null in 'first-roll'
  rollId: number;                  // increments each roll; the client keys the dice animation on it
  pairings: PairingOption[] | null;// set in 'choosing' and 'fell' (all three, so a fall is explainable)
  lastMove: Move | null;           // move just placed (for highlight) in 'deciding'
  canAct: boolean;                 // viewer is the active, connected human
  canStop: boolean;                // phase 'deciding' && (passing !== 'block' || !blocked)
  stopWins: boolean;               // stopping now reaches `goal`
  certainFall: boolean;            // 3 climbers out and every one on a summit
  winnerId: string | null;
  turn: number;                    // 1-based count of turns taken, for the banner and tests
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'top-out': TopOutView }
  interface GameActionMap { 'top-out': TopOutAction }
}
```

Server state (private fields in `TopOutEngine`, like `HeartsEngine`):

```ts
interface Seat { id: string; name: string; bot: boolean; connected: boolean; camps: ColumnMap<number> }
class TopOutEngine {
  private seats: Seat[];
  private phase: TopOutPhase = 'first-roll';
  private active: number;                  // randomInt(seats.length) at construction
  private claimedBy: ColumnMap<string> = {};
  private climbers: ColumnMap<number> = {};
  private dice: Dice | null = null;
  private rollId = 0; private turn = 1;
  private lastMove: Move | null = null;
  private winnerId: string | null = null;
  constructor(players: { id: string; name: string; bot: boolean }[], randomInt: RandomInt = secureRandomInt, options = DEFAULT_OPTIONS)
}
```

**Per-player redaction:** none needed. `view(id)` differs only in `canAct`. `view()` (spectator) has `canAct: false`. All of `pairings` is public, so watchers can see the options.

### State machine

```
first-roll --roll--> (legalMoves.length ? choosing : fell)
choosing   --climb--> deciding   (no auto-stop, even when stopWins)
deciding   --roll--> (legalMoves.length ? choosing : fell)
deciding   --stop--> commit; claims; (won ? game-over : next seat, first-roll)
fell       --advanceReveal (timer)--> clear climbers; next seat, first-roll
```

`rules.ts` (pure; the client may import it, but the view already precomputes everything):

```ts
export function pairings(d: Dice): [[number,number],[number,number]][]; // fixed order: AB|CD, AC|BD, AD|BC
/** Simulate placing `cols` in order; returns new climbers or null if any step is illegal. */
export function tryPlace(cols: Column[], climbers: ColumnMap<number>, camps: ColumnMap<number>, claimed: ColumnMap<string>, passing, opponentsCamps): ColumnMap<number> | null;
export function pairingOptions(d: Dice, ctx): PairingOption[]; // per §3.4:
//   both = tryPlace([a,b]) -> moves=[[a,b]] (sorted)
//   else oneA = tryPlace([a]), oneB = a!==b && tryPlace([b]) -> moves = filter([[a]],[[b]])
export function legalMoves(d: Dice, ctx): Move[]; // flattened + de-duplicated by key (e.g. 1-1-6-6 gives [2,12] and [7,7] once)
```

## 6. Actions

All turn-based. Only the active seat may act (`GameRuleError('It is not your turn.')`), and every check runs before any mutation.

| Action | Payload validation (`validateAction`, untrusted) | Engine rule checks | Transition |
|---|---|---|---|
| `roll` | `hasExactKeys(['type'])` | phase ∈ {`first-roll`, `deciding`} | `rollId++`, roll 4× `randomInt(6)+1`, compute options. No legal move → `fell`, else `choosing`. |
| `climb` | `hasExactKeys(['type','columns'])`; array of 1–2 integers in 2..12; sorted ascending. Else `invalid('Choose a move.')` | phase `choosing`; `columns` equals (by key) one of `legalMoves` → else `GameRuleError('That move is not available for this roll.')` | Apply in order, set `lastMove`, `dice` stays visible → `deciding`. |
| `stop` | `hasExactKeys(['type'])` | phase `deciding`; `canStop` | Commit climbers to camps; claim summits (remove others' camps in those columns); win check; else advance seat, reset climbers/dice/lastMove, `turn++`, `first-roll`. |

**Timing / reveals (`definition.ts` `drive`, copy Hearts):**
- `fell` → `advanceReveal()` after **2000 ms** (the dice and the stranded climbers stay visible).
- Bot / stand-in steps every **700 ms**, slower than Hearts' 400 ms so humans can follow roll → choose → roll. Recompute `automaticMove()` inside the callback.
- No reveal phase for Stop. The client animates the commit from the view diff.
- Stop on a fresh roll isn't possible: you can't stop in `choosing`, because a usable roll has to be used.

**Seats and connection:**
- `setConnected(id, c)`.
- A disconnected human's seat is played by a **cautious stand-in**: it rolls if in `first-roll`, takes the best move in `choosing`, and **stops at the first `deciding`**, so an absent player keeps their progress.
- `onPlayerRemoved` = permanent stand-in (the Hearts/Oh Hell pattern; the seat keeps its camps and claims, so the board stays intact).
- Pause automation when no connected human remains (the Hearts guard).

## 7. Mapping to this codebase

- **Package:** `games/top-out`, `@parlor/top-out`, id `'top-out'`. No `@parlor/cards` dependency.
- **Files** (per `docs/ADDING_GAMES.md`): `package.json`, `tsconfig.json`, and `turbo.json` copied from `games/hearts`; `src/types.ts`, `src/meta.ts`, `src/rules.ts`, `src/engine.ts`, `src/definition.ts`, `src/GameView.svelte`, plus `src/bot.ts` (pure policy, unit-testable).
- **Meta:** `minPlayers: 2, maxPlayers: 4, estimatedMinutes: '15-30', tags: ['dice', 'push-your-luck', 'family'], displayModes: ['peer'], supportsBots: true`.
- **Copy from:**

| What | From |
|---|---|
| Engine skeleton (`GameRuleError`, `randomInt`, `automaticMove`, `setConnected`, `view`, stand-in guard) | `games/hearts/src/engine.ts` |
| `drive`, hooks, `validateByType` | `games/hearts/src/definition.ts` |
| Reveal timing pattern | `trick-won` in Hearts |
| Dice tray look and roll feel | `games/liars-dice` and `games/booty-dice` GameViews (older apps; borrow presentation only) |

- **Wiring:** the six places in ADDING_GAMES §7. Add `{ ...topOutMeta, shelf: 'linen', tagline: 'Push your luck up the mountain' }` to `apps/parlor/src/lib/games/catalog.ts`, add a `RulesModal` section, and update the shelf list in `design-full.md` ("Its colour").
- **Reuse from `@parlor/ui`:** `TurnBanner`, `SeatChip` (stat "1 summit", plus a child swatch of the camp colour, see below), `PipDie` (default paper face/ink pips), `Button` (`shout` for ROLL / STOP AND WIN), `GameOver` with `Standing.detail` "3 summits", and `seatTone`.
- **New, game-local (not board kit):** `Mountain.svelte` (the column board) and `MoveOptions.svelte`.
- **Board-kit candidate (flag, don't build yet):** a `RollStopBar` (shouted Roll plus outline Stop with a risk hint) and a `DiceTray` (4–6 `PipDie` with a roll animation keyed on `rollId`). Farkle and Yahtzee will need the same, so promote them when the second dice package lands (Collection Rule).
- **Colour wrinkle:** `SeatChip` and `GameOver` draw **every bot avatar as ink**. On this board, camps **must** use `seatTone(seat)` for bots too, or two bots would be indistinguishable. Show the camp colour as a small swatch inside the SeatChip (children snippet). See §11.

## 8. Board UI

**Surface:** the mountain is a **linen** block (2.5px ink outline, 18px corners). The shelf colour is **linen**, shared with Kings Corner. It is the only neutral option: clay, felt, mustard, and ink are all seat colours, so camps in those colours must read against the board. The next shelf neighbour is Oh Hell (mustard), so neighbouring blocks still differ.

**Columns:** **bottom-aligned** columns, so the silhouette is a stepped peak at 7 and "up" means climbing. Each column is a stack of paper cells with an ink outline. Its number sits in a pill under the base (Nunito 900), and the summit cell has a flag notch.
- **Camps:** each seat has a **fixed corner** of the cell (seat 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right), drawn as a seat-tone dot with an ink ring. The fixed position is a non-colour cue.
- **Climber:** a white disc, larger, with a 2.5px ink outline, centred over the camps. When it's on a summit it wears the mustard ring.
- **Claimed column:** the cells fill solid in the claimer's seat tone and the camps are hidden. A flag in the seat tone sits at the summit, and the number pill shows the claimer's initial.

**Phone (390px, 16px gutters → 358px):** 11 columns × 28px plus 10 × 4px gaps = 348px. Cells are 28×22, so column 7 is 13×22 + gaps ≈ 320px tall. No scroll, no zoom.

```
[ Lid: PARLOR            ?  Leave ]
[ TurnBanner: Your turn · "Pick a move. Both sums climb." ]
[ (A)Alex 1⚑ ][ (B)Bot 0 ][ (C)Sam 2⚑ ]   <- SeatChips, horizontal scroll if 4
+------------ linen mountain ------------+
|                 [■]                    |
|             [ ][ ][ ]                  |
|          [ ][ ][o][ ][ ]               |  o = white climber
|  ...   bottom-aligned, peak at 7  ...  |
| (2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)   |
+----------------------------------------+
[ dice: ⚂ ⚃ ⚁ ⚄ ]
[ 3+4 · 2+5   →  7 and 7          ]   <- one row per pairing
[ 3+2 · 4+5   →  5 and 9          ]
[ 3+5 · 4+2   →  Climb 8 | Climb 6 ]   <- split choice: two buttons
   (an unusable pairing stays as a dimmed row: "Can't use: 8 is claimed")
          [  ROLL  ]  ( Stop )         <- in 'deciding'
```

**Desktop (≥ 900px):** two columns. On the left, the mountain at cells 44×34 (column 7 ≈ 480px tall). On the right, a 340px rail: TurnBanner, SeatChips (`wide` rows with "2 summits · 4 camps"), the dice tray (PipDie `--die-size: 56px`), the pairing rows, then Roll/Stop. Between 520 and 900px it is a single column like the phone, with cells 36px.

**Interactions:**
- **Moves:** each pairing row shows its two dice pairs as small dice and the move button(s).
  - First tap selects the move (butter) and **previews** it on the mountain: ghost climbers at the destinations, and the target cells wear the mustard ring. The banner reads "Tap 5 and 9 again to climb."
  - Second tap sends `climb`. This matches the card games' tap-twice convention.
  - Tapping a cell on the mountain is not an input (columns are too thin for reliable taps on a phone).
  - Unusable pairings stay listed, dimmed, with a reason ("8 is claimed", "No climbers left", "6 is at the top").
- **Roll/Stop:** in `first-roll`, a single shouted **ROLL**. In `deciding`, a shouted **ROLL** plus an outline **Stop** pill.
  - When `stopWins`, swap them: shouted **STOP AND WIN**, outline "Roll".
  - When `certainFall`, the Roll pill's hint reads "Every climber is at the top. Rolling will fall."
  - With `passing: 'block'`, Stop is disabled and its hint says why.
- **Banner copy:** "Your turn" / "Sam's turn". Details: "Roll to start your climb.", "Pick a move.", "Roll again or stop to make camp.", "Sam fell! No camps this turn.", "Sam summited 7."
- **Watching:** others see the same dice and options read-only (no buttons, rows as text), so the table can shout "stop!".
- **Accessibility:** the mountain is a `region` "Mountain". Each column is a list item labelled e.g. "Column 7, 13 spaces: climber on 6; Alex camp 4; Sam camp 2", or "Column 7, summited by Sam".

**Animations** (moderate; all dropped under `prefers-reduced-motion`):

| Event | Animation |
|---|---|
| Roll | Dice tumble about 500 ms, keyed on `rollId`. |
| Climb | Climber slides up one cell per step, 180 ms each. |
| Fall | Climbers drop down their columns and fade (500 ms). The banner shakes once. |
| Stop | Climbers shrink into seat-tone camp dots (300 ms). |
| Summit | The column fills bottom-to-top in seat tone (600 ms) and the flag pops at the top. |

## 9. Bot AI (`bot.ts`)

The policy is deterministic given the dice. It is used for bots, and for stand-ins with the cautious stop rule (§6).

**Choosing a move.** Score each legal move and take the max:
- `+ Σ steps × 12 / HEIGHT[col]`. A step on a short column is worth more.
- `+ 100` if a climber reaches a summit.
- `− 6` for each new climber placed, and a further `− 6` if it is the **last** free climber.
- `+ 2` for each step on columns 6–8 (best odds next roll).
- Tie-break: prefer the move that leaves the lowest chance of falling on the next roll (exact enumeration over the 1296 rolls; cheap), then the lowest column key.

**Roll or stop** (adapted from Michael Keller's "Rule of 28"):
- Keep a turn score. Each step adds the column weight (7→1, 6/8→2, 5/9→3, 4/10→4, 3/11→5, 2/12→6), and placing a new climber doubles that column's weight once.
- Once all three climbers are out, add `+4` if all three columns are ≥ 8 or all are ≤ 6 (lopsided sets fall more often). Keller's odd/even adjustments are left out for simplicity.
- **Stop** if any of these holds:
  - `stopWins`
  - any climber is on a summit
  - `certainFall`
  - turn score ≥ 28
  - the exact chance of falling on the next roll is > 0.5 with ≥ 1 step gained
- Otherwise roll.
- Fewer than 3 climbers out: never stop unless score ≥ 28. A next-roll fall is impossible with a free climber unless all sums are blocked, and the enumeration handles that case.

This is good enough to fill seats and beat a careless human sometimes. If wanted later, the weights become GA genes (`docs/AI_STRATEGIES.md`).

## 10. Test plan

**Engine and rules** (`apps/parlor/src/lib/server/top-out.test.ts`, seeded `randomInt` returning scripted dice):

- **`pairings`:**
  - [1,2,3,6] → sums (3,9), (4,8), (7,5) in AB|CD, AC|BD, AD|BC order.
  - [1,1,6,6] → legal moves `[2,12]` and `[7,7]` only (deduplicated).
- **Must-use and choose-one:**
  - Two climbers out (on 5 and 7, so one is free) and a pairing giving 4/9, both new columns → it yields `[[4],[9]]` (choose one), and `climb {columns:[4,9]}` is rejected.
  - Pairing 7/9 with a climber already on 7 and one free → `[[7,9]]` only, and `climb [7]` is rejected (must use both).
- **Doubles:**
  - Last free climber with 6+6 on a new column → `[6,6]` legal, climber at camp+2.
  - Climber at `h−1` on 4 with 4+4 → `[4]` only, climber on the summit.
- **Summit block:** a climber on the 2-summit, then a roll giving only 2s and blocked sums → fall.
- **Claimed:**
  - Column claimed by another player → a sum there is unusable, and the other sum of the pairing is still offered.
  - Your own claimed column is also blocked.
- **Entry point:** a camp at 3 in column 9 → a new climber enters at 4.
- **Stop:** camps move to the climbers. A summit claims the column and **removes opponents' camps** there. The next seat goes to `first-roll`, with dice null and climbers empty.
- **Fall:** no legal moves → `fell`. Camps are unchanged, the climbers stay visible until `advanceReveal`, then are cleared and the turn passes. A summit reached in a turn that falls is **not** claimed.
- **First roll can fall:** all sums of a roll in claimed columns → `fell` from `first-roll`.
- **Rejections leave state unchanged** (deep-equal the view before and after):
  - acting out of turn
  - `stop` in `first-roll` and in `choosing`
  - `climb` in `deciding`
  - an illegal `climb`
  - `roll` in `choosing`
- **Win:**
  - Stopping with the 3rd claim → `game-over` with `winnerId`. No further actions are accepted.
  - `goal: 4` option respected.
- **Standings:** non-winners ordered by claims then progress, and exact ties share a place.
- **View:**
  - `canAct` is true only for the active connected human. The spectator view has `canAct: false` and otherwise equals a player view.
  - `stopWins` and `certainFall` flags are correct.
- **Stand-ins:** a disconnected active human → the stand-in rolls, picks a move, and stops at the first `deciding`. Automation pauses with no connected humans.
- **Bot:**
  - always stops on `stopWins` and on a summit
  - picks the summit move when available
  - never sends an illegal move (property test: 500 seeded random games with 2–4 bots all reach `game-over` within 2000 turns)
- **Variants:**
  - `skip`: a climber jumps over occupied spaces and caps at the summit.
  - `block`: `stop` is rejected while a climber shares a space with an opponent's camp.
- **Socket:** add `'top-out'` to `seededPlaythroughs.test.ts`. Add malformed `climb` payloads (strings, length 3, 13, unsorted, floats, extra keys) to `actionBoundary.test.ts`.

**Playwright** (`apps/parlor/e2e/top-out.test.ts`, 390×844, modelled on `e2e/spades.test.ts`):
1. Open "How to play" for Top Out and close it.
2. Create a room, vote for Top Out, add 1 bot, Play, Start.
3. Wait for "Your turn" (if the bot goes first, wait for it). Click ROLL.
4. If a move button is visible, tap it twice and expect the Stop button. Click Stop and expect the banner to show the bot's turn.
5. If the roll fell, expect "fell".

This proves roll → climb → stop end to end.

## 11. Open questions for the human

1. **Name:** "Top Out" OK? (Alternatives: Summit Dash, Ridgeline.)
2. **Certain-fall roll:** keep it legal (faithful, with a warning) or disable Roll when every climber is on a summit?
3. **Bot colours:** allow bot camps in `seatTone(seat)` while the bot's SeatChip avatar stays ink, with a swatch in the chip? Or change the kit so bot avatars use their seat tone?
4. **Jackbox (TV + phones) mode:** this game is the obvious first one for it, but no infra exists. Ship peer-only now?
5. **Shelf colour:** linen (shared with Kings Corner), or add a sixth shelf colour?

## 12. Sources

- Wikipedia, "Can't Stop (board game)": column heights, publishers, the "if you can place you must" ambiguity, speed and blocking variants. https://en.wikipedia.org/wiki/Can%27t_Stop_(board_game)
- RulesPal, Can't Stop rulebook transcription: placement, use both sums, one marker left so you choose, summit not won until stop, opponents' squares removed on a win, claimed columns closed, longer game, Variants A/B. https://rulespal.com/cant-stop/rulebook
- Community rules summary: https://lehi-innovation.github.io/boardgame-rules/rules/can-t-stop/
- Michael Keller, "Rule of 28" heuristic, as summarised widely on BoardGameGeek (Can't Stop forums): https://boardgamegeek.com/boardgame/41/cant-stop
- `docs/LEGAL.md` (naming), `docs/ADDING_GAMES.md`, `apps/parlor/DESIGN.md`, `apps/parlor/.impeccable/design-full.md` (Game boards).
