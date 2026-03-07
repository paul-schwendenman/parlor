# Sushi Go - Game Specification

## Overview

Sushi Go is a card drafting game for 2-5 players. Players simultaneously pick cards from a hand, then pass the remaining cards to the next player. After three rounds, the player with the most points wins. It's fast, simple, and works great as a light opener or closer.

Sushi Go is a great fit for **peer mode** since all players act simultaneously. Jackbox mode is possible but less necessary.

> **Note**: For Parlor, this game will need an original name and re-themed cards. See `docs/LEGAL.md`. Working title used here for clarity.

---

## Rules (Standard Published - Base Game)

### Components

**108 cards** in the base game:

| Card | Count | Scoring |
|------|-------|---------|
| **Tempura** | 14 | 5 pts per pair (incomplete pair = 0) |
| **Sashimi** | 14 | 10 pts per set of 3 (incomplete set = 0) |
| **Dumpling** | 14 | 1/3/6/10/15 pts for 1/2/3/4/5+ dumplings |
| **Maki Roll (3)** | 8 | Most maki icons: 6 pts. Second most: 3 pts |
| **Maki Roll (2)** | 12 | (Maki rolls show 1, 2, or 3 icons) |
| **Maki Roll (1)** | 6 | (Total maki icons across all your maki cards are counted) |
| **Salmon Nigiri** | 10 | 2 pts |
| **Squid Nigiri** | 5 | 3 pts |
| **Egg Nigiri** | 5 | 1 pt |
| **Wasabi** | 6 | Next nigiri played on it is worth triple |
| **Pudding** | 10 | End of game: most pudding = 6 pts, least = -6 pts |
| **Chopsticks** | 4 | On a future turn, swap chopsticks to take 2 cards instead of 1 |

### Setup

1. Shuffle all cards
2. Deal hands based on player count:
   - 2 players: 10 cards each
   - 3 players: 9 cards each
   - 4 players: 8 cards each
   - 5 players: 7 cards each
3. Play 3 rounds total

### Turn Structure (Simultaneous)

1. All players **simultaneously** choose 1 card from their hand and place it face-down
2. All players **reveal** their chosen cards at the same time
3. Resolve any special effects (wasabi + nigiri, chopsticks)
4. All players **pass** their remaining hand to the player on their **left**
5. Repeat until all cards are played

### Chopsticks

- When you play Chopsticks, it sits in front of you
- On any future turn, you may pick **2 cards** instead of 1 from your hand
- Put the Chopsticks card back into the hand you're passing
- You can only use Chopsticks once (it goes back into circulation)
- Announce "Sushi Go!" when using Chopsticks (thematic, not mechanical)

### Wasabi

- Wasabi sits in front of you waiting for nigiri
- The next nigiri you play goes on top of the wasabi and is worth **triple** points
- Wasabi without nigiri by end of round = 0 points
- Multiple wasabi: each gets the next available nigiri in play order

### Round End Scoring

After all cards are played in a round:

| Card | Scoring |
|------|---------|
| Tempura | 5 pts per complete pair. Leftover singles = 0 |
| Sashimi | 10 pts per complete set of 3. Leftovers = 0 |
| Dumpling | Cumulative: 1→1, 2→3, 3→6, 4→10, 5+→15 |
| Maki Roll | Count total maki icons. Most icons = 6 pts, 2nd most = 3 pts. Ties split (round down) |
| Nigiri | Egg=1, Salmon=2, Squid=3. Triple if on wasabi |
| Wasabi | 0 (only multiplies nigiri) |
| Chopsticks | 0 (utility only) |
| Pudding | NOT scored per round - kept until game end |

After scoring, **discard all cards except pudding**. Pudding cards stay in front of you across rounds.

### Game End (After Round 3)

1. Score round 3 normally
2. Score pudding:
   - Player(s) with **most pudding**: +6 pts (split if tied)
   - Player(s) with **least pudding**: -6 pts (split if tied)
   - In a 2-player game, no one loses points for least pudding
3. Highest total score across all 3 rounds wins
4. Tie-breaker: most pudding cards

---

## Game State Model

### Server State

