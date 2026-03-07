# Euchre - Game Specification

## Overview

Euchre is a trick-taking card game for 4 players in 2 teams (partners sit across from each other). Played with a 24-card deck (9-A in each suit). Each round, one suit becomes trump and teams try to win the majority of 5 tricks. Features "going alone" (playing without your partner for bonus points) and the unique "right bower / left bower" trump hierarchy.

Euchre is public domain. Perfect for **peer mode** with team-based play.

---

## Rules

### Setup

- **24-card deck**: 9, 10, J, Q, K, A in each of the 4 suits
- **4 players** in 2 teams: players sitting across from each other are partners
- Deal **5 cards** each (two rounds of dealing: 2 then 3, or 3 then 2)
- Place the next card face-up on the remaining deck (the "up card")

### Trump Hierarchy

When a suit is trump, the ranking from highest to lowest:

1. **Right Bower**: Jack of the trump suit (highest trump)
2. **Left Bower**: Jack of the same-color suit (second highest trump; this card is considered trump, NOT its printed suit)
3. Ace of trump
4. King of trump
5. Queen of trump
6. 10 of trump
7. 9 of trump

Non-trump suits rank normally: A, K, Q, J, 10, 9 (but remember the left bower has left its original suit).

**Same-color suit pairs**: Hearts/Diamonds (both red), Clubs/Spades (both black).

### Bidding (Trump Selection)

#### Round 1: Up Card

Starting left of dealer, each player either:
- **Orders it up**: The up card's suit becomes trump. Dealer picks up the up card and discards one card.
- **Passes**

If all 4 pass, the up card is turned face-down.

#### Round 2: Name Suit

