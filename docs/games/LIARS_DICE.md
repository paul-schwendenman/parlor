# Liar's Dice - Game Specification

## Overview

Liar's Dice is a bluffing dice game for 2-6 players. Each player rolls dice hidden under a cup. Players take turns bidding on the total number of a specific face value across ALL players' dice. You can raise the bid or call the previous player a liar. Wrong calls cost you dice. Last player with dice wins.

Good in **both modes**. Jackbox: bid history on big screen, dice hidden on phones. Peer: everything on phone.

> **Note**: Liar's Dice is a traditional game with no significant trademark concerns. Also known as Perudo, Dudo, or Bluff.

---

## Rules

### Setup

- Each player starts with **5 dice**
- All players roll simultaneously, keeping their dice **hidden** from others
- Only you can see your own dice

### Bidding

Starting with a designated player, bidding goes clockwise:

A bid consists of a **quantity** and a **face value** (e.g., "three 4s" = I claim there are at least three dice showing 4 among ALL players' dice combined).

Each subsequent bid must be **higher** than the previous:
- **Raise quantity**: Same face, higher quantity (e.g., "three 4s" → "four 4s")
- **Raise face**: Same quantity, higher face (e.g., "three 4s" → "three 5s")
- **Raise both**: Higher quantity and/or face

### Ones Are Wild (Standard Rule)

**1s (aces) count as any face value**. So if someone bids "four 3s", every die showing 1 OR 3 counts.

When bidding on 1s specifically:
- The quantity required is **halved** (rounded up) compared to the current bid
- Example: Current bid is "six 3s" → bidding on 1s only requires "three 1s"
- Going back from 1s to another number requires **doubling + 1**
- Example: Current bid is "three 1s" → bidding on any other face requires "seven Xs"

### Calling Liar / Challenge

Instead of raising the bid, you can **challenge** the previous bidder by calling "Liar!":

1. All players reveal their dice
2. Count all dice matching the bid's face value (plus 1s if wild)
3. **If the bid is correct** (actual count >= bid quantity): The **challenger** loses 1 die
4. **If the bid is wrong** (actual count < bid quantity): The **bidder** loses 1 die

### Spot On (Optional Rule)

Instead of bidding or challenging, you can call **"Spot On"**:
- If the actual count **exactly equals** the current bid: Everyone else loses 1 die
- If not exact: You lose 1 die

### Losing Dice and Elimination

- When you lose a die, set it aside permanently
- When you reach **0 dice**, you're eliminated
- After a challenge, all players re-roll their remaining dice
- The loser of the challenge starts the next round of bidding

### Game End

Last player with dice remaining wins.

---

## Game State Model

```typescript
interface LiarsDiceGameState {
  roomId: string;
  players: LiarsDicePlayer[];
  activePlayerIndex: number;
  phase: LiarsDicePhase;
  currentBid: Bid | null;
  previousBidderId: string | null;
  totalDiceInPlay: number;
  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface LiarsDicePlayer {
  id: string;
  name: string;
  connected: boolean;
  dice: number[];                // current dice values (hidden from others)
  diceCount: number;             // how many dice remaining
  eliminated: boolean;
}

interface Bid {
  playerId: string;
  quantity: number;
  faceValue: number;             // 1-6
}

type LiarsDicePhase =
  | 'rolling'           // all players rolling their dice
  | 'bidding'           // active player must bid, challenge, or spot-on
  | 'challenge'         // a challenge was called, revealing dice
  | 'spot-on'           // spot-on was called, revealing dice
  | 'round-result'      // showing who lost a die
  | 'game-over';
```

### Player View

```typescript
interface LiarsDicePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    diceCount: number;           // how many dice they have (visible)
    eliminated: boolean;
    dice: number[] | null;       // only visible during reveal, otherwise null
  }[];

  // Private
  myDice: number[];              // my current dice values
  myIndex: number;

  // Game state
  activePlayerIndex: number;
  phase: LiarsDicePhase;
  currentBid: Bid | null;
  totalDiceInPlay: number;

  // Valid actions
  minimumBid: Bid | null;        // lowest valid next bid
  canChallenge: boolean;
  canSpotOn: boolean;

  // Challenge/reveal results
  revealedDice: Record<string, number[]> | null;  // all dice during reveal
  actualCount: number | null;
  challengeResult: ChallengeResult | null;

  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface ChallengeResult {
  challengerId: string;
  bidderId: string;
  bidWasCorrect: boolean;
  loserId: string;
  actualCount: number;
}
```

### Actions

```typescript
type LiarsDiceAction =
  | { type: 'bid'; quantity: number; faceValue: number }
  | { type: 'challenge' }
  | { type: 'spot-on' }
  ;
```

---

## Turn Flow

```
1. Phase: 'rolling'
   - All remaining players roll their dice
   - Each player sees only their own dice
   - Other players' dice counts are visible

2. Phase: 'bidding'
   - First player makes an opening bid
   - Clockwise, each player must:
     a. Raise the bid, OR
     b. Challenge ("Liar!"), OR
     c. Call "Spot On" (if enabled)

3. If challenge:
   Phase: 'challenge'
   - All dice revealed
   - Count dice matching bid face (+ 1s if wild)
   - Determine if bid was correct
   - Loser loses 1 die

4. If spot-on:
   Phase: 'spot-on'
   - All dice revealed
   - Count must exactly equal bid quantity
   - If exact: everyone else loses 1 die
   - If not: caller loses 1 die

5. Phase: 'round-result'
   - Show who lost a die
   - Check for eliminations
   - Check for winner (1 player remaining)

6. If game continues:
   - Loser starts next round
   - Go to step 1
```

---

## Bid Validation

```typescript
function isValidBid(
  newBid: Bid,
  currentBid: Bid | null,
  wildOnes: boolean
): boolean {
  if (!currentBid) return newBid.quantity >= 1 && newBid.faceValue >= 1 && newBid.faceValue <= 6;

  if (wildOnes) {
    // Bidding on 1s: quantity is halved (round up)
    if (newBid.faceValue === 1 && currentBid.faceValue !== 1) {
      return newBid.quantity >= Math.ceil(currentBid.quantity / 2);
    }
    // From 1s to another number: quantity doubled + 1
    if (newBid.faceValue !== 1 && currentBid.faceValue === 1) {
      return newBid.quantity >= currentBid.quantity * 2 + 1;
    }
  }

  // Standard: higher quantity, or same quantity with higher face
  if (newBid.quantity > currentBid.quantity) return true;
  if (newBid.quantity === currentBid.quantity && newBid.faceValue > currentBid.faceValue) return true;
  return false;
}

function countMatchingDice(
  allDice: number[][],
  faceValue: number,
  wildOnes: boolean
): number {
  let count = 0;
  for (const playerDice of allDice) {
    for (const die of playerDice) {
      if (die === faceValue) count++;
      else if (wildOnes && die === 1 && faceValue !== 1) count++;
    }
  }
  return count;
}
```

---

## UI Specification

### Phone - Your Dice + Bidding

```
+----------------------------+
| Your dice:                 |
| [3] [5] [3] [1] [6]      |
|                            |
| Total dice in play: 18    |
| Current bid: "Four 3s"    |
| (by Alice)                 |
+----------------------------+
| Make a bid:                |
| Quantity: [5] [6] [7]...  |
| Face:  [1][2][3][4][5][6] |
| [BID]                      |
|                            |
| [LIAR!]    [SPOT ON]      |
+----------------------------+
| Players:                   |
| Alice: 5 dice              |
| Bob: 4 dice                |
| You: 5 dice                |
| Charlie: 3 dice            |
+----------------------------+
```

### Reveal Animation

```
+----------------------------+
| LIAR! called by You        |
|                            |
| Bid: "Four 3s"             |
|                            |
| Alice: [3][1][5][2][4]    |
| Bob:   [3][3][6][1]       |
| You:   [3][5][3][1][6]    |
| Charlie: [2][4][1]        |
|                            |
| 3s + wild 1s = 8 total    |
| Bid was CORRECT!           |
| You lose a die.            |
+----------------------------+
```

### Jackbox Host Screen

- Player order shown as a circle
- Current bid prominently displayed in center
- Bid history scrolling on the side
- Dramatic reveal: dice cups "lift" to show all dice
- Highlight matching dice (bid face + wild 1s)

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Starting dice | 3 / 4 / 5 / 6 | 5 |
| Wild ones | On / Off | On |
| Spot on rule | On / Off | On |
| Turn timer | Off / 15s / 30s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators | Yes / No | Yes |

---

## Hidden Information

- Each player's dice are hidden until a challenge
- Dice counts are public
- Bid history is public

Server-authoritative required (hidden dice).

---

## Edge Cases

- **1 die remaining**: You still roll and bid. Challenges are all-or-nothing.
- **Last two players**: Bidding gets intense. Wild 1s can swing things.
- **Spot On with 0 matching**: Not exact (0 != bid quantity unless bid was 0, which isn't valid). Caller loses.
- **Wild 1s when bidding on 1s**: 1s are NOT wild when the bid face IS 1. Only actual 1s count.
- **Player disconnects**: Auto-challenge after timeout (rather than let the game stall).
- **Opening bid**: First bid of a round has no minimum (any quantity >= 1, any face).

---

## Testing Plan

### Unit Tests
- `isValidBid()` - raising rules, wild ones transitions (1s ↔ other)
- `countMatchingDice()` - with and without wild ones
- Challenge resolution (correct/incorrect bid)
- Spot on resolution (exact/not exact)
- Die loss and elimination
- Round reset (re-roll, new starting player)
- Full game simulation to single winner

### E2E Tests
- 4-player game, rolling and bidding
- Escalating bids around the table
- Challenge: reveal all dice, correct result
- Spot on attempt
- Player elimination
- Game to single winner
