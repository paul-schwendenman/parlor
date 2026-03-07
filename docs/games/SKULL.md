# Skull - Game Specification

## Overview

Skull is a pure bluffing game for 3-6 players. Each player has 4 coasters: 3 flowers and 1 skull. Players take turns placing coasters face-down, then bidding on how many they can flip without hitting a skull. It's the essence of bluffing distilled into the simplest possible game.

Works in **both modes**. Minimal hidden info (just your own coasters). Very quick rounds.

> **Note**: "Skull" (originally "Skull & Roses") is trademarked by Asmodee. Parlor needs an original name. The mechanic is extremely simple and generic. See `docs/LEGAL.md`.

---

## Rules

### Components

Each player has **4 coasters**:
- **3 Flowers** (safe)
- **1 Skull** (trap)

### Phase 1: Placing

Starting with the first player and going clockwise:
1. Each player places **1 coaster face-down** in front of themselves
2. Continue around until someone decides to bid instead of placing

You must place at least 1 coaster before anyone can bid. You can place up to all 4 of yours across multiple rounds of placement.

### Phase 2: Bidding

Once a player bids instead of placing:
1. They declare a number (how many total coasters they think they can flip safely)
2. Clockwise, each player must either **raise the bid** or **pass**
3. Passing means you're out of bidding but your coasters stay on the table
4. Bidding continues until everyone but one player has passed
5. The remaining player is the **challenger** and must flip that many coasters

### Phase 3: Flipping

