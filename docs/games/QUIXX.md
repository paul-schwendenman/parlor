# Quixx - Game Specification

## Overview

Quixx is a roll-and-write dice game for 2-5 players. Each player has a scoresheet with four colored rows of numbers. On each turn, dice are rolled and players mark numbers on their sheets, trying to score the most points. The game is simple to learn but has meaningful decisions about when to skip numbers and when to play it safe.

Quixx is the first game being built for Parlor.

---

## Rules (Standard Published)

### Components

- **6 dice**: 2 white, 1 red, 1 yellow, 1 green, 1 blue
- **Scoresheet** per player with 4 rows:

```
Red:    [ 2] [ 3] [ 4] [ 5] [ 6] [ 7] [ 8] [ 9] [10] [11] [12] [lock]
Yellow: [ 2] [ 3] [ 4] [ 5] [ 6] [ 7] [ 8] [ 9] [10] [11] [12] [lock]
Green:  [12] [11] [10] [ 9] [ 8] [ 7] [ 6] [ 5] [ 4] [ 3] [ 2] [lock]
Blue:   [12] [11] [10] [ 9] [ 8] [ 7] [ 6] [ 5] [ 4] [ 3] [ 2] [lock]
```

- Red and Yellow rows go 2-12 (ascending, left to right)
- Green and Blue rows go 12-2 (descending, left to right)
- 4 penalty boxes per player

### Turn Structure

Each turn has two phases:

#### Phase 1: White Dice (All Players)

1. Active player rolls all 6 dice
2. The sum of the two white dice is announced
3. **All players** (including the active player) may optionally mark this number on **any one row** of their scoresheet
4. This is simultaneous - players decide independently

#### Phase 2: Colored Dice (Active Player Only)

1. The active player may optionally choose **one** white die and **one** colored die
2. They sum those two dice and mark that number on the **matching colored row**
3. Only the active player may do this
4. This is in addition to any mark made in Phase 1

#### Penalty

- If the active player does **not** mark any number in **either** phase, they must take a penalty (-5 points)
- Non-active players never take penalties (they can always choose not to mark in Phase 1)

### Marking Rules

- Numbers must be marked **left to right** on each row
- You may skip numbers, but you can **never go back** to mark a skipped number
- A number is "available" only if it is to the right of all previously marked numbers in that row

### Locking a Row

- To mark the **rightmost number** in a row (12 for red/yellow, 2 for green/blue), you must have **at least 5 marks** already in that row
- When you mark the rightmost number, you also mark the **lock** box (counts as an extra mark for scoring)
- The row is now **locked for all players** - no one can mark in this row anymore
- The corresponding colored die is **removed from the game**

### Game End

The game ends immediately when **any** of these occur:
- **2 rows are locked** (by any combination of players)
- A player takes their **4th penalty**

### Scoring

Marks per row determine points using this table:

| Marks | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|-------|---|---|---|---|---|---|---|---|---|----|----|----|
| Points | 1 | 3 | 6 | 10 | 15 | 21 | 28 | 36 | 45 | 55 | 66 | 78 |

(The formula is `n * (n + 1) / 2` - triangular numbers)

- Each row is scored independently
- The lock mark counts as an additional mark in that row
- Subtract 5 points per penalty
- **Total = sum of all four row scores - (penalties x 5)**
- Highest total wins. Ties are shared victories.

---

## Game State Model

### Server State (Canonical)

```typescript
interface QuixxGameState {
  roomId: string;
  players: QuixxPlayer[];
  activePlayerIndex: number;
  dice: DiceState;
  lockedRows: Set<RowColor>;   // rows locked for everyone
  removedDice: Set<RowColor>;  // colored dice removed from game
  phase: QuixxPhase;
  round: number;
  gameOver: boolean;
  winner: string | null;       // player ID or null for tie
}

interface QuixxPlayer {
  id: string;
  name: string;
  connected: boolean;
  sheet: Scoresheet;
  penalties: number;
  phase1Choice: Phase1Choice | null;  // their choice for current turn's phase 1
}

interface Scoresheet {
  red: boolean[];    // 11 cells (indices 0-10 = numbers 2-12)
  yellow: boolean[]; // 11 cells (indices 0-10 = numbers 2-12)
  green: boolean[];  // 11 cells (indices 0-10 = numbers 12-2)
  blue: boolean[];   // 11 cells (indices 0-10 = numbers 12-2)
}

interface DiceState {
  white1: number;
  white2: number;
  red: number;
  yellow: number;
  green: number;
  blue: number;
  rolled: boolean;
}

type RowColor = 'red' | 'yellow' | 'green' | 'blue';

type QuixxPhase =
  | 'rolling'        // waiting for dice to be rolled
  | 'phase1'         // all players choosing white dice action
  | 'phase2'         // active player choosing colored dice action
  | 'turn-end'       // brief pause before next turn
  | 'game-over';     // final scores displayed

interface Phase1Choice {
  row: RowColor;
  cellIndex: number;
} | { pass: true };
```