Starting left of dealer, each player either:
- **Names a suit** (NOT the up card's suit): That suit becomes trump.
- **Passes**

If all 4 pass again: **Stick the dealer** (common rule) - dealer must name a suit. Or: redeal (variant).

### Going Alone

When ordering up or naming trump, a player may declare **"alone"**:
- Their partner sits out (puts cards face down)
- If the loner's team takes all 5 tricks: **4 points** instead of 2
- If the loner's team takes 3-4 tricks: **1 point** (same as normal)
- If euchred (fewer than 3 tricks): opponents get 2 points

### Play

1. **Player left of dealer** leads the first trick (or left of loner's partner if going alone)
2. Must **follow suit** if possible (left bower follows trump, not its printed suit)
3. Highest card of led suit wins, unless trumped
4. Trump beats all non-trump
5. Trick winner leads the next

### Scoring

| Result | Points |
|--------|--------|
| Makers take 3-4 tricks | 1 point |
| Makers take all 5 tricks (march) | 2 points |
| Makers euchred (< 3 tricks) | 2 points to **defenders** |
| Loner takes all 5 tricks | 4 points |
| Loner takes 3-4 tricks | 1 point |
| Loner euchred | 2 points to defenders |

### Game End

First team to **10 points** wins (some play to 5 or 7).

---

## Game State Model

```typescript
interface EuchreGameState {
  roomId: string;
  players: EuchrePlayer[];      // always 4, indexed 0-3
  teams: [TeamState, TeamState]; // team 0: players 0,2. team 1: players 1,3
  dealerIndex: number;
  phase: EuchrePhase;
  upCard: Card | null;
  trump: Suit | null;
  makerTeam: number | null;     // 0 or 1
  loner: string | null;         // player ID going alone, or null
  currentTrick: TrickCard[];
  leadPlayerIndex: number;
  tricksWon: [number, number];  // tricks per team this round
  round: number;
  gameOver: boolean;
  winningTeam: number | null;
}

interface EuchrePlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  teamIndex: number;            // 0 or 1
  sittingOut: boolean;          // partner of loner
}

interface TeamState {
  score: number;
  playerIds: string[];
}

type EuchrePhase =
  | 'bidding-round1'   // deciding on the up card
  | 'bidding-round2'   // naming a different suit
  | 'dealer-discard'   // dealer picking up and discarding
  | 'playing'          // trick-taking
  | 'trick-won'        // brief
  | 'round-scoring'    // show round result
  | 'game-over';
```

### Player View

```typescript
interface EuchrePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardCount: number;
    teamIndex: number;
    isDealer: boolean;
    sittingOut: boolean;
  }[];

  teams: [{ score: number }, { score: number }];

  // Private
  myHand: Card[];
  myIndex: number;
  myTeam: number;

  // Bidding
  upCard: Card | null;
  trump: Suit | null;
  phase: EuchrePhase;
  activePlayerIndex: number;

  // Play
  currentTrick: TrickCard[];
  leadPlayerIndex: number;
  tricksWon: [number, number];
  playableCards: number[];

  // Round end
  makerTeam: number | null;
  loner: string | null;
  roundResult: RoundResult | null;

  gameOver: boolean;
  winningTeam: number | null;
}
```

### Actions

```typescript
type EuchreAction =
  | { type: 'order-up'; alone: boolean }
  | { type: 'pass' }
  | { type: 'name-trump'; suit: Suit; alone: boolean }
  | { type: 'dealer-discard'; cardIndex: number }
  | { type: 'play-card'; cardIndex: number }
  ;
```

---

## Key Implementation Details

### Left Bower Suit Resolution

The left bower is the trickiest part of Euchre to implement:
- When hearts is trump, the Jack of Diamonds becomes a heart (trump)
- It follows trump, not diamonds
- It must be played when trump is led (it IS trump)
- It cannot be played to follow diamonds (it's no longer a diamond)

```typescript
function effectiveSuit(card: Card, trump: Suit): Suit {
  if (card.rank === 'J' && sameColor(card.suit, trump) && card.suit !== trump) {
    return trump; // left bower
  }
  return card.suit;
}

function sameColor(a: Suit, b: Suit): boolean {
  const reds: Suit[] = ['hearts', 'diamonds'];
  const blacks: Suit[] = ['clubs', 'spades'];
  return (reds.includes(a) && reds.includes(b)) || (blacks.includes(a) && blacks.includes(b));
}
```

### Card Ranking

```typescript
function cardStrength(card: Card, trump: Suit, ledSuit: Suit): number {
  const eSuit = effectiveSuit(card, trump);

  // Right bower (highest)
  if (card.rank === 'J' && card.suit === trump) return 600;
  // Left bower
  if (card.rank === 'J' && eSuit === trump) return 500;

  const baseRanks: Record<Rank, number> = {
    '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6
  };

  if (eSuit === trump) return 100 + baseRanks[card.rank];
  if (eSuit === ledSuit) return baseRanks[card.rank];
  return 0; // off-suit, can't win
}
```

---

## UI Specification

### Phone Layout

```
+------------------------------------+
| Partner (Alice) - 4 cards          |
| Team 1: 6pts    Team 2: 4pts      |
+------------------------------------+
| Opp (Bob)                 Opp (Dan)|
| 3 cards                    5 cards |
+------------------------------------+
|                                    |
| Trump: Hearts [J right bower]     |
| Tricks: Us 2 - Them 1             |
|                                    |
| Current trick:                     |
| Bob: [Ah]  Dan: ---               |
| Alice: [10h]  You: ???            |
+------------------------------------+
| [9c] [Jd*] [Qs] [Kh] [Ah]       |
|       ^ left bower (trump!)       |
+------------------------------------+
```

- Left bower visually marked as trump
- Team scores prominent
- Partner at top, opponents on sides

### Bidding UI

```
Round 1 - Up card: [Jh]
[Order Up]  [Order Up Alone]  [Pass]
```

```
Round 2 - Name trump (not hearts):
[Clubs] [Diamonds] [Spades]
[ ] Go alone
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Points to win | 5 / 7 / 10 | 10 |
| Stick the dealer | Yes / No | Yes |
| Turn timer | Off / 15s / 30s | Off |
| Spectators | Yes / No | Yes |

---

## Edge Cases

- **Left bower suit following**: Must follow trump when led, cannot follow its printed suit
- **Dealer picks up and discards**: Can discard the picked-up card immediately
- **Loner's partner**: Sits out entirely, no cards played
- **Stick the dealer**: Dealer MUST name a suit in round 2 (no passing)
- **All pass round 1 and 2 without stick**: Redeal with next dealer

---

## Testing Plan

### Unit Tests
- `effectiveSuit()` for left bower
- `cardStrength()` ranking with trump
- Suit-following validation (left bower edge case)
- Trick winner with trump, without trump, with bowers
- Scoring: march, euchre, loner
- Bidding flow: round 1, round 2, stick the dealer
- Full round simulation

### E2E Tests
- 4-player game, team formation
- Bidding and trump selection
- Playing tricks with bower mechanics
- Loner declaration and partner sitting out
- Score to game end