```typescript
interface SushiGoGameState {
  roomId: string;
  players: SushiGoPlayer[];
  deck: Card[];
  round: number;                    // 1, 2, or 3
  turn: number;                     // which pick within the round
  totalTurns: number;               // cards per hand (varies by player count)
  phase: SushiGoPhase;
  passDirection: 'left';            // always left in base game
  gameOver: boolean;
  winner: string | null;
}

interface SushiGoPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];                     // current hand (private)
  played: Card[];                   // cards played this round (public)
  puddings: number;                 // pudding count carried across rounds
  roundScores: number[];            // score per round [r1, r2, r3]
  totalScore: number;
  selection: CardSelection | null;  // their pick for this turn (null = hasn't chosen yet)
}

type Card =
  | { type: 'tempura' }
  | { type: 'sashimi' }
  | { type: 'dumpling' }
  | { type: 'maki'; icons: 1 | 2 | 3 }
  | { type: 'nigiri'; variant: 'egg' | 'salmon' | 'squid' }
  | { type: 'wasabi'; hasNigiri: boolean; nigiri?: Card }
  | { type: 'pudding' }
  | { type: 'chopsticks' }
  ;

type SushiGoPhase =
  | 'picking'           // players choosing card(s) from hand
  | 'revealing'         // all picks revealed simultaneously
  | 'round-scoring'     // showing round scores
  | 'game-scoring'      // final scoring with pudding
  | 'game-over';

interface CardSelection {
  cardIndices: number[];    // 1 index normally, 2 if using chopsticks
  useChopsticks: boolean;
}
```

### Player View

```typescript
interface SushiGoPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    played: Card[];             // public - cards played so far this round
    puddings: number;
    roundScores: number[];
    totalScore: number;
    hasSelected: boolean;       // whether they've picked for this turn
    handSize: number;           // how many cards in their hand (not what they are)
  }[];

  // Private
  myHand: Card[];               // my current hand
  myIndex: number;
  hasChopsticksInPlay: boolean; // can I use chopsticks this turn?

  // Game state
  round: number;
  turn: number;
  totalTurns: number;
  phase: SushiGoPhase;

  // Scoring (populated at round/game end)
  roundBreakdown: RoundBreakdown | null;
  finalScores: FinalScore[] | null;

  gameOver: boolean;
  winner: string | null;
}

interface RoundBreakdown {
  players: {
    id: string;
    tempuraPts: number;
    sashimiPts: number;
    dumplingPts: number;
    makiPts: number;
    nigiriPts: number;
    total: number;
  }[];
}

interface FinalScore {
  id: string;
  roundScores: number[];
  puddingPts: number;
  totalScore: number;
  rank: number;
}
```

### Actions (Client to Server)

```typescript
type SushiGoAction =
  | { type: 'pick-card'; cardIndex: number }
  | { type: 'pick-with-chopsticks'; cardIndex1: number; cardIndex2: number }
  ;
```

---

## Turn Flow (Detailed)

```
1. Phase: 'picking'
   - All players see their current hand
   - Each player selects 1 card (or 2 if using chopsticks)
   - Server waits for all players to submit (with optional timer)
   - Selections are hidden until all players submit

2. Phase: 'revealing'
   - All selected cards are revealed simultaneously
   - Cards are added to each player's played area
   - Special effects resolve:
     - Nigiri auto-pairs with available wasabi
     - Chopsticks return: if used, chopsticks go into the hand being passed
   - Brief animation/display moment

3. Pass hands:
   - Each player's remaining hand passes to the player on their left
   - (In data terms: rotate the hand arrays)

4. If cards remain in hands, go to step 1
   If hands are empty, go to round scoring

5. Phase: 'round-scoring'
   - Calculate and display round scores
   - Show breakdown (tempura pairs, sashimi sets, dumpling count, maki ranking, nigiri values)
   - Discard all cards except pudding

6. If round < 3, deal new hands and go to step 1
   If round = 3, go to game scoring

7. Phase: 'game-scoring'
   - Score pudding (most = +6, least = -6)
   - Calculate final totals
   - Determine winner

8. Phase: 'game-over'
   - Show final rankings
   - Option to play again
```

---

## Scoring Implementation

