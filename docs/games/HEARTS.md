# Hearts - Game Specification

## Overview

Hearts is a classic trick-taking card game for 4 players. Players try to avoid taking hearts (1 point each) and the Queen of Spades (13 points). Lowest score wins. The twist: if you take ALL the hearts and the Queen of Spades, you "shoot the moon" and everyone else gets 26 points instead.

Hearts is a well-known public domain game with no IP concerns. Perfect for **peer mode** - each player needs to see their hand and track tricks.

---

## Rules

### Setup

1. Standard 52-card deck
2. Deal **13 cards** to each player (all cards dealt)

### Passing

Before play begins, players pass 3 cards:
- **Round 1**: Pass left
- **Round 2**: Pass right
- **Round 3**: Pass across
- **Round 4**: No passing (hold)
- Repeat this 4-round cycle

### Play

1. **Player with 2 of Clubs** leads the first trick
2. Players must **follow suit** if possible
3. If void in the led suit, play any card (with restrictions below)
4. Highest card of the led suit wins the trick
5. Trick winner leads the next trick
6. No trump suit

### Restrictions

- **Cannot lead hearts** until hearts have been "broken" (a heart has been played on a previous trick because someone was void in the led suit)
- **First trick**: Cannot play hearts or the Queen of Spades

### Scoring

After all 13 tricks are played:

| Card | Points |
|------|--------|
| Each heart (2h through Ah) | 1 point |
| Queen of Spades | 13 points |

- Total penalty points per round: 26
- **Shooting the Moon**: If one player takes ALL 13 hearts AND the Queen of Spades, they score 0 and every other player gets +26

### Game End

- Play continues across multiple rounds
- Game ends when any player reaches **100 points** (configurable)
- **Lowest score wins**

---

## Game State Model

```typescript
interface HeartsGameState {
  roomId: string;
  players: HeartsPlayer[];
  phase: HeartsPhase;
  passDirection: 'left' | 'right' | 'across' | 'none';
  currentTrick: TrickCard[];
  leadPlayerIndex: number;
  trickNumber: number;          // 1-13
  heartsBroken: boolean;
  round: number;
  gameOver: boolean;
  winner: string | null;        // lowest score
}

interface HeartsPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  tricksWon: Card[][];          // cards taken this round
  roundScore: number;           // points taken this round
  totalScore: number;
  passedCards: Card[] | null;   // cards they're passing (before swap)
  receivedCards: Card[] | null;
}

interface TrickCard {
  playerId: string;
  card: Card;
}

type HeartsPhase =
  | 'passing'         // selecting 3 cards to pass
  | 'playing'         // trick-taking
  | 'trick-won'       // brief display of trick winner
  | 'round-scoring'   // end of round scoring
  | 'game-over';
```

### Player View

```typescript
interface HeartsPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardCount: number;
    roundScore: number;
    totalScore: number;
    hasPassed: boolean;          // during passing phase
    tricksTaken: number;
  }[];

  // Private
  myHand: Card[];
  myIndex: number;

  // Passing
  passDirection: 'left' | 'right' | 'across' | 'none';

  // Trick
  currentTrick: TrickCard[];
  leadPlayerIndex: number;
  activePlayerIndex: number;
  trickNumber: number;
  heartsBroken: boolean;
  playableCards: number[];       // indices of cards legal to play

  phase: HeartsPhase;
  round: number;

  // Round end
  roundResults: RoundResult[] | null;
  moonShooter: string | null;

  gameOver: boolean;
  winner: string | null;
}
```

### Actions

```typescript
type HeartsAction =
  | { type: 'pass-cards'; cardIndices: number[] }  // exactly 3
  | { type: 'play-card'; cardIndex: number }
  ;
```

---

## Turn Flow

```
1. Deal 13 cards to each player

2. Phase: 'passing' (unless direction is 'none')
   - Each player selects 3 cards to pass
   - Wait for all 4 to submit
   - Swap cards simultaneously

3. Phase: 'playing'
   - Player with 2 of Clubs leads first trick
   - Each player plays one card (clockwise)
   - Must follow suit if possible
   - Restrictions: no hearts/QoS on first trick, no leading hearts until broken
   - Highest card of led suit wins trick

4. Phase: 'trick-won' (brief)
   - Show who won the trick and what cards were taken
   - Winner leads next trick

5. Repeat steps 3-4 for 13 tricks

6. Phase: 'round-scoring'
   - Calculate points taken by each player
   - Check for shoot the moon
   - Add to total scores
   - Check for game end (100+ points)

7. If game continues, go to step 1 with next pass direction
```

---

## UI Specification

### Phone Layout

```
+------------------------------------+
| Alice: 4pts  |  Bob: 12pts        |
|   2 cards    |    5 cards          |
+------------------------------------+
|                                    |
|  Current trick:                    |
|  Alice: [Jh]  Bob: [4h]          |
|  You: ???     Charlie: ???         |
|                                    |
+------------------------------------+
| YOUR HAND:                         |
| [2c][5c][8c][Qd][3h][7h][Ks]     |
|                                    |
| Hearts broken: No                  |
| Trick 3 of 13                      |
+------------------------------------+
```

- Hand at bottom, sorted by suit
- Current trick in center (cards appear as players play)
- Playable cards highlighted, unplayable dimmed
- Score summary always visible

### Passing UI

```
+------------------------------------+
| Pass 3 cards LEFT                  |
|                                    |
| Tap 3 cards to select:            |
| [2c][5c][8c][Qd][3h][7h][Ks]    |
|  *           *         *          |
| Selected: 2c, Qd, 7h             |
|                                    |
| [Confirm Pass]                     |
+------------------------------------+
```

---

## Hidden Information

- Each player's hand is hidden
- Passed cards are hidden until received
- Won tricks are public (but full contents don't need to stay visible - just the point count)

Server-authoritative.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Game end score | 50 / 100 / 150 / 200 | 100 |
| Jack of Diamonds rule | Off / On (-10 pts) | Off |
| Turn timer | Off / 15s / 30s | Off |
| Spectators | Yes / No | Yes |

---

## Edge Cases

- **Shoot the Moon**: Player takes all 26 pts → 0 for them, +26 for others
- **All hearts in hand**: Must lead hearts even if not broken (forced)
- **Only hearts left**: Hearts are automatically "broken"
- **Void on first trick**: Can play hearts (but not Queen of Spades in standard rules; some variants allow it)
- **Tie at game end**: Player with fewer rounds of high score wins (or shared victory)
- **3 players**: Remove 2 of Diamonds, deal 17 each. Same rules. Passing: left, right, none (3-cycle)

---

## Testing Plan

### Unit Tests
- Suit-following validation
- Hearts broken tracking
- First trick restrictions
- Trick winner determination (highest of led suit)
- Scoring: hearts and Queen of Spades
- Shoot the Moon detection and scoring
- Pass direction cycling
- Game end at 100 points

### E2E Tests
- 4-player game, passing phase
- Play 13 tricks, verify scoring
- Shoot the Moon scenario
- Multi-round game to completion