### Player View (What each client sees)

```typescript
interface QuixxPlayerView {
  // Public info
  players: {
    id: string;
    name: string;
    connected: boolean;
    sheet: Scoresheet;     // all sheets are public in Quixx
    penalties: number;
    phase1Submitted: boolean;  // whether they've made their phase 1 choice (not what it is)
  }[];

  activePlayerIndex: number;
  dice: DiceState;
  lockedRows: RowColor[];
  removedDice: RowColor[];
  phase: QuixxPhase;
  round: number;
  gameOver: boolean;
  scores: Record<string, number> | null;  // only populated at game-over

  // Private to this player
  myIndex: number;
  isActivePlayer: boolean;
  availableMoves: AvailableMove[];  // pre-computed legal moves for this player
}
```

### Actions (Client to Server)

```typescript
type QuixxAction =
  | { type: 'roll-dice' }                                    // active player initiates roll
  | { type: 'phase1-mark'; row: RowColor; cellIndex: number } // mark white dice sum
  | { type: 'phase1-pass' }                                   // skip phase 1
  | { type: 'phase2-mark'; row: RowColor; cellIndex: number } // mark colored combo
  | { type: 'phase2-pass' }                                   // skip phase 2 (may cause penalty)
  ;
```

---

## Turn Flow (Detailed)

```
1. Phase: 'rolling'
   - UI shows "Roll dice" button to active player (or auto-rolls, depending on config)
   - Active player sends { type: 'roll-dice' }
   - Server rolls dice, broadcasts results

2. Phase: 'phase1'
   - Server computes white dice sum and each player's available moves
   - All players see dice results and choose simultaneously:
     - Mark the white sum on any valid row, OR
     - Pass
   - Server waits for all players to submit (with optional timer)
   - Server validates and applies all choices

3. Phase: 'phase2'
   - Server computes available colored combos for active player
   - Active player chooses:
     - One white die + one colored die combo on the matching row, OR
     - Pass
   - If active player passed BOTH phases, they take a penalty
   - Server validates and applies

4. Check game-end conditions:
   - 2+ rows locked? -> game over
   - Active player has 4 penalties? -> game over

5. Phase: 'turn-end' (brief, ~1-2s)
   - Show what happened this turn
   - Advance to next player
   - Go to step 1
```

---

## Validation Rules

The server must validate every action. Key validations:

### Mark Validation

```
canMark(sheet, row, cellIndex, lockedRows):
  1. Row is not locked
  2. Cell is not already marked
  3. Cell is to the RIGHT of all marked cells in this row
  4. If cellIndex is the last cell (rightmost number):
     - Player must have >= 5 marks in this row already
```

### Phase 1 Validation

```
validatePhase1(action, player, dice):
  1. White sum = dice.white1 + dice.white2
  2. If marking: the number at the chosen row/cellIndex must equal the white sum
  3. If marking: canMark(player.sheet, row, cellIndex, lockedRows) must be true
```

### Phase 2 Validation

```
validatePhase2(action, player, dice, removedDice):
  1. Player must be the active player
  2. The chosen colored die must not be removed
  3. Combo sum = chosen white die value + chosen colored die value
  4. The number at the chosen row/cellIndex must equal the combo sum
  5. The row must match the colored die color
  6. canMark(player.sheet, row, cellIndex, lockedRows) must be true
```

---

## Scoring Implementation

```typescript
function scoreRow(marks: boolean[]): number {
  const count = marks.filter(Boolean).length;
  return (count * (count + 1)) / 2;
}

function totalScore(sheet: Scoresheet, penalties: number, lockedByPlayer: RowColor[]): number {
  let total = 0;
  for (const row of ['red', 'yellow', 'green', 'blue'] as RowColor[]) {
    let marks = sheet[row].filter(Boolean).length;
    if (lockedByPlayer.includes(row)) marks += 1; // lock bonus
    total += (marks * (marks + 1)) / 2;
  }
  total -= penalties * 5;
  return total;
}
```

---

## UI Specification

### Scoresheet Component

The scoresheet is the core UI element. Every player interacts with it on every turn.

```
+--------------------------------------------------+
| RED    [2] [3] [4] [5] [6] [7] [8] [9] [10][11][12] [lock] |
| YELLOW [2] [3] [4] [5] [6] [7] [8] [9] [10][11][12] [lock] |
| GREEN  [12][11][10][9] [8] [7] [6] [5] [4] [3] [2]  [lock] |
| BLUE   [12][11][10][9] [8] [7] [6] [5] [4] [3] [2]  [lock] |
+--------------------------------------------------+
| PENALTIES: [ ] [ ] [ ] [ ]    SCORE: 42          |
+--------------------------------------------------+
```

#### Cell States

