# Farkle - Game Specification

## Overview

Farkle is a push-your-luck dice game for 2+ players. Players roll 6 dice, set aside scoring dice, and choose to bank points or roll the remaining dice. If a roll produces no scoring dice, you "farkle" and lose all points accumulated that turn. First to 10,000 points wins.

Great for **both display modes**. Simple phone controller (roll/bank/select dice). Shared scoreboard works well on a big screen.

> **Note**: "Farkle" is a common/generic name with no significant trademark concerns. Some variants are called "10,000", "Zilch", or "Greed".

---

## Rules

### Components

- **6 standard dice** (d6)

### Scoring Dice

| Dice | Points |
|------|--------|
| Single 1 | 100 |
| Single 5 | 50 |
| Three 1s | 1,000 |
| Three 2s | 200 |
| Three 3s | 300 |
| Three 4s | 400 |
| Three 5s | 500 |
| Three 6s | 600 |
| Four of a kind | 2x three-of-a-kind score |
| Five of a kind | 4x three-of-a-kind score |
| Six of a kind | 8x three-of-a-kind score |
| Three pairs | 1,500 |
| Straight (1-2-3-4-5-6) | 1,500 |
| Two triplets | 2,500 |

### Turn Structure

1. **Roll all 6 dice**
2. **Must set aside at least one scoring die/combination**
3. **Choose**: Bank your accumulated points and end turn, OR roll the remaining dice
4. If a roll has **no scoring dice**: **Farkle!** Lose all points from this turn. Turn ends.
5. If you set aside **all 6 dice** as scoring: you may roll all 6 again ("hot dice") and continue accumulating

### Opening Score

- A player must score at least **500 points in a single turn** to "get on the board"
- Until they reach 500 in one turn, they cannot bank
- Once on the board, they can bank any amount

### Turn End

- **Bank**: Add accumulated points to your total score
- **Farkle**: Lose all points from this turn (total score unchanged)

### Game End

- When a player reaches **10,000 points**, every other player gets **one final turn**
- Highest score wins (the player who triggered the end can be overtaken)

---

## Game State Model

```typescript
interface FarkleGameState {
  roomId: string;
  players: FarklePlayer[];
  activePlayerIndex: number;
  dice: number[];                    // current dice values (1-6)
  diceCount: number;                 // how many dice being rolled (1-6)
  setAside: ScoringGroup[];          // dice set aside this turn
  turnPoints: number;                // accumulated points this turn
  phase: FarklePhase;
  round: number;
  finalRound: boolean;               // triggered when someone hits 10K
  triggerPlayerId: string | null;    // who triggered the final round
  gameOver: boolean;
  winner: string | null;
}

interface FarklePlayer {
  id: string;
  name: string;
  connected: boolean;
  totalScore: number;
  onTheBoard: boolean;              // has scored 500+ in a single turn
  hadFinalTurn: boolean;            // in final round, has this player gone?
}

interface ScoringGroup {
  dice: number[];                    // the dice values
  points: number;
  description: string;              // "Three 4s", "Single 1", etc.
}

type FarklePhase =
  | 'rolling'           // about to roll
  | 'selecting'         // choosing which dice to set aside
  | 'farkled'           // rolled no scoring dice
  | 'turn-over'         // showing banked points
  | 'game-over';
```

### Player View

```typescript
interface FarklePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    totalScore: number;
    onTheBoard: boolean;
  }[];

  activePlayerIndex: number;
  isMyTurn: boolean;
  dice: number[];
  diceCount: number;
  setAside: ScoringGroup[];
  turnPoints: number;
  phase: FarklePhase;

  // For selecting phase
  scoringOptions: ScoringOption[];   // valid ways to set aside dice

  round: number;
  finalRound: boolean;
  gameOver: boolean;
  winner: string | null;
}

interface ScoringOption {
  diceIndices: number[];
  points: number;
  description: string;
}
```

### Actions

```typescript
type FarkleAction =
  | { type: 'roll' }
  | { type: 'set-aside'; diceIndices: number[] }
  | { type: 'bank' }
  ;
```

---

## Scoring Detection

