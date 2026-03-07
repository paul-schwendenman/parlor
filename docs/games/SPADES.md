# Spades - Game Specification

## Overview

Spades is a trick-taking card game for 4 players in 2 fixed teams (partners sit across). Played with a standard 52-card deck. Before play, each player bids how many tricks they expect to win. Spades are always trump. Teams try to hit their combined bid exactly - overbidding risks penalties (bags), underbidding loses points.

Spades shares the trick-taking engine with Hearts and Euchre. Best in **peer mode**.

> **Note**: Spades is a traditional public domain game. No IP concerns.

---

## Rules

### Setup

- Standard 52-card deck, fully dealt
- **13 cards** per player
- **2 teams**: Partners sit across (players 0+2 vs 1+3)
- Card ranking (high to low): A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2
- **Spades are always trump**

### Bidding

After dealing, each player bids the number of tricks they expect to win (0-13). Bidding goes clockwise starting left of dealer.

- **Team bid** = sum of both partners' bids
- **Nil bid**: Bidding 0 (nil) is a special bet that you will take NO tricks
  - Successful nil: +100 points
  - Failed nil: -100 points
  - Partner still plays normally and tries to make their individual bid
- **Blind nil** (optional rule): Bid nil before looking at your cards
  - Successful: +200 points
  - Failed: -200 points
  - After bidding blind nil, you may exchange 2 cards with your partner

### Play

1. Player left of dealer leads the first trick
2. **Follow suit** if possible
3. If void in the led suit, may play any card (including spades)
4. **Cannot lead spades** until spades have been "broken" (played on a previous trick because someone was void)
5. Highest card of the led suit wins, unless trumped by a spade
6. Highest spade wins if spades were played
7. Trick winner leads the next trick

### Scoring

After all 13 tricks:

**Team made their bid (tricks >= team bid):**
- +10 points per bid trick
- +1 point per overtrick ("bag")
- **Bag penalty**: Every time a team accumulates **10 bags**, they lose **100 points**

**Team missed their bid (tricks < team bid):**
- -10 points per bid trick (lose the full bid value)

**Nil scoring** is separate and added/subtracted independently from the team's bid scoring.

### Example Scoring

Team bids: Alice 4, Charlie 3 = team bid 7. They take 9 tricks.
- Bid made: +70 points (7 x 10)
- Overtricks: +2 bags
- If they now have 10+ total bags: -100 penalty

### Game End

First team to **500 points** wins. If both teams pass 500 in the same round, higher score wins.

Alternative: Play to a set number of rounds.

---

## Game State Model

```typescript
interface SpadesGameState {
  roomId: string;
  players: SpadesPlayer[];       // always 4
  teams: [SpadesTeam, SpadesTeam];
  dealerIndex: number;
  phase: SpadesPhase;
  currentTrick: TrickCard[];
  leadPlayerIndex: number;
  activePlayerIndex: number;
  trickNumber: number;           // 1-13
  spadesBroken: boolean;
  round: number;
  gameOver: boolean;
  winningTeam: number | null;
}

interface SpadesPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  bid: number | null;            // null if not yet bid
  isNil: boolean;
  isBlindNil: boolean;
  tricksTaken: number;
  teamIndex: number;
}

interface SpadesTeam {
  playerIds: string[];
  score: number;
  bags: number;                  // accumulated overtricks (reset at 10 with penalty)
  totalBid: number | null;
}

interface TrickCard {
  playerId: string;
  card: Card;
}

type SpadesPhase =
  | 'bidding'          // each player bids in turn
  | 'blind-nil-swap'   // blind nil player exchanging cards with partner
  | 'playing'          // trick-taking
  | 'trick-won'        // brief display
  | 'round-scoring'    // show round results
  | 'game-over';
```

### Player View

```typescript
interface SpadesPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardCount: number;
    bid: number | null;
    isNil: boolean;
    tricksTaken: number;
    teamIndex: number;
    isDealer: boolean;
  }[];

  teams: {
    score: number;
    bags: number;
    totalBid: number | null;
    tricksTaken: number;
  }[];

  // Private
  myHand: Card[];
  myIndex: number;
  myTeam: number;

  // Game state
  phase: SpadesPhase;
  activePlayerIndex: number;
  currentTrick: TrickCard[];
  trickNumber: number;
  spadesBroken: boolean;
  playableCards: number[];

  // Round end
  roundResults: RoundResult | null;

  round: number;
  gameOver: boolean;
  winningTeam: number | null;
}
```

### Actions

```typescript
type SpadesAction =
  | { type: 'bid'; amount: number }
  | { type: 'bid-nil' }
  | { type: 'bid-blind-nil' }
  | { type: 'blind-nil-swap'; cardIndices: number[] }   // 2 cards to give partner
  | { type: 'play-card'; cardIndex: number }
  ;
```

---

## Turn Flow

```
1. Deal 13 cards to each player

2. Phase: 'bidding'
   - Starting left of dealer, each player bids
   - Options: 1-13, Nil, Blind Nil (if enabled)
   - Blind Nil must be declared before looking at cards
   - After all 4 bid, compute team bids

3. Phase: 'blind-nil-swap' (if applicable)
   - Blind nil player and partner exchange 2 cards each

4. Phase: 'playing'
   - Left of dealer leads first trick
   - Cannot lead spades until broken
   - Follow suit rules apply
   - Spades trump everything

5. Phase: 'trick-won'
   - Show winner, add to their trick count
   - Winner leads next trick

6. After 13 tricks:
   Phase: 'round-scoring'
   - Calculate bid vs tricks for each team
   - Apply nil bonuses/penalties
   - Track bags, apply bag penalties if threshold hit
   - Check for game end (500+)

7. If game continues, rotate dealer, go to step 1
```