```typescript
function scoreRound(players: SushiGoPlayer[]): RoundBreakdown {
  const breakdown = players.map(p => {
    const played = p.played;

    // Tempura: 5 per pair
    const tempuraCount = played.filter(c => c.type === 'tempura').length;
    const tempuraPts = Math.floor(tempuraCount / 2) * 5;

    // Sashimi: 10 per set of 3
    const sashimiCount = played.filter(c => c.type === 'sashimi').length;
    const sashimiPts = Math.floor(sashimiCount / 3) * 10;

    // Dumpling: cumulative scoring
    const dumplingCount = played.filter(c => c.type === 'dumpling').length;
    const dumplingPts = dumplingScore(dumplingCount);

    // Nigiri (including wasabi triples)
    let nigiriPts = 0;
    for (const card of played) {
      if (card.type === 'nigiri') {
        const base = card.variant === 'egg' ? 1 : card.variant === 'salmon' ? 2 : 3;
        nigiriPts += base; // plain nigiri
      }
      if (card.type === 'wasabi' && card.hasNigiri && card.nigiri) {
        const base = card.nigiri.variant === 'egg' ? 1
          : card.nigiri.variant === 'salmon' ? 2 : 3;
        nigiriPts += base * 3; // wasabi triples (the base was already not counted)
      }
    }

    return { id: p.id, tempuraPts, sashimiPts, dumplingPts, makiPts: 0, nigiriPts, total: 0 };
  });

  // Maki: compare totals across players
  const makiCounts = players.map(p => ({
    id: p.id,
    icons: p.played
      .filter(c => c.type === 'maki')
      .reduce((sum, c) => sum + (c as any).icons, 0)
  }));

  const sorted = [...new Set(makiCounts.map(m => m.icons))]
    .filter(n => n > 0)
    .sort((a, b) => b - a);

  if (sorted.length > 0) {
    const firstPlaceCount = makiCounts.filter(m => m.icons === sorted[0]).length;
    const firstPts = Math.floor(6 / firstPlaceCount);
    makiCounts.filter(m => m.icons === sorted[0])
      .forEach(m => { breakdown.find(b => b.id === m.id)!.makiPts = firstPts; });

    if (firstPlaceCount === 1 && sorted.length > 1) {
      const secondPlaceCount = makiCounts.filter(m => m.icons === sorted[1]).length;
      const secondPts = Math.floor(3 / secondPlaceCount);
      makiCounts.filter(m => m.icons === sorted[1])
        .forEach(m => { breakdown.find(b => b.id === m.id)!.makiPts = secondPts; });
    }
  }

  breakdown.forEach(b => {
    b.total = b.tempuraPts + b.sashimiPts + b.dumplingPts + b.makiPts + b.nigiriPts;
  });

  return { players: breakdown };
}

function dumplingScore(count: number): number {
  const table = [0, 1, 3, 6, 10, 15];
  return count >= 5 ? 15 : table[count];
}

function scorePudding(players: SushiGoPlayer[], playerCount: number): Record<string, number> {
  const scores: Record<string, number> = {};
  const puddingCounts = players.map(p => p.puddings);
  const max = Math.max(...puddingCounts);
  const min = Math.min(...puddingCounts);

  const maxCount = players.filter(p => p.puddings === max).length;
  const minCount = players.filter(p => p.puddings === min).length;

  for (const p of players) {
    scores[p.id] = 0;
    if (p.puddings === max) {
      scores[p.id] += Math.floor(6 / maxCount);
    }
    if (p.puddings === min && playerCount > 2) {
      scores[p.id] -= Math.floor(6 / minCount);
    }
  }

  return scores;
}
```

---

## UI Specification

### Hand Display (Phone - Picking Phase)

```
+-------------------------------------------+
| Round 2, Pick 4 of 8                      |
| Pass direction: <-- left                  |
+-------------------------------------------+
|                                           |
|  [Tempura] [Maki x2] [Salmon]           |
|  [Dumpling] [Wasabi] [Chopsticks]        |
|  [Sashimi] [Pudding]                     |
|                                           |
|  Tap a card to select it                  |
|                                           |
|  Waiting for: Alice, Charlie              |
+-------------------------------------------+
```

- Cards shown as tappable tiles with icons and names
- Selected card highlighted/raised
- Confirm button appears after selection
- If chopsticks in play, prompt: "Use chopsticks to pick 2?"
- Show who has/hasn't picked yet (without revealing choices)

### Played Cards Area

```
+-------------------------------------------+
| YOUR PLAYED CARDS:                        |
| [Tempura] [Tempura] = 5 pts              |
| [Maki x3] [Maki x1] = 4 icons           |
| [Wasabi + Squid Nigiri] = 9 pts          |
| [Pudding] [Pudding]                      |
+-------------------------------------------+
```

- Cards grouped by type for easy reading
- Running score shown per group
- Wasabi+nigiri shown as a combined unit
- Pudding count emphasized (carries across rounds)

### All Players Overview

```
+-------------------------------------------+
| ROUND 2 SCORES:                          |
|                                           |
| Alice:  32 pts  | 3 maki | 2 pudding    |
| You:    28 pts  | 4 maki | 1 pudding    |
| Bob:    25 pts  | 2 maki | 3 pudding    |
| Charlie: 30 pts | 1 maki | 0 pudding    |
+-------------------------------------------+
```

- Swipeable/tappable to see each player's full played cards
- Maki count visible (for maki race awareness)
- Pudding count visible (for end-game planning)

### Reveal Animation

When all players have picked:
1. Brief "Revealing..." moment (~500ms)
2. All chosen cards flip/appear simultaneously
3. Cards slide into each player's played area
4. Score updates animate
5. Hands visually "pass" to the left (subtle animation)

### Round Scoring Screen

