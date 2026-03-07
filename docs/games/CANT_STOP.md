# Can't Stop - Game Specification

## Overview

Can't Stop is a push-your-luck dice game for 2-4 players. Players roll four dice, pair them into two sums, and advance markers up columns numbered 2-12 on a shared board. You can keep rolling to push further, but if you can't place any dice, you bust and lose all progress for that turn. First player to claim 3 columns wins.

Can't Stop is the ideal first **Jackbox-mode** game for Parlor. The board is central and shared, and the phone controller is minimal - just a few buttons per turn. The board would be hard to display well on a phone screen, making the shared host screen the natural home for it.

> **Note**: Can't Stop's original patent (Sid Sackson, 1980) has long expired. The name may be trademarked. For Parlor, use an original name. See `docs/LEGAL.md`.

---

## Rules (Standard Published)

### Components

- **4 dice** (standard d6)
- **Board** with 11 columns numbered 2-12
- Column heights (number of spaces to reach the top):

| Column | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|--------|---|---|---|---|---|---|---|---|----|----|-----|
| Spaces | 3 | 5 | 7 | 9 | 11 | 13 | 11 | 9 | 7 | 5 | 3 |

- **3 neutral markers** (white) - shared, placed during the active player's turn
- **Player markers** (colored) - one per player per column, tracking permanent progress

### Turn Structure

On your turn, you repeatedly roll and place until you stop or bust:

#### 1. Roll All 4 Dice

Roll four d6. You must group them into **two pairs**, each pair summing to a column number (2-12).

There are **three possible pairings** of four dice (A,B,C,D):
- (A+B) and (C+D)
- (A+C) and (B+D)
- (A+D) and (B+C)

#### 2. Choose a Pairing and Place Markers

You must choose one of the three pairings. For each sum in your chosen pairing, advance a neutral marker one space up that column. Rules:

- You can only have neutral markers in **at most 3 different columns** at a time
- If a column is already **claimed** (someone reached the top), you cannot place in it
- If placing a sum would require a 4th column and you have no neutral marker there already, that sum is unavailable
- You must be able to place **at least one** of the two sums from your chosen pairing

If a neutral marker is already in a column (from a previous roll this turn), it advances further. If not, a new neutral marker is placed at your current permanent position + 1 in that column (or at the bottom if you have no permanent progress).

#### 3. Stop or Continue

After placing, choose:
- **Stop**: All neutral markers become permanent progress. Your colored markers move to the neutral marker positions. Your turn ends.
- **Continue**: Roll again. Risk busting.

#### 4. Bust

If you roll and **no valid pairing** can be placed (all possible sums are in claimed columns, or would require a 4th active column), you **bust**:
- All neutral markers are removed
- You gain **no permanent progress** this turn
- Your turn ends

### Claiming a Column

When a neutral marker reaches the **top** of a column:
- That column is **claimed** by you when you stop
- No other player can advance in that column anymore
- Their existing progress in that column is removed
- The claimed column counts toward your 3-column goal

Note: You don't claim during the roll - only when you stop. If you bust, you don't claim even if a neutral marker reached the top.

### Game End

First player to **claim 3 columns** wins.

---

## Game State Model

### Server State

```typescript
interface CantStopGameState {
  roomId: string;
  players: CantStopPlayer[];
  activePlayerIndex: number;
  phase: CantStopPhase;
  dice: [number, number, number, number] | null;
  neutralMarkers: Map<ColumnNumber, number>;  // column -> current position (0-indexed from bottom)
  activeColumns: ColumnNumber[];               // which columns have neutral markers (max 3)
  claimedColumns: Map<ColumnNumber, string>;   // column -> player ID who claimed it
  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface CantStopPlayer {
  id: string;
  name: string;
  connected: boolean;
  progress: Map<ColumnNumber, number>;  // column -> permanent position (0-indexed)
  claimedCount: number;                 // how many columns this player has claimed
}

type ColumnNumber = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type CantStopPhase =
  | 'rolling'          // active player about to roll (or deciding to stop)
  | 'choosing-pair'    // active player selecting which dice pairing to use
  | 'busted'           // player busted, showing result before next turn
  | 'stopped'          // player stopped, committing progress
  | 'game-over';

// Column heights (spaces to reach top)
const COLUMN_HEIGHTS: Record<ColumnNumber, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11,
  7: 13,
  8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};
```

### Dice Pairing