---

## Scoring Implementation

```typescript
function scoreRound(team: SpadesTeam, players: SpadesPlayer[]): {
  bidPoints: number;
  bagPoints: number;
  nilPoints: number;
  bagPenalty: number;
  totalRoundScore: number;
  newBags: number;
} {
  const teamPlayers = players.filter(p => team.playerIds.includes(p.id));
  const nonNilPlayers = teamPlayers.filter(p => !p.isNil);
  const nilPlayers = teamPlayers.filter(p => p.isNil);

  // Nil scoring
  let nilPoints = 0;
  for (const p of nilPlayers) {
    const nilValue = p.isBlindNil ? 200 : 100;
    nilPoints += p.tricksTaken === 0 ? nilValue : -nilValue;
  }

  // Team bid scoring (excluding nil players)
  const teamBid = nonNilPlayers.reduce((sum, p) => sum + (p.bid ?? 0), 0);
  const teamTricks = nonNilPlayers.reduce((sum, p) => sum + p.tricksTaken, 0);

  let bidPoints = 0;
  let bagPoints = 0;
  let newBags = team.bags;

  if (teamTricks >= teamBid) {
    bidPoints = teamBid * 10;
    const overtricks = teamTricks - teamBid;
    bagPoints = overtricks;
    newBags += overtricks;
  } else {
    bidPoints = -(teamBid * 10);
  }

  // Bag penalty
  let bagPenalty = 0;
  while (newBags >= 10) {
    bagPenalty -= 100;
    newBags -= 10;
  }

  return {
    bidPoints,
    bagPoints,
    nilPoints,
    bagPenalty,
    totalRoundScore: bidPoints + bagPoints + nilPoints + bagPenalty,
    newBags,
  };
}
```

---

## UI Specification

### Phone Layout

```
+------------------------------------+
| Partner (Alice) bid: 4, taken: 3   |
| Team 1: 230pts (4 bags)            |
+------------------------------------+
| Bob bid:3      |      Dan bid:2    |
| taken: 2       |      taken: 1    |
| Team 2: 180pts (7 bags!)          |
+------------------------------------+
| Trick 8 of 13    Spades: BROKEN   |
|                                    |
| Bob: [Jd]  Dan: [3d]             |
| Alice: [Ad]  You: ???            |
+------------------------------------+
| [2c][7d][Qs][3s][8s][Js][As]     |
| Diamonds led - must follow or trump|
+------------------------------------+
```

### Bidding UI

```
+------------------------------------+
| YOUR HAND:                         |
| [Ac][8c][3c][Kd][7d][4d][Qs]     |
| [Jh][5h][As][Js][8s][3s]         |
|                                    |
| How many tricks will you win?      |
| [1] [2] [3] [4] [5] [6]         |
| [7] [8] [9] [10][11][12][13]     |
| [Nil]  [Blind Nil]               |
+------------------------------------+
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Points to win | 200 / 300 / 500 | 500 |
| Blind nil | Enabled / Disabled | Enabled |
| Bag penalty threshold | 10 / 5 / Off | 10 |
| Turn timer | Off / 15s / 30s | Off |
| Spectators | Yes / No | Yes |

---

## Shared Engine with Hearts/Euchre

Spades, Hearts, and Euchre all share a trick-taking core:

```typescript
interface TrickTakingEngine {
  validatePlay(hand: Card[], trick: TrickCard[], card: Card, trumpSuit?: Suit): boolean;
  determineTrickWinner(trick: TrickCard[], trumpSuit?: Suit): string;
  getPlayableCards(hand: Card[], trick: TrickCard[], trumpSuit?: Suit): Card[];
}
```

Differences:
- **Spades**: Fixed trump (spades), bidding, bags
- **Hearts**: No trump, avoid points, shoot the moon
- **Euchre**: Bid for trump, bowers, 5-card hands

A shared trick-taking engine would reduce duplication across all three.

---

## Edge Cases

- **Leading spades**: Only allowed after broken (or if hand is all spades)
- **Nil player takes a trick**: Nil fails immediately (penalty applied at round end)
- **Both players bid nil**: Legal but risky. Team bid for non-nil is 0.
- **Blind nil swap**: 2 cards each, simultaneously, before seeing partner's cards
- **Bag penalty + missed bid in same round**: Both apply
- **Negative scores**: Possible and legal. Game continues until someone hits target.
- **Both teams pass 500 in same round**: Higher score wins

---

## Testing Plan

### Unit Tests
- Trick-taking: follow suit, trumping, winner determination
- Spades breaking rules
- Bidding validation
- Scoring: made bid, missed bid, overtricks/bags
- Bag penalty at threshold
- Nil and blind nil scoring
- Round simulation
- Full game to 500

### E2E Tests
- 4-player game, bidding phase
- Play 13 tricks with spades breaking
- Nil bid attempt (success and failure)
- Score tracking across rounds
- Game end at target score