```
+-------------------------------------------+
| ROUND 2 COMPLETE                          |
+-------------------------------------------+
| Category    | Alice | You  | Bob | Charlie|
|-------------|-------|------|-----|--------|
| Tempura     |   5   |  0   |  5  |   0   |
| Sashimi     |  10   |  0   |  0  |  10   |
| Dumpling    |   3   |  6   |  1  |   3   |
| Maki        |   3   |  6   |  0  |   0   |
| Nigiri      |   6   |  9   |  4  |   2   |
|-------------|-------|------|-----|--------|
| Round total |  27   | 21   | 10  |  15   |
| Overall     |  59   | 49   | 35  |  45   |
+-------------------------------------------+
| [Next Round]                              |
+-------------------------------------------+
```

### Game End Screen

```
+-------------------------------------------+
| FINAL SCORES                              |
+-------------------------------------------+
| 1st: Alice - 87 pts                      |
|   Rounds: 32 + 27 + 22 = 81             |
|   Pudding: +6 (most, 5 cards)           |
|                                           |
| 2nd: You - 76 pts                        |
|   Rounds: 28 + 21 + 30 = 79             |
|   Pudding: -3 (least tied, 1 card)       |
|                                           |
| ...                                       |
+-------------------------------------------+
| [Play Again] [Back to Lobby]             |
+-------------------------------------------+
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Pick timer | Off / 10s / 20s / 30s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators allowed | Yes / No | Yes |

Future options (if implementing Sushi Go Party):
- Card set customization (swap out which card types are in the game)
- Player count beyond 5 (Party supports up to 8)

---

## Hidden Information

- **Hands are hidden** - you only see your own current hand
- **Played cards are public** - everyone can see what everyone has played
- **Hand sizes are public** - you know how many cards each player holds
- Since hands rotate, you'll eventually see all the cards that were in circulation

This is moderate hidden information. Server-authoritative is cleanest, but the consensus model could work since the hidden info (hands) rotates and becomes public quickly.

---

## Edge Cases

### Chopsticks Usage

- Player must have Chopsticks in their played area to use it
- When used: pick 2 cards, Chopsticks goes back into the hand being passed
- Can only use 1 Chopsticks per turn (even if you have multiple in play)
- If only 1 card left in hand, cannot use Chopsticks

### Wasabi Stacking

- Multiple wasabi cards wait independently
- First nigiri played goes to the oldest waiting wasabi
- Wasabi without nigiri at round end = 0 points

### Maki Ties

- If 2+ players tie for most maki: split 6 points (round down). No second place awarded.
- If 1 player has most, and 2+ tie for second: split 3 points (round down)
- Example: three players tie for most = 2 pts each, no second place

### Pudding Ties

- Ties for most pudding: split +6 (round down)
- Ties for least pudding: split -6 (round down, so -3 each for 2-way tie)
- In 2-player game: no penalty for least pudding

### Disconnect During Picking

- If a player disconnects during picking, auto-pick after timeout (random valid card)
- If they reconnect, they can change their pick if the timer hasn't expired

### 2-Player Variant

- Deal 10 cards each
- Also deal a dummy hand of 5 cards, face up on the table
- On each turn, players choose from their hand (hidden) but can see the dummy hand's contents for information
- Actually, the standard rules just work with 2 players without modification (10 card hands)

---

## Re-theming Notes

Sushi Go's theme is entirely decorative. The mechanics work with any "collection" theme.

| Original | Re-theme Direction |
|----------|-------------------|
| Sushi Go | Any collecting theme - space junk, garden flowers, treasure, potions, etc. |
| Tempura | Any "pair" collectible |
| Sashimi | Any "set of 3" collectible |
| Dumpling | Any "the more the merrier" collectible |
| Maki Roll | Any "race for most" item |
| Nigiri | Any "base value" item |
| Wasabi | Any "multiplier" item |
| Pudding | Any "long-term investment" item |
| Chopsticks | Any "take an extra turn" utility |

---

## Testing Plan

### Unit Tests (Vitest)

- Scoring per card type:
  - Tempura: 0 for 1, 5 for 2, 5 for 3, 10 for 4
  - Sashimi: 0 for 1-2, 10 for 3, 10 for 4-5, 20 for 6
  - Dumpling: 1/3/6/10/15 progression, caps at 15
  - Maki: ranking with ties, split points
  - Nigiri: base values, wasabi triple
  - Pudding: most/least with ties, 2-player exception
- Wasabi pairing logic (oldest wasabi gets next nigiri)
- Chopsticks: pick 2, return to hand
- Hand passing (rotation)
- Round scoring: full breakdown
- Game scoring: 3 rounds + pudding
- Tie-breaking (most pudding)
- Full game simulation

### E2E Tests (Playwright)

- 3-player game: create, join, start
- Pick cards, verify reveal animation
- Verify hand rotation (you see cards that were passed to you)
- Chopsticks usage flow
- Round scoring display
- Play 3 rounds to completion
- Final scoring with pudding
- Reconnection during pick phase