```typescript
interface DicePairing {
  pair1: { dice: [number, number]; sum: ColumnNumber };
  pair2: { dice: [number, number]; sum: ColumnNumber };
  valid: boolean;         // can at least one sum be placed?
  pair1Valid: boolean;     // can this specific sum be placed?
  pair2Valid: boolean;     // can this specific sum be placed?
}

// Given dice [a, b, c, d], there are always exactly 3 possible pairings
function getPairings(dice: [number, number, number, number]): DicePairing[] {
  const [a, b, c, d] = dice;
  return [
    { pair1: { dice: [a, b], sum: a + b }, pair2: { dice: [c, d], sum: c + d } },
    { pair1: { dice: [a, c], sum: a + c }, pair2: { dice: [b, d], sum: b + d } },
    { pair1: { dice: [a, d], sum: a + d }, pair2: { dice: [b, c], sum: b + c } },
  ].map(p => ({
    ...p,
    pair1Valid: canPlace(p.pair1.sum),
    pair2Valid: canPlace(p.pair2.sum),
    valid: canPlace(p.pair1.sum) || canPlace(p.pair2.sum),
  }));
}
```

### Player View

```typescript
interface CantStopPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    progress: Record<ColumnNumber, number>;  // permanent positions
    claimedCount: number;
    claimedColumns: ColumnNumber[];
  }[];

  // Board state
  neutralMarkers: Record<ColumnNumber, number>;  // current turn's temporary progress
  activeColumns: ColumnNumber[];
  claimedColumns: Record<ColumnNumber, string>;  // column -> player ID

  // Turn state
  activePlayerIndex: number;
  isMyTurn: boolean;
  phase: CantStopPhase;
  dice: [number, number, number, number] | null;
  pairings: DicePairing[] | null;  // available pairings for current roll

  round: number;
  gameOver: boolean;
  winner: string | null;
}
```

### Actions (Client to Server)

```typescript
type CantStopAction =
  | { type: 'roll' }
  | { type: 'choose-pairing'; pairingIndex: number }  // 0, 1, or 2
  | { type: 'stop' }
  ;
```

---

## Turn Flow (Detailed)

```
1. Phase: 'rolling'
   - Active player sees [Roll Dice] and [Stop] buttons
   - [Stop] is disabled on the first roll of the turn (must roll at least once)
   - Player sends { type: 'roll' } or { type: 'stop' }

2. If stopped:
   Phase: 'stopped'
   - Neutral markers become permanent progress
   - Check if any columns are now claimed (marker reached top)
   - Check for game win (3 columns claimed)
   - Brief display, then advance to next player

3. If rolled:
   - Server rolls 4 dice
   - Server computes all 3 possible pairings and their validity
   - If NO pairing is valid -> BUST
   - If at least one pairing is valid -> Phase: 'choosing-pair'

4. Phase: 'choosing-pair'
   - Active player sees the 3 pairings with valid/invalid indicators
   - Player chooses one valid pairing
   - For each valid sum in the chosen pairing:
     - If neutral marker already in that column: advance it 1 space
     - If no neutral marker and < 3 active columns: place new neutral marker
     - If neutral marker reaches column top: stays there (claimed on stop)
   - Invalid sums in the chosen pairing are simply skipped

5. Return to step 1 (roll or stop)

BUST:
   Phase: 'busted'
   - All neutral markers removed
   - No progress saved
   - Brief animation/display showing the bust
   - Advance to next player
```

---

## Placement Validation

```typescript
function canPlace(
  sum: ColumnNumber,
  neutralMarkers: Map<ColumnNumber, number>,
  activeColumns: ColumnNumber[],
  claimedColumns: Map<ColumnNumber, string>,
): boolean {
  // Can't place in a claimed column
  if (claimedColumns.has(sum)) return false;

  // If neutral marker already in this column, can always advance
  if (neutralMarkers.has(sum)) return true;

  // If we already have 3 active columns and this isn't one of them, can't place
  if (activeColumns.length >= 3) return false;

  return true;
}

function isBust(
  dice: [number, number, number, number],
  neutralMarkers: Map<ColumnNumber, number>,
  activeColumns: ColumnNumber[],
  claimedColumns: Map<ColumnNumber, string>,
): boolean {
  const pairings = getPairings(dice);
  return pairings.every(p => !p.pair1Valid && !p.pair2Valid);
}
```

---

## UI Specification

### Jackbox Mode (Primary - Recommended)

