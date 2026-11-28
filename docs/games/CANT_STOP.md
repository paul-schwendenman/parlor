# Can't Stop: implementation brief

> Sid Sackson's Can't Stop, shipped under its real name (§2). All rules text here is paraphrased.

## 1. Overview

A push-your-luck race up eleven columns numbered 2–12. On your turn you roll four dice, split them into two pairs and advance up to three neutral **runners** in the columns those sums name. Keep rolling to push higher, or stop and replace the runners with your own coloured **markers** (permanent progress). A roll you can't use is a **bust**, and you lose everything you gained that turn. Reach the top of a column to claim it. The first player to claim three columns wins.

| | |
|---|---|
| Players | 2–4 (bots can fill seats) |
| Time | 15–30 min |
| Display mode | `peer` (everyone on their own device). Parlor has no Jackbox (shared screen) mode yet: `GameMeta.displayModes` allows `'jackbox'`, but nothing renders it. The old draft's TV/phone split is deferred (§11). The board has to work on a 390px phone. |
| Hidden info | None. All views are the same apart from `you`/`canAct`. |
| Why Parlor | Readable in one roll for children and grandparents alike. Every turn has table-wide tension ("stop!"). Turns are short. The board makes a strong shelf-defining visual. It also gives Farkle a "Roll / Stop" pattern to reuse later. |

## 2. Naming & IP

Policy (coordinator, 2026-11-27): Parlor ships games under their real names, as it already does with Quixx. The rename rule in `docs/LEGAL.md` is now a step before any public launch, not current policy.

- **Name:** "Can't Stop". Id and package: `cant-stop` / `@parlor/cant-stop`. Shelf tagline: "Push your luck up eleven columns".
- **Component names:** the original terms. **Runners** are the three neutral pieces used during a turn. **Markers** (cones) are each player's permanent pieces in their colour. A column is **claimed** when you stop with a runner at its top. A roll you can't use is a **bust**.
- **Ours, not theirs:** the art, board layout, colours and UI are original to Parlor (§8). No publisher box art, board graphics or logos (Parker Brothers, Face 2 Face, Eagle-Gryphon).
- **Rules wording:** Parlor's own words, in this doc and in `RulesModal`. Never copy rulebook text; paraphrase only. Nothing in this doc is a verbatim rulebook quote.
- Before a public launch, revisit this under `docs/LEGAL.md` (it would need a rename and a re-theme).
- The `docs/GAMES.md` row needs updating (display mode `peer`; IP "Real name, original art/wording"). That is the implementer's change, not this doc's.

## 3. Rules (verified)

### Components and setup
- 4 six-sided dice. 3 white runners (shared, used only by the active player). Each player has one coloured marker (cone) per column.
- Column heights (number of spaces; the top space is the top):

| Column | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Spaces | 3 | 5 | 7 | 9 | 11 | 13 | 11 | 9 | 7 | 5 | 3 |