The challenger must flip coasters one at a time:
1. **Must flip all of their own coasters first** (before touching anyone else's)
2. Then flip other players' coasters, choosing freely from any player's stack
3. Flip from the **top** of each player's stack

**If they flip all bid coasters without hitting a skull**: They win the round! They earn 1 point.

**If they hit a skull**: They lose! They must randomly discard one of their own coasters (permanently removed from the game, without showing it to others).

### Winning

- **2 points** (successful flips) = win the game
- Alternatively, if all other players have lost all their coasters, last player standing wins

### Losing Coasters

When you lose a coaster (hit a skull):
- Randomly remove one of your own coasters face-down (others don't know if it's your skull or a flower)
- If you lose your skull, you can never trap anyone again (but others don't know this)
- If you lose all 4 coasters, you're **eliminated**

### Strategy Notes

- You can place your skull and then bid high, knowing you'll hit your own skull first (but you must flip your own first, so your skull is a risk to yourself too)
- Actually: you must flip all of YOUR coasters first. So if you placed your skull, you'll hit it yourself. This means placing your skull is purely to trap others when THEY are the challenger.
- If you bid exactly the number of your own placed coasters, you only flip your own (safe if you know what you placed)

---

## Game State Model

```typescript
interface SkullGameState {
  roomId: string;
  players: SkullPlayer[];
  activePlayerIndex: number;
  phase: SkullPhase;
  currentBid: number | null;
  currentBidderId: string | null;
  passedPlayerIds: string[];
  totalCoastersOnTable: number;
  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface SkullPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Coaster[];              // coasters not yet placed (hidden)
  placed: Coaster[];            // face-down stack on table (hidden from others)
  points: number;               // 0-2 (2 = win)
  coastersRemaining: number;    // total coasters left (hand + placed)
  eliminated: boolean;
  hasPassed: boolean;           // passed on bidding this round
}

type Coaster = 'flower' | 'skull';

type SkullPhase =
  | 'placing'          // players placing coasters
  | 'bidding'          // players bidding or passing
  | 'flipping'         // challenger flipping coasters
  | 'round-result'     // showing result (success or skull hit)
  | 'discard'          // loser discarding a coaster
  | 'game-over';
```

### Player View

```typescript
interface SkullPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    placedCount: number;         // how many coasters placed (not what they are)
    handCount: number;           // how many still in hand
    coastersRemaining: number;
    points: number;
    eliminated: boolean;
    hasPassed: boolean;
  }[];

  // Private
  myHand: Coaster[];             // what's still in my hand
  myPlaced: Coaster[];           // what I placed (I can see my own, others can't)
  myIndex: number;

  // Game state
  activePlayerIndex: number;
  phase: SkullPhase;
  currentBid: number | null;
  currentBidderId: string | null;
  totalCoastersOnTable: number;

  // Flipping phase
  flippedCoasters: FlippedCoaster[] | null;
  remainingFlips: number | null;

  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface FlippedCoaster {
  playerId: string;
  coaster: Coaster;
}
```

### Actions

```typescript
type SkullAction =
  | { type: 'place'; coaster: Coaster }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'flip'; targetPlayerId: string }     // flip top of their stack
  | { type: 'discard'; handIndex: number }         // choose which coaster to lose
  ;
```

---

## Turn Flow

```
1. Phase: 'placing'
   - Starting player places 1 coaster face-down
   - Clockwise, each player either:
     a. Places 1 coaster from hand, OR
     b. Starts bidding (go to phase 2)
   - Must place at least 1 before bidding
   - Can place multiple across turns (up to all 4)

2. Phase: 'bidding'
   - Player who initiated declares a number (1 to total coasters on table)
   - Clockwise, each player:
     a. Raises the bid, OR
     b. Passes (out of bidding, coasters remain)
   - Continue until 1 player remains = challenger
   - Max bid = total coasters on table

3. Phase: 'flipping'
   - Challenger must flip their own placed coasters first (all of them)
   - Then choose any other player's top coaster to flip
   - One at a time until:
     a. Bid number reached (all flowers) → SUCCESS
     b. Skull revealed → FAIL

4. Phase: 'round-result'
   SUCCESS:
   - Challenger earns 1 point
   - If 2 points: game over, they win
   FAIL:
   - Challenger must discard 1 coaster randomly (without revealing)
   - If it was their skull that was hit by another player: the player
     who placed the skull chooses which of the challenger's coasters to discard
   - Actually: the standard rule is the challenger randomly discards one of their own

5. Phase: 'discard' (on fail)
   - Challenger secretly discards one coaster
   - If they now have 0 coasters: eliminated
   - Others don't see what was discarded

6. Reset:
   - All placed coasters return to hands
   - Next round starts
   - Loser (or winner) of previous round goes first
```

---

## UI Specification

### Phone Layout

```
+----------------------------+
| SKULL         Round 3      |
+----------------------------+
| Alice: 2 placed, 1pt      |
| Bob: 1 placed, 0pts       |
| Charlie: 3 placed, 1pt    |
| Total on table: 7          |
+----------------------------+
| YOUR COASTERS:             |
| Hand: [F] [F] [S]         |
| Placed: [F] (you know)    |
+----------------------------+
| Place a coaster:           |
| [Flower]  [Skull]          |
| -- or --                   |
| Start bidding: [BID]       |
+----------------------------+
```

### Bidding Phase

```
+----------------------------+
| Current bid: 4 (by Alice)  |
| Total on table: 7          |
|                            |
| [Raise to 5]               |
| [Raise to 6]               |
| [Raise to 7]               |
| [PASS]                     |
+----------------------------+
```

### Flipping Phase (Challenger)

```
+----------------------------+
| You must flip 5 coasters   |
| Flipped: 3 (all flowers)  |
| Remaining: 2               |
|                            |
| Your stack: done (2 flipped)|
|                            |
| Choose next:               |
| [Alice: 2 remaining]       |
| [Bob: 1 remaining]         |
| [Charlie: 3 remaining]     |
+----------------------------+
```

### Jackbox Host Screen

- Players shown in a circle with their coaster stacks
- Placed coasters as face-down pile (count visible)
- Points shown as stars/tokens
- Flipping: dramatic one-at-a-time reveal with suspense pause
- Skull hit: dramatic skull animation + gasp sound
- Victory: celebration for earning a point

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Points to win | 2 (standard) / 3 | 2 |
| Turn timer | Off / 15s / 30s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators | Yes / No | Yes |

---

## Hidden Information

- Your hand composition is hidden (others don't know if you still have your skull)
- Your placed coasters are hidden from others (but you see your own)
- What you discard when you lose is hidden
- Points and coaster counts are public

Server-authoritative (hidden coasters).

---

## Edge Cases

- **Bid equals own placed count**: Challenger only flips their own. Safe if they placed all flowers.
- **Bid equals total**: Must flip every coaster on the table. Risky.
- **Player has 1 coaster left**: They can only place that one. Everyone knows they placed it (but not what it is unless they lost their skull).
- **Lost skull**: You can never trap anyone. But others don't know. Your bluffing game changes completely.
- **All flowers remaining**: You can safely bid on your own coasters. Others might not know your skull is gone.
- **Elimination**: Removed from play, their placed coasters are also removed.

---

## Re-theming Notes

Skull is as mechanically minimal as games get. Any "safe/trap" binary with bluffing works.

| Original | Direction |
|----------|-----------|
| Skull & Roses | Any safe/danger duality: gems/bombs, flowers/thorns, gold/poison |
| Coasters | Tiles, cards, tokens |

---

## Testing Plan

### Unit Tests
- Placement validation (must have coaster in hand)
- Bid validation (must exceed current, max = total on table)
- Flip order enforcement (own coasters first)
- Success detection (bid count reached)
- Skull hit detection
- Coaster discard (random, hidden)
- Elimination at 0 coasters
- Win at 2 points
- Full game simulation

### E2E Tests
- 4-player game: place, bid, flip
- Successful flip earning a point
- Skull hit and coaster loss
- Player elimination
- Game to 2 points