This is the primary display mode for Can't Stop. The board is the star.

#### Host Screen - The Board

```
            COLUMN NUMBERS
     2   3   4   5   6   7   6   5   4   3   2
     |   |   |   |   |   |   |   |   |   |   |
    [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ]  <- top
         [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ] [ ]
              [ ] [ ] [ ] [ ] [ ] [ ] [ ]
                   [ ] [ ] [ ] [ ] [ ]
                        [ ] [ ] [ ]
                        [ ] [ ]
                        [ ]                       <- bottom (column 7 only)
     2   3   4   5   6   7   8   9  10  11  12

  ALICE: ★★☆  |  BOB: ★☆☆  |  CHARLIE: ☆☆☆
  (★ = claimed columns)
```

The board is a mountain/diamond shape:
- Column 7 is tallest (13 spaces)
- Columns 2 and 12 are shortest (3 spaces)
- Each space can show player colored markers stacked and neutral markers

#### Host Screen - Board Cell Contents

Each cell shows:
- Player colored markers (dots/icons in player colors) for permanent progress
- Neutral marker (white/highlighted) for current turn's temporary progress
- Claimed column: entire column highlighted in the claiming player's color with a flag/crown at top
- Empty: subtle grid lines

#### Host Screen - Dice & Status Area

```
+---------------------------------------------+
|  ALICE'S TURN (Round 5)                     |
|                                              |
|  Dice: [3] [4] [2] [5]                     |
|                                              |
|  Pairings:                                   |
|  Option A: (3+4)=7 and (2+5)=7  -> 7, 7    |
|  Option B: (3+2)=5 and (4+5)=9  -> 5, 9    |
|  Option C: (3+5)=8 and (4+2)=6  -> 8, 6    |
|                                              |
|  Active columns: [5] [7] [9]                |
|  Alice is choosing...                        |
+---------------------------------------------+
```

- Dice shown large with pip faces
- Pairings shown clearly, invalid options grayed out
- Active column indicators
- Bust/stop animations on the host screen

#### Host Screen - Animations

| Event | Animation |
|-------|-----------|
| Dice roll | 4 dice tumble and settle (~700ms) |
| Marker advance | Smooth slide up the column (~300ms) |
| Bust | Neutral markers flash red, fall/fade out (~600ms) |
| Stop/commit | Neutral markers pulse, transform to player color (~400ms) |
| Column claimed | Column fills with player color, flag plants at top (~800ms) |
| Game win | Celebration animation on the 3 claimed columns |

#### Phone Controller (Player's Device)

The phone shows minimal UI - just the decisions the active player needs to make.

**When it's your turn - Roll or Stop:**
```
+----------------------------+
|  Your Turn                 |
|                            |
|  Active columns: 5, 7, 9  |
|                            |
|  [  ROLL DICE  ]          |
|  [    STOP     ]          |
|                            |
|  Progress this turn:       |
|  Col 5: +2 spaces         |
|  Col 7: +3 spaces         |
|  Col 9: +1 space          |
+----------------------------+
```

**When it's your turn - Choose pairing:**
```
+----------------------------+
|  Dice: 3, 4, 2, 5         |
|                            |
|  Pick a pairing:           |
|                            |
|  [A] 7 and 7              |
|      (advance col 7 x2)   |
|                            |
|  [B] 5 and 9              |
|      (advance col 5 & 9)  |
|                            |
|  [C] 8 and 6              |
|      (new col 8! col 6    |
|       blocked - claimed)  |
|                            |
+----------------------------+
```

**When it's NOT your turn:**
```
+----------------------------+
|  Alice is rolling...       |
|                            |
|  Watch the board!          |
|                            |
|  Your progress:            |
|  Col 5: 4/9               |
|  Col 7: 6/13              |
|  Col 10: 3/7              |
|  Claimed: Col 3           |
+----------------------------+
```

### Peer Mode (Fallback)

If no shared screen is available, the board needs to fit on a phone. This is challenging but doable:

- Horizontal scrollable board, or rotated 90 degrees (columns become rows)
- Pinch-to-zoom on the board
- Only show relevant columns (ones with player progress + active neutral markers)
- Simplified representation: progress bars instead of individual spaces

```
+----------------------------+
|  Col 2  ██████████░░░ 2/3  |
|  Col 5  ████░░░░░░░░ 3/9  |
|  Col 7  █████████░░░ 8/13 |
|  Col 9  ██░░░░░░░░░░ 2/9  |
|  Col 11 ████████░░░░ 3/5  |
+----------------------------+
```