- Positions are 1-based. 0 means "not on the column". Position `h` (the column's height) is the top.
- Setup is the same for every player count. **First player** is chosen at random (the rulebook has players roll for it, which comes to the same thing), and play goes clockwise in seat order.

### Turn
1. **Roll** all four dice. The first roll of a turn is mandatory: a turn can't be stopped before rolling.
2. **Choose a pairing.** Four dice split into exactly three pairings: (A+B, C+D), (A+C, B+D), (A+D, B+C). Each pairing gives two sums.
3. **Place.** Apply the chosen pairing's sums one at a time:
   - The column already has a runner: it moves up 1.
   - No runner yet, and fewer than 3 runners on the board: a runner enters at **your marker + 1** (at space 1 if you have no marker there).
   - A sum **cannot be used** if the column is **claimed** (by anyone, including you), if the runner there is **already at the top** (it can't pass the top), or if it would need a 4th runner.
4. **Must-use rule (the precise spec):**
   - You may choose **any pairing that places at least one runner**. You don't have to pick the pairing that places the most. If at least one pairing places something, you can't bust voluntarily.
   - Within the chosen pairing, **if both sums can be used together you must use both.**
   - If both can't be used together but each can be used alone (the usual case is **one runner left** and **two different new columns**), **you choose which one to use**. The other is ignored.
   - If only one sum is usable, you use that one and the other is ignored.
   - "Together" is evaluated **sequentially**, which matters for doubles. With the last free runner and the pairing 6+6 on a new column, the first 6 places the runner and the second 6 moves it up, so both are used. With a runner one space below the top on 4 and the pairing 4+4, the first 4 reaches the top and the second is ignored (it can't pass the top).
5. **Decide:** **Roll** again, or **Stop**.
   - **Stop:** each runner becomes your marker at its position (your old marker in that column is replaced). Every runner that is at the top of its column **claims that column** for you: all other players' markers in that column are removed and the column is closed to everyone for the rest of the game. Then your turn ends.
   - **Bust:** if a roll offers **no pairing that places anything**, you bust. All runners come off, your markers stay where they were, nothing is claimed, and your turn ends. Reaching a column top during the turn means nothing until you stop.
6. **Opponents' markers don't block.** A runner may share a space with any opponent's marker (published base rule).

### End and scoring
- After a Stop, if you hold at least `goal` claimed columns (default 3), **you win immediately**. Claims can only happen on your own Stop, so exactly one player can win at a time.
- Nobody else gets a final turn, and there are no tie-breaks for first place. For `GameOver` standings, the others are ranked by columns claimed, then by total progress (the sum of marker/height over unclaimed columns). Exact ties share a place.

### FAQ rulings and defaults

| Question | Ruling / default | Source |
|---|---|---|
| Does the must-place rule force a pairing choice? | No. You pick any pairing that places at least one runner, and you must use both of its sums if they fit. Wikipedia notes the ambiguity (its 2-2-5-5 example). We take the common reading. | Wikipedia, RulesPal |
| One runner left, pairing gives two new columns | You choose which one. | RulesPal (one runner left: player picks the column) |
| Runner reached the top mid-turn | It stays there. That column can't take more sums this turn. It is claimed only on Stop, and lost if you bust. | RulesPal |
| Can I enter a column I already claimed? | No, it is closed to everyone. | RulesPal |
| Runner on another player's marker | Allowed (base). Skip and block rules are variants. | RulesPal, Wikipedia |
| Two players' markers at the top of the same column? | Impossible. The first to stop on it claims it and removes the others' markers. | Rules |
| All three runners at the top of their columns, roll again? | Faithful default: allowed (it is a guaranteed bust). The UI warns, and the shouted action becomes STOP AND WIN or STOP. See §11. | Rules |
| Common misplays the UI must prevent | Only legal moves are offered, so nobody "forgets" a usable sum or places a 4th runner. | — |

## 4. Host options

Parlor has **no per-room game-options infrastructure yet**: `createState(_room, players)` takes no options, and no game reads any. Build the engine with a constructor parameter `options: CantStopOptions = DEFAULTS` (like Hearts' `goal`) and ship **without** a lobby UI. Toggles appear when options infra lands.

| Option | Values | Default | Notes |
|---|---|---|---|
| `goal` (columns to win) | 3 / 4 / 5 | 3 | The rulebook's longer game suggests 4–5 for 2–3 players. |
| `passing` | `'share'` / `'skip'` / `'block'` | `'share'` | `skip` = Sackson's faster variant (a runner entering or moving onto an occupied space jumps to the next free space; it can't pass the top, so it stops there if all spaces above are taken). `block` = you may not **Stop** with a runner on an opponent's marker. That makes Stop illegal in that state, so you must roll. It is a variant of RulesPal's "Variant B". |
| Turn timer | — | — | No infra. Out of scope. |

## 5. State model

`games/cant-stop/src/types.ts`:

```ts
export const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Column = (typeof COLUMNS)[number];
export const HEIGHT: Record<Column, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};
export type Dice = [number, number, number, number];
export type ColumnMap<T> = Partial<Record<Column, T>>; // plain objects, JSON-safe (no Map)

export type CantStopPhase =
  | 'first-roll'   // active player must roll (Stop not allowed)
  | 'choosing'     // dice are rolled and there is ≥1 legal move; pick one
  | 'deciding'     // a move was placed; Roll or Stop
  | 'busted'         // reveal: the roll that busted, runners still shown; advanceReveal() ends the turn
  | 'game-over';

/** A move is the list of columns to advance, in application order; sorted ascending; length 1 or 2. */
export type Move = [Column] | [Column, Column];

export interface PairingOption {
  /** Dice indices into `dice`, e.g. [[0,1],[2,3]]. */
  pairs: [[number, number], [number, number]];
  sums: [number, number];          // 2..12
  /** Legal moves from this pairing: [] (unusable), [[a,b]] (both), [[a]] (one), or [[a],[b]] (choose one). */
  moves: Move[];
}

export interface CantStopOptions { goal: number; passing: 'share' | 'skip' | 'block' }

export type CantStopAction =
  | { type: 'roll' }
  | { type: 'place'; columns: Move }
  | { type: 'stop' };

export interface CantStopPlayerView {
  id: string; name: string; bot: boolean; connected: boolean;
  seat: number;                    // index, for seatTone(seat)
  markers: ColumnMap<number>;        // permanent positions (unclaimed columns only)
  claimed: Column[];
}

export interface CantStopView {
  phase: CantStopPhase;
  goal: number;
  players: CantStopPlayerView[];
  activePlayerId: string | null;   // null at game-over
  claimedBy: ColumnMap<string>;    // column -> player id
  runners: ColumnMap<number>;     // this turn's positions (also shown during 'busted')
  dice: Dice | null;               // null in 'first-roll'
  rollId: number;                  // increments each roll; the client keys the dice animation on it
  pairings: PairingOption[] | null;// set in 'choosing' and 'busted' (all three, so a bust is explainable)
  lastMove: Move | null;           // move just placed (for highlight) in 'deciding'
  canAct: boolean;                 // viewer is the active, connected human
  canStop: boolean;                // phase 'deciding' && (passing !== 'block' || !blocked)
  stopWins: boolean;               // stopping now reaches `goal`
  certainBust: boolean;            // 3 runners out and every one at the top of its column
  winnerId: string | null;
  turn: number;                    // 1-based count of turns taken, for the banner and tests
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'cant-stop': CantStopView }
  interface GameActionMap { 'cant-stop': CantStopAction }
}
```

Server state (private fields in `CantStopEngine`, like `HeartsEngine`):

```ts
interface Seat { id: string; name: string; bot: boolean; connected: boolean; markers: ColumnMap<number> }
class CantStopEngine {
  private seats: Seat[];
  private phase: CantStopPhase = 'first-roll';
  private active: number;                  // randomInt(seats.length) at construction
  private claimedBy: ColumnMap<string> = {};
  private runners: ColumnMap<number> = {};
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
first-roll --roll--> (legalMoves.length ? choosing : busted)
choosing   --place--> deciding   (no auto-stop, even when stopWins)
deciding   --roll--> (legalMoves.length ? choosing : busted)
deciding   --stop--> commit; claims; (won ? game-over : next seat, first-roll)
busted     --advanceReveal (timer)--> clear runners; next seat, first-roll
```

`rules.ts` (pure; the client may import it, but the view already precomputes everything):

```ts
export function pairings(d: Dice): [[number,number],[number,number]][]; // fixed order: AB|CD, AC|BD, AD|BC
/** Simulate placing `cols` in order; returns new runners or null if any step is illegal. */
export function tryPlace(cols: Column[], runners: ColumnMap<number>, markers: ColumnMap<number>, claimed: ColumnMap<string>, passing, opponentsMarkers): ColumnMap<number> | null;
export function pairingOptions(d: Dice, ctx): PairingOption[]; // per §3.4:
//   both = tryPlace([a,b]) -> moves=[[a,b]] (sorted)
//   else oneA = tryPlace([a]), oneB = a!==b && tryPlace([b]) -> moves = filter([[a]],[[b]])
export function legalMoves(d: Dice, ctx): Move[]; // flattened + de-duplicated by key (e.g. 1-1-6-6 gives [2,12] and [7,7] once)
```

## 6. Actions

All turn-based. Only the active seat may act (`GameRuleError('It is not your turn.')`), and every check runs before any mutation.

| Action | Payload validation (`validateAction`, untrusted) | Engine rule checks | Transition |
|---|---|---|---|
| `roll` | `hasExactKeys(['type'])` | phase ∈ {`first-roll`, `deciding`} | `rollId++`, roll 4× `randomInt(6)+1`, compute options. No legal move → `busted`, else `choosing`. |
| `place` | `hasExactKeys(['type','columns'])`; array of 1–2 integers in 2..12; sorted ascending. Else `invalid('Choose a move.')` | phase `choosing`; `columns` equals (by key) one of `legalMoves` → else `GameRuleError('That move is not available for this roll.')` | Apply in order, set `lastMove`, `dice` stays visible → `deciding`. |
| `stop` | `hasExactKeys(['type'])` | phase `deciding`; `canStop` | Commit runners to markers; claim topped columns (remove others' markers in those columns); win check; else advance seat, reset runners/dice/lastMove, `turn++`, `first-roll`. |

**Timing / reveals (`definition.ts` `drive`, copy Hearts):**
- `busted` → `advanceReveal()` after **2000 ms** (the dice and the stranded runners stay visible).
- Bot / stand-in steps every **700 ms**, slower than Hearts' 400 ms so humans can follow roll → choose → roll. Recompute `automaticMove()` inside the callback.
- No reveal phase for Stop. The client animates the commit from the view diff.
- Stop on a fresh roll isn't possible: you can't stop in `choosing`, because a usable roll has to be used.

**Seats and connection:**
- `setConnected(id, c)`.
- A disconnected human's seat is played by a **cautious stand-in**: it rolls if in `first-roll`, takes the best move in `choosing`, and **stops at the first `deciding`**, so an absent player keeps their progress.
- `onPlayerRemoved` = permanent stand-in (the Hearts/Oh Hell pattern; the seat keeps its markers and claims, so the board stays intact).
- Pause automation when no connected human remains (the Hearts guard).

## 7. Mapping to this codebase

- **Package:** `games/cant-stop`, `@parlor/cant-stop`, id `'cant-stop'`. No `@parlor/cards` dependency.
- **Files** (per `docs/ADDING_GAMES.md`): `package.json`, `tsconfig.json`, and `turbo.json` copied from `games/hearts`; `src/types.ts`, `src/meta.ts`, `src/rules.ts`, `src/engine.ts`, `src/definition.ts`, `src/GameView.svelte`, plus `src/bot.ts` (pure policy, unit-testable).
- **Meta:** `minPlayers: 2, maxPlayers: 4, estimatedMinutes: '15-30', tags: ['dice', 'push-your-luck', 'family'], displayModes: ['peer'], supportsBots: true`.
- **Copy from:**

| What | From |
|---|---|
| Engine skeleton (`GameRuleError`, `randomInt`, `automaticMove`, `setConnected`, `view`, stand-in guard) | `games/hearts/src/engine.ts` |
| `drive`, hooks, `validateByType` | `games/hearts/src/definition.ts` |
| Reveal timing pattern | `trick-won` in Hearts |
| Dice tray look and roll feel | `games/liars-dice` and `games/booty-dice` GameViews (older apps; borrow presentation only) |

- **Wiring:** the six places in ADDING_GAMES §7. Add `{ ...cantStopMeta, shelf: 'linen', tagline: 'Push your luck up the board' }` to `apps/parlor/src/lib/games/catalog.ts`, add a `RulesModal` section, and update the shelf list in `design-full.md` ("Its colour").
- **Reuse from `@parlor/ui`:** `TurnBanner`, `SeatChip` (stat "1 column", plus a child swatch of the marker colour, see below), `PipDie` (default paper face/ink pips), `Button` (`shout` for ROLL / STOP AND WIN), `GameOver` with `Standing.detail` "3 columns", and `seatTone`.
- **New, game-local (not board kit):** `ColumnBoard.svelte` (the column board) and `MoveOptions.svelte`.
- **Board-kit candidate (flag, don't build yet):** a `RollStopBar` (shouted Roll plus outline Stop with a risk hint) and a `DiceTray` (4–6 `PipDie` with a roll animation keyed on `rollId`). Farkle and Yahtzee will need the same, so promote them when the second dice package lands (Collection Rule).
- **Colour wrinkle:** `SeatChip` and `GameOver` draw **every bot avatar as ink**. On this board, markers **must** use `seatTone(seat)` for bots too, or two bots would be indistinguishable. Show the marker colour as a small swatch inside the SeatChip (children snippet). See §11.

## 8. Board UI

**Surface:** the board is a **linen** block (2.5px ink outline, 18px corners). The shelf colour is **linen**, shared with Kings Corner. It is the only neutral option: clay, felt, mustard, and ink are all seat colours, so markers in those colours must read against the board. The next shelf neighbour is Oh Hell (mustard), so neighbouring blocks still differ.

**Columns:** **bottom-aligned** columns, so the silhouette is a stepped peak at 7 and progress reads as "up". Each column is a stack of paper cells with an ink outline. Its number sits in a pill under the base (Nunito 900), and the top cell has a flag notch.
- **Markers:** each seat has a **fixed corner** of the cell (seat 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right), drawn as a seat-tone dot with an ink ring. The fixed position is a non-colour cue.
- **Runner:** a white disc, larger, with a 2.5px ink outline, centred over the markers. When it's at the top of its column it wears the mustard ring.
- **Claimed column:** the cells fill solid in the claimer's seat tone and the markers are hidden. A flag in the seat tone sits at the top, and the number pill shows the claimer's initial.

**Phone (390px, 16px gutters → 358px):** 11 columns × 28px plus 10 × 4px gaps = 348px. Cells are 28×22, so column 7 is 13×22 + gaps ≈ 320px tall. No scroll, no zoom.

```
[ Lid: PARLOR            ?  Leave ]
[ TurnBanner: Your turn · "Pick a move. Both sums move up." ]
[ (A)Alex 1⚑ ][ (B)Bot 0 ][ (C)Sam 2⚑ ]   <- SeatChips, horizontal scroll if 4
+------------ linen board ------------+
|                 [■]                    |
|             [ ][ ][ ]                  |
|          [ ][ ][o][ ][ ]               |  o = white runner
|  ...   bottom-aligned, peak at 7  ...  |
| (2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)   |
+----------------------------------------+
[ dice: ⚂ ⚃ ⚁ ⚄ ]
[ 3+4 · 2+5   →  7 and 7          ]   <- one row per pairing
[ 3+2 · 4+5   →  5 and 9          ]
[ 3+5 · 4+2   →  Move 8 | Move 6 ]   <- split choice: two buttons
   (an unusable pairing stays as a dimmed row: "Can't use: 8 is claimed")
          [  ROLL  ]  ( Stop )         <- in 'deciding'
```

**Desktop (≥ 900px):** two columns. On the left, the board at cells 44×34 (column 7 ≈ 480px tall). On the right, a 340px rail: TurnBanner, SeatChips (`wide` rows with "2 columns · 4 markers"), the dice tray (PipDie `--die-size: 56px`), the pairing rows, then Roll/Stop. Between 520 and 900px it is a single column like the phone, with cells 36px.

**Interactions:**
- **Moves:** each pairing row shows its two dice pairs as small dice and the move button(s).
  - First tap selects the move (butter) and **previews** it on the board: ghost runners at the destinations, and the target cells wear the mustard ring. The banner reads "Tap 5 and 9 again to move."
  - Second tap sends `place`. This matches the card games' tap-twice convention.
  - Tapping a cell on the board is not an input (columns are too thin for reliable taps on a phone).
  - Unusable pairings stay listed, dimmed, with a reason ("8 is claimed", "No runners left", "6 is at the top").
- **Roll/Stop:** in `first-roll`, a single shouted **ROLL**. In `deciding`, a shouted **ROLL** plus an outline **Stop** pill.
  - When `stopWins`, swap them: shouted **STOP AND WIN**, outline "Roll".
  - When `certainBust`, the Roll pill's hint reads "Every runner is at the top. Rolling will bust."
  - With `passing: 'block'`, Stop is disabled and its hint says why.
- **Banner copy:** "Your turn" / "Sam's turn". Details: "Roll to start your turn.", "Pick a move.", "Roll again or stop to lock in your progress.", "Sam busted! No progress this turn.", "Sam claimed 7."
- **Watching:** others see the same dice and options read-only (no buttons, rows as text), so the table can shout "stop!".
- **Accessibility:** the board is a `region` "Board". Each column is a list item labelled e.g. "Column 7, 13 spaces: runner on 6; Alex marker 4; Sam marker 2", or "Column 7, claimed by Sam".

**Animations** (moderate; all dropped under `prefers-reduced-motion`):

| Event | Animation |
|---|---|
| Roll | Dice tumble about 500 ms, keyed on `rollId`. |
| Advance | Runner slides up one cell per step, 180 ms each. |
| Bust | Runners drop down their columns and fade (500 ms). The banner shakes once. |
| Stop | Runners shrink into seat-tone marker dots (300 ms). |
| Claim | The column fills bottom-to-top in seat tone (600 ms) and the flag pops at the top. |

## 9. Bot AI (`bot.ts`)

The policy is deterministic given the dice. It is used for bots, and for stand-ins with the cautious stop rule (§6).

**Choosing a move.** Score each legal move and take the max:
- `+ Σ steps × 12 / HEIGHT[col]`. A step on a short column is worth more.
- `+ 100` if a runner reaches the top of a column.
- `− 6` for each new runner placed, and a further `− 6` if it is the **last** free runner.
- `+ 2` for each step on columns 6–8 (best odds next roll).
- Tie-break: prefer the move that leaves the lowest chance of busting on the next roll (exact enumeration over the 1296 rolls; cheap), then the lowest column key.

**Roll or stop** (adapted from Michael Keller's "Rule of 28"):
- Keep a turn score. Each step adds the column weight (7→1, 6/8→2, 5/9→3, 4/10→4, 3/11→5, 2/12→6), and placing a new runner doubles that column's weight once.
- Once all three runners are out, add `+4` if all three columns are ≥ 8 or all are ≤ 6 (lopsided sets bust more often). Keller's odd/even adjustments are left out for simplicity.
- **Stop** if any of these holds:
  - `stopWins`
  - any runner is at the top of its column
  - `certainBust`
  - turn score ≥ 28
  - the exact chance of busting on the next roll is > 0.5 with ≥ 1 step gained
- Otherwise roll.
- Fewer than 3 runners out: never stop unless score ≥ 28. A next-roll bust is impossible with a free runner unless all sums are blocked, and the enumeration handles that case.

This is good enough to fill seats and beat a careless human sometimes. If wanted later, the weights become GA genes (`docs/AI_STRATEGIES.md`).

## 10. Test plan

**Engine and rules** (`apps/parlor/src/lib/server/cant-stop.test.ts`, seeded `randomInt` returning scripted dice):

- **`pairings`:**
  - [1,2,3,6] → sums (3,9), (4,8), (7,5) in AB|CD, AC|BD, AD|BC order.
  - [1,1,6,6] → legal moves `[2,12]` and `[7,7]` only (deduplicated).
- **Must-use and choose-one:**
  - Two runners out (on 5 and 7, so one is free) and a pairing giving 4/9, both new columns → it yields `[[4],[9]]` (choose one), and `place {columns:[4,9]}` is rejected.
  - Pairing 7/9 with a runner already on 7 and one free → `[[7,9]]` only, and `place [7]` is rejected (must use both).
- **Doubles:**
  - Last free runner with 6+6 on a new column → `[6,6]` legal, runner at marker+2.
  - Runner at `h−1` on 4 with 4+4 → `[4]` only, runner at the top.
- **Top block:** a runner at the top of column 2, then a roll giving only 2s and blocked sums → bust.
- **Claimed:**
  - Column claimed by another player → a sum there is unusable, and the other sum of the pairing is still offered.
  - Your own claimed column is also blocked.
- **Entry point:** a marker at 3 in column 9 → a new runner enters at 4.
- **Stop:** markers move to the runners. A runner at the top claims the column and **removes opponents' markers** there. The next seat goes to `first-roll`, with dice null and runners empty.
- **Bust:** no legal moves → `busted`. Markers are unchanged, the runners stay visible until `advanceReveal`, then are cleared and the turn passes. A column top reached in a turn that busts is **not** claimed.
- **First roll can bust:** all sums of a roll in claimed columns → `busted` from `first-roll`.
- **Rejections leave state unchanged** (deep-equal the view before and after):
  - acting out of turn
  - `stop` in `first-roll` and in `choosing`
  - `place` in `deciding`
  - an illegal `place`
  - `roll` in `choosing`
- **Win:**
  - Stopping with the 3rd claim → `game-over` with `winnerId`. No further actions are accepted.
  - `goal: 4` option respected.
- **Standings:** non-winners ordered by claims then progress, and exact ties share a place.
- **View:**
  - `canAct` is true only for the active connected human. The spectator view has `canAct: false` and otherwise equals a player view.
  - `stopWins` and `certainBust` flags are correct.
- **Stand-ins:** a disconnected active human → the stand-in rolls, picks a move, and stops at the first `deciding`. Automation pauses with no connected humans.
- **Bot:**
  - always stops on `stopWins` and at the top of its column
  - picks the move that tops a column when available
  - never sends an illegal move (property test: 500 seeded random games with 2–4 bots all reach `game-over` within 2000 turns)
- **Variants:**
  - `skip`: a runner jumps over occupied spaces and stops at the top.
  - `block`: `stop` is rejected while a runner shares a space with an opponent's marker.
- **Socket:** add `'cant-stop'` to `seededPlaythroughs.test.ts`. Add malformed `place` payloads (strings, length 3, 13, unsorted, floats, extra keys) to `actionBoundary.test.ts`.

**Playwright** (`apps/parlor/e2e/cant-stop.test.ts`, 390×844, modelled on `e2e/spades.test.ts`):
1. Open "How to play" for Can't Stop and close it.
2. Create a room, vote for Can't Stop, add 1 bot, Play, Start.
3. Wait for "Your turn" (if the bot goes first, wait for it). Click ROLL.
4. If a move button is visible, tap it twice and expect the Stop button. Click Stop and expect the banner to show the bot's turn.
5. If the roll busted, expect "busted".

This proves roll → place → stop end to end.

## 11. Open questions for the human

1. **Pre-launch rename:** when Parlor goes public, pick a new name and theme then (per `docs/LEGAL.md`)? Not needed now.
2. **Certain-bust roll:** keep it legal (faithful, with a warning) or disable Roll when every runner is at the top of its column?
3. **Bot colours:** allow bot markers in `seatTone(seat)` while the bot's SeatChip avatar stays ink, with a swatch in the chip? Or change the kit so bot avatars use their seat tone?
4. **Jackbox (TV + phones) mode:** this game is the obvious first one for it, but no infra exists. Ship peer-only now?
5. **Shelf colour:** linen (shared with Kings Corner), or add a sixth shelf colour?

## 12. Sources

- Wikipedia, "Can't Stop (board game)": column heights, publishers, the ambiguity over when the must-place rule applies, speed and blocking variants. https://en.wikipedia.org/wiki/Can%27t_Stop_(board_game)
- RulesPal, Can't Stop rulebook transcription: placement, use both sums, one runner left so the player chooses, a column top isn't won until stop, opponents' squares removed on a win, claimed columns closed, longer game, Variants A/B. https://rulespal.com/cant-stop/rulebook
- Community rules summary: https://lehi-innovation.github.io/boardgame-rules/rules/can-t-stop/
- Michael Keller, "Rule of 28" heuristic, as summarised widely on BoardGameGeek (Can't Stop forums): https://boardgamegeek.com/boardgame/41/cant-stop
- `docs/LEGAL.md` (naming), `docs/ADDING_GAMES.md`, `apps/parlor/DESIGN.md`, `apps/parlor/.impeccable/design-full.md` (Game boards).
