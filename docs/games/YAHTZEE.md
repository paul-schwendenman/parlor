# Yahtzee - Game Specification

## Overview

Yahtzee is a dice game for 1+ players. Players roll 5 dice up to 3 times per turn, keeping desired dice between rolls, then score in one of 13 categories. After 13 rounds (all categories filled), highest total wins.

Works in **peer mode** (each player has their own scorecard on their device) or **Jackbox mode** (shared scoreboard on screen, rolling on phones).

> **Note**: "Yahtzee" is trademarked by Hasbro. Parlor needs an original name. The dice mechanics are public domain. See `docs/LEGAL.md`.

---

## Rules

### Components

- **5 standard dice** (d6)
- **Scorecard** with 13 categories

### Turn Structure

1. **Roll all 5 dice**
2. **Keep** any dice you want, **re-roll** the rest
3. Repeat once more (up to **3 total rolls**)
4. **Score** in one open category on your scorecard
5. Each category can only be used **once** per game

### Scorecard Categories

#### Upper Section

| Category | Score |
|----------|-------|
| **Ones** | Sum of all 1s |
| **Twos** | Sum of all 2s |
| **Threes** | Sum of all 3s |
| **Fours** | Sum of all 4s |
| **Fives** | Sum of all 5s |
| **Sixes** | Sum of all 6s |

**Upper bonus**: If upper section total >= 63, add **35 bonus points**.
(63 = three of each number: 3+6+9+12+15+18)

#### Lower Section

| Category | Requirement | Score |
|----------|-------------|-------|
| **Three of a Kind** | 3+ dice of same value | Sum of all dice |
| **Four of a Kind** | 4+ dice of same value | Sum of all dice |
| **Full House** | 3 of one + 2 of another | 25 |
| **Small Straight** | 4 sequential dice (e.g. 1-2-3-4) | 30 |
| **Large Straight** | 5 sequential dice (e.g. 1-2-3-4-5) | 40 |
| **Yahtzee** | All 5 dice the same | 50 |
| **Chance** | Any combination | Sum of all dice |

### Yahtzee Bonus

If you roll additional Yahtzees after already scoring 50 in the Yahtzee category:
- **+100 bonus** for each additional Yahtzee
- You must still score in a category:
  - If the corresponding upper section category is open, you MUST use it
  - Otherwise, score in any open lower section category (with full points, as a "joker")
  - If no lower section open, score 0 in any open upper section category

If you scored 0 in the Yahtzee category (used it as a scratch), no Yahtzee bonus applies.

---

## Game State Model

```typescript
interface YahtzeeGameState {
  roomId: string;
  players: YahtzeePlayer[];
  activePlayerIndex: number;
  dice: number[];                // 5 dice values (1-6)
  keptDice: boolean[];           // which are kept
  rollsRemaining: number;        // 0-2 after first roll
  phase: YahtzeePhase;
  round: number;                 // 1-13
  gameOver: boolean;
  winner: string | null;
}

interface YahtzeePlayer {
  id: string;
  name: string;
  connected: boolean;
  scorecard: Scorecard;
  yahtzeeBonus: number;         // number of extra yahtzees (x100 pts)
}

interface Scorecard {
  ones: number | null;
  twos: number | null;
  threes: number | null;
  fours: number | null;
  fives: number | null;
  sixes: number | null;
  threeOfAKind: number | null;
  fourOfAKind: number | null;
  fullHouse: number | null;
  smallStraight: number | null;
  largeStraight: number | null;
  yahtzee: number | null;
  chance: number | null;
}

type YahtzeePhase =
  | 'rolling'          // player rolling dice
  | 'scoring'          // player choosing a category
  | 'round-over'       // brief display
  | 'game-over';
```

### Player View