This is a simpler but less satisfying experience. The board visualization is where Can't Stop shines, and a TV/monitor does it justice.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Display mode | Jackbox / Peer | Jackbox |
| Turn timer | Off / 30s / 60s | Off |
| Spectators allowed | Yes / No | Yes |
| Columns to win | 3 (standard) / 2 / 4 | 3 |

---

## Hidden Information

Can't Stop has **no hidden information**. The entire game state is public:
- All player progress is visible on the board
- Dice rolls are public
- Neutral marker positions are public

This makes Can't Stop an excellent candidate for the **client-side consensus** architecture. No secrets need to be protected, and the game state is simple enough for clients to validate independently.

---

## Edge Cases

### Double Sums

If a roll produces two identical sums (e.g. dice 3,4,2,5 → pairing (3+4)=7, (2+5)=7):
- The neutral marker advances **twice** in that column
- This only uses 1 active column slot (not 2)

### All Three Columns at Top

If all 3 neutral markers have reached the top of their columns:
- Player should stop (they'll claim 3 columns and win)
- Rolling again risks busting and losing all three claims
- The UI should clearly indicate this situation

### Bust on First Roll

- Player rolls, no valid pairing exists
- Turn ends immediately with no progress
- This is uncommon but possible (e.g., all possible sums are in claimed columns)

### Column Claimed Mid-Turn

This doesn't happen - columns are only claimed when a player stops. A neutral marker can reach the top of a column, but the claim only happens on stop.

### Player Disconnection

- If active player disconnects: auto-stop after timeout (preserves whatever progress they have)
- If non-active player disconnects: no impact on gameplay (game is fully public)
- Reconnecting player gets full board state

### Pairing Where Only One Sum Is Valid

- Player must choose a pairing where at least one sum is valid
- The invalid sum in the pairing is simply ignored (not placed)
- Example: pairing gives sums 7 and 12, but column 12 is claimed. Player can still choose this pairing and only advance column 7.

---

## Why Can't Stop is a Good First Jackbox Game

1. **Minimal phone UI** - Active player needs 2-3 buttons. Non-active players just watch.
2. **No hidden information** - Simplest state model, no per-player views.
3. **Shared board is the experience** - The game IS the board. A big screen makes it shine.
4. **Simple game logic** - Dice rolling, sum pairing, position tracking. No complex card interactions.
5. **Natural spectator experience** - Anyone watching the screen understands what's happening.
6. **Push-your-luck tension** - Creates natural excitement that works well on a shared screen.
7. **Tests the Jackbox infrastructure** - Host screen rendering, phone controller communication, turn management.

Building Can't Stop first would validate the Jackbox display mode architecture before tackling more complex games.

---

## Re-theming Notes

Can't Stop has been re-themed many times (Can't Stop Express, etc.). The mountain-climbing theme is common but not required.

| Original | Direction |
|----------|-----------|
| Can't Stop | Mountain climbing, tower building, rocket launch, deep sea diving - anything with vertical progress |
| Column markers | Climbers, rockets, divers, etc. |
| Busting | Falling, crashing, getting lost |

The mathematical structure (column heights based on dice probability distribution) is the game's core and is not protectable.

---

## Testing Plan

### Unit Tests (Vitest)

- `getPairings()` - verify all 3 pairings for various dice combinations
- `canPlace()` - valid/invalid placement scenarios:
  - Place in unclaimed column with available neutral marker slot (valid)
  - Place in claimed column (invalid)
  - Place in 4th column when 3 active (invalid)
  - Advance existing neutral marker (valid even with 3 active)
- `isBust()` - bust detection for various dice + board states
- Double sum handling (same column advanced twice)
- Stop: neutral markers become permanent progress
- Bust: neutral markers removed, no progress saved
- Column claiming: marker reaches top + stop
- Game end: 3 columns claimed
- Probability verification: column 7 should be reachable most often
- Full game simulation

### E2E Tests (Playwright)

- Host screen + phone controller setup
- Create lobby, 2 players join
- Roll dice, choose pairing, see board update on host screen
- Push luck: roll multiple times, then stop
- Bust scenario: verify progress reset
- Claim a column, verify it's locked for other players
- Play to game win
- Reconnection during active turn
- Phone controller shows correct state for active vs. non-active player