| State | Visual | Interaction |
|-------|--------|-------------|
| Empty, not available | Muted/grayed number | Not tappable |
| Empty, available (valid move) | Bright, highlighted | Tappable, shows as option |
| Marked (X) | Filled with X or checkmark in row color | Not tappable |
| Locked | Lock icon, entire row dimmed | Not tappable |

#### Mobile Layout

- Scoresheet fills width of screen
- Cells are minimum 36x36px (comfortable tap target on phone)
- Row labels on the left, color-coded backgrounds
- Penalties and score below the grid
- Scroll not needed - everything visible at once

#### Desktop / Host Screen Layout

- Scoresheet can be larger
- In Jackbox mode: show all players' sheets tiled on the host screen
- Active player's sheet highlighted

### Dice Display

```
+-------+-------+-------+-------+-------+-------+
| W1: 4 | W2: 3 | R: 6  | Y: 2  | G: 5  | B: 1  |
+-------+-------+-------+-------+-------+-------+
  White sum: 7
  Available combos: Red 10, Yellow 6, Green 8, Blue 5
```

- Dice shown with pips (not just numbers) for game feel
- White dice are white/gray
- Colored dice match their row colors
- Removed dice shown as absent/crossed out
- Roll animation: tumble and settle (~500-700ms)

### Turn Flow UI

#### During Phase 1 (All Players)

```
+------------------------------------------+
|  White dice sum: 7                       |
|  Tap a highlighted cell to mark, or:     |
|  [Pass]                                  |
|                                          |
|  Waiting for: Alice, Charlie             |
|  Submitted: You, Bob                     |
+------------------------------------------+
```

- Highlighted cells show where the white sum can be legally placed
- Pass button always available
- Show who has submitted (without revealing their choice)
- Optional timer countdown if enabled

#### During Phase 2 (Active Player Only)

```
+------------------------------------------+
|  Choose a combo:                          |
|  W1(4) + Red(6) = 10 on Red row          |
|  W2(3) + Red(6) = 9 on Red row           |
|  W1(4) + Yellow(2) = 6 on Yellow row     |
|  ...                                     |
|  [Pass]                                  |
+------------------------------------------+
```

- Show available combos as tappable options
- Tapping a combo highlights the target cell on the scoresheet
- Confirm to lock in the choice
- Non-active players see "Waiting for [ActivePlayer]..."

### Game Over Screen

```
+------------------------------------------+
|  GAME OVER                               |
|                                          |
|  1st: Alice - 67 pts                     |
|  2nd: Bob - 54 pts                       |
|  3rd: You - 48 pts                       |
|                                          |
|  [View Scoresheets]  [Play Again]        |
+------------------------------------------+
```

- Final scores with ranking
- Option to view all scoresheets in detail
- "Play Again" resets and starts a new game in the same lobby
- "Back to Lobby" returns to game selection

---

## Configuration Options

Configurable by the host before starting:

| Option | Values | Default |
|--------|--------|---------|
| Dice rolling | Active player rolls / Auto-roll / Central screen | Auto-roll |
| Turn timer | Off / 15s / 30s / 60s | Off |
| Phase 1 timer | Off / 10s / 20s / 30s | Off |
| Spectators allowed | Yes / No | Yes |

---

## Edge Cases

### Disconnection During Phase 1
- If a player disconnects during phase 1, auto-pass for them after reconnection timeout
- If they reconnect in time, they can still make their choice

### No Valid Moves
- If a player has no valid cells for the white sum in phase 1, they can only pass (UI should make this clear)
- If active player has no valid combos in phase 2, they can only pass

### All Rows Locked for a Player
- Player effectively has no moves for the rest of the game
- They still participate in turn order (rolling dice for others)
- They auto-pass both phases (no penalty since they literally cannot mark)

### Simultaneous Row Lock
- If two players both mark the rightmost number of the same row in phase 1, the row is locked after both marks are applied (both get credit)

---

## Testing Plan

### Unit Tests (Vitest)

- `scoreRow()` - verify triangular number scoring for 0-12 marks
- `totalScore()` - verify total with penalties and lock bonuses
- `canMark()` - valid/invalid marking scenarios:
  - Mark to the right of existing marks (valid)
  - Mark to the left of existing marks (invalid)
  - Mark on a locked row (invalid)
  - Mark rightmost with < 5 marks (invalid)
  - Mark rightmost with >= 5 marks (valid)
- `validatePhase1()` - white sum matching, legal placement
- `validatePhase2()` - combo matching, active player only, removed dice
- Game end detection - 2 locked rows, 4 penalties
- Full game simulation - play through a complete game programmatically

### E2E Tests (Playwright)

- Create lobby, 2 players join
- Roll dice, both players make phase 1 choices
- Active player makes phase 2 choice
- Verify scoresheet updates on both clients
- Play until game end, verify final scores
- Reconnection during a turn
- Timer expiry behavior