```typescript
function findScoringOptions(dice: number[]): ScoringOption[] {
  const options: ScoringOption[] = [];
  const counts = new Array(7).fill(0);
  dice.forEach((d, i) => counts[d]++);

  // Check for straight (1-2-3-4-5-6)
  if (dice.length === 6 && counts.slice(1).every(c => c === 1)) {
    options.push({ diceIndices: [0,1,2,3,4,5], points: 1500, description: 'Straight' });
  }

  // Check for three pairs
  if (dice.length === 6) {
    const pairs = counts.filter(c => c === 2).length;
    if (pairs === 3) {
      options.push({ diceIndices: [0,1,2,3,4,5], points: 1500, description: 'Three Pairs' });
    }
  }

  // Check for two triplets
  if (dice.length === 6) {
    const trips = counts.filter(c => c === 3).length;
    if (trips === 2) {
      options.push({ diceIndices: [0,1,2,3,4,5], points: 2500, description: 'Two Triplets' });
    }
  }

  // Three/four/five/six of a kind
  for (let val = 1; val <= 6; val++) {
    if (counts[val] >= 3) {
      const base = val === 1 ? 1000 : val * 100;
      const indices = dice.map((d, i) => d === val ? i : -1).filter(i => i >= 0);

      if (counts[val] >= 6) options.push({ diceIndices: indices.slice(0, 6), points: base * 8, description: `Six ${val}s` });
      if (counts[val] >= 5) options.push({ diceIndices: indices.slice(0, 5), points: base * 4, description: `Five ${val}s` });
      if (counts[val] >= 4) options.push({ diceIndices: indices.slice(0, 4), points: base * 2, description: `Four ${val}s` });
      options.push({ diceIndices: indices.slice(0, 3), points: base, description: `Three ${val}s` });
    }
  }

  // Single 1s (not already counted in three-of-a-kind)
  const free1s = Math.min(counts[1], counts[1] >= 3 ? counts[1] - 3 : counts[1]);
  for (let i = 0; i < free1s; i++) {
    // find indices of 1s not in a triplet
    options.push({ diceIndices: [/* specific index */], points: 100, description: 'Single 1' });
  }

  // Single 5s
  const free5s = Math.min(counts[5], counts[5] >= 3 ? counts[5] - 3 : counts[5]);
  for (let i = 0; i < free5s; i++) {
    options.push({ diceIndices: [/* specific index */], points: 50, description: 'Single 5' });
  }

  return options;
}

function hasScoringDice(dice: number[]): boolean {
  return findScoringOptions(dice).length > 0;
}
```

Note: The actual implementation needs more careful index tracking. This is a sketch.

---

## UI Specification

### Phone (Active Player)

```
+------------------------------------+
| YOUR TURN        Turn pts: 450     |
+------------------------------------+
| Dice:                              |
| [4] [1] [3] [1] [6]              |
|      *        *                    |
| Tap scoring dice to set aside      |
+------------------------------------+
| Set aside this turn:               |
| Three 4s = 400                     |
| Single 5 = 50                      |
+------------------------------------+
| [BANK 450]    [ROLL 5 DICE]       |
|               (or set aside more)  |
+------------------------------------+
```

- Scoring dice highlighted/pulsing
- Non-scoring dice dimmed
- Set-aside area shows accumulated groups
- Bank button shows total that would be banked
- Roll button shows how many dice remain

### Farkle Animation

```
+------------------------------------+
|                                    |
|        FARKLE!                     |
|        Lost 650 points             |
|                                    |
|  [2] [3] [4] [6] [4]             |
|  No scoring dice!                  |
|                                    |
+------------------------------------+
```

### Scoreboard

```
+------------------------------------+
| SCOREBOARD          Target: 10,000 |
|                                    |
| Alice      7,250  ████████░░       |
| Bob        5,100  █████░░░░░       |
| You        4,800  ████░░░░░░       |
| Charlie    3,350  ███░░░░░░░       |
+------------------------------------+
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Target score | 5,000 / 10,000 / 20,000 | 10,000 |
| Opening score | 300 / 500 / 1,000 / Off | 500 |
| Turn timer | Off / 30s / 60s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators | Yes / No | Yes |

---

## Hidden Information

**None** - all dice and scores are public. Good candidate for **client-side consensus**.

---

## Edge Cases

- **Hot dice**: All 6 dice scored → roll all 6 again, keep accumulating
- **Must set aside**: At least one scoring die must be set aside per roll
- **Opening score**: Can't bank until you have 500+ in one turn
- **Farkle on opening attempt**: Lose nothing (already at 0)
- **Final round**: Everyone else gets one turn; they can surpass the leader
- **Tie at game end**: Can be shared victory or tiebreaker (extra round)
- **Single die remaining**: Must roll it; if it's not a 1 or 5, farkle

---

## Testing Plan

### Unit Tests
- `findScoringOptions()` for all combinations
- `hasScoringDice()` for farkle detection
- Straight, three pairs, two triplets detection
- Four/five/six of a kind scoring multipliers
- Hot dice (all 6 set aside)
- Opening score gate (500+ required)
- Final round logic
- Full game simulation

### E2E Tests
- Roll, select, bank flow
- Farkle scenario
- Hot dice scenario
- Opening score requirement
- Final round trigger and completion