```typescript
interface YahtzeePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    scorecard: Scorecard;          // all scorecards are public
    upperTotal: number;
    upperBonus: boolean;
    yahtzeeBonus: number;
    grandTotal: number;
  }[];

  // Private (during your turn)
  dice: number[];
  keptDice: boolean[];
  rollsRemaining: number;
  availableCategories: CategoryOption[];  // what you can score and how much

  activePlayerIndex: number;
  isMyTurn: boolean;
  phase: YahtzeePhase;
  round: number;

  gameOver: boolean;
  winner: string | null;
}

interface CategoryOption {
  category: keyof Scorecard;
  score: number;                   // what you'd get
  available: boolean;              // not yet used
}
```

### Actions

```typescript
type YahtzeeAction =
  | { type: 'roll'; keepIndices: number[] }
  | { type: 'score'; category: keyof Scorecard }
  ;
```

---

## Scoring Implementation

```typescript
function calculateScore(dice: number[], category: keyof Scorecard): number {
  const counts = new Array(7).fill(0);
  dice.forEach(d => counts[d]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const sorted = [...dice].sort();
  const maxCount = Math.max(...counts);

  switch (category) {
    case 'ones': return counts[1] * 1;
    case 'twos': return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours': return counts[4] * 4;
    case 'fives': return counts[5] * 5;
    case 'sixes': return counts[6] * 6;
    case 'threeOfAKind': return maxCount >= 3 ? sum : 0;
    case 'fourOfAKind': return maxCount >= 4 ? sum : 0;
    case 'fullHouse': {
      const vals = counts.filter(c => c > 0);
      return (vals.length === 2 && (vals[0] === 2 || vals[0] === 3)) ? 25 : 0;
    }
    case 'smallStraight': {
      const unique = [...new Set(sorted)];
      const str = unique.join('');
      return (str.includes('1234') || str.includes('2345') || str.includes('3456')) ? 30 : 0;
    }
    case 'largeStraight': {
      const str = sorted.join('');
      return (str === '12345' || str === '23456') ? 40 : 0;
    }
    case 'yahtzee': return maxCount === 5 ? 50 : 0;
    case 'chance': return sum;
    default: return 0;
  }
}
```

---

## UI Specification

### Phone Layout

```
+------------------------------------+
| ROUND 8 of 13 - Your Turn         |
| Rolls remaining: 1                 |
+------------------------------------+
| Dice:                              |
| [3] [3] [5] [3] [2]              |
|  *   *       *                     |
| (tap to keep/release)              |
| [ROLL]                             |
+------------------------------------+
| SCORECARD:        You   Bob  Alice |
| Ones               3    2     -   |
| Twos               -    8     4   |
| ...                                |
| Three of Kind      -    -    15   |
| Full House         -   25     -   |
| Yahtzee           50    -     0   |
| Chance             -    -    22   |
|                                    |
| Tap a category to score            |
+------------------------------------+
```

- Dice at top, tappable to keep/release
- Scorecard below, showing all players
- Available categories highlighted with potential score
- Used categories show final score

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Turn timer | Off / 30s / 60s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators | Yes / No | Yes |
| Yahtzee bonus | Standard / Off | Standard |

---

## Hidden Information

**None during play** - all scorecards are public, dice are visible. Hands are not involved.

Excellent candidate for **client-side consensus** model.

---

## Edge Cases

- **Yahtzee bonus joker**: Complex rules around forced upper section, then joker into lower
- **Scratch (score 0)**: Any category can be scratched for 0 if nothing fits
- **Full House with 5-of-a-kind**: Not a full house in standard rules (need exactly 3+2)
- **Yahtzee as joker in Full House/Straight**: When using Yahtzee bonus joker, you score the full points (25 for Full House, 30/40 for straights)
- **Single player**: Yahtzee works solo - just going for high score

---

## Testing Plan

### Unit Tests
- `calculateScore()` for all 13 categories
- Edge cases: full house with pairs, small straight detection
- Yahtzee bonus rules and joker scoring
- Upper section bonus (>= 63)
- Grand total calculation
- Full 13-round game simulation

### E2E Tests
- Roll, keep, re-roll flow
- Score in each category type
- Yahtzee bonus scenario
- Multi-player game to completion
