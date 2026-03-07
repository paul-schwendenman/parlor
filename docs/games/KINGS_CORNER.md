# Kings in the Corner - Game Specification

## Overview

Kings in the Corner (Kings Corner) is a multiplayer solitaire-style card game for 2-4 players using a standard 52-card deck. Players take turns placing cards on foundation piles in descending order with alternating colors, similar to solitaire. Kings can be placed in the corner positions. First player to empty their hand wins.

A good fit for **peer mode** - each player needs to see the shared board and their own hand.

> **Note**: Kings in the Corner uses a standard deck and public-domain rules. No trademark or IP concerns.

---

## Rules

### Setup

1. Standard 52-card deck, shuffled
2. Deal **7 cards** to each player
3. Place **4 cards** face-up in the cardinal positions (N, S, E, W) as foundation piles
4. The 4 diagonal (corner) positions start empty
5. Remaining cards form the draw pile

### Board Layout

```
              [NW corner]    [N pile]    [NE corner]

              [W pile]       [DRAW]      [E pile]

              [SW corner]    [S pile]    [SE corner]
```

- **Cardinal piles** (N, S, E, W): Start with a dealt card. Build down in alternating colors.
- **Corner piles** (NW, NE, SW, SE): Start empty. Only a **King** can start a corner pile. Then build down in alternating colors.

### Turn Structure

1. **Draw** one card from the draw pile
2. **Play** as many cards as you can/want from your hand:
   - Place a card on any pile if it's one rank lower and opposite color
   - Place a King on an empty corner position
   - **Move an entire pile** onto another pile if the bottom card of the source pile fits on the top card of the destination pile
   - After moving a pile, the empty cardinal spot can receive any card from your hand
3. **End turn** when you can't or don't want to play more

### Card Placement Rules

- Cards build **descending** in rank: K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2, A
- Cards must **alternate color**: red on black, black on red
- Only **Kings** can start a corner pile
- **Entire piles** can be moved if the bottom card of the moving pile fits on the top of the destination

### Winning

- First player to **empty their hand** wins
- If the draw pile runs out, players continue without drawing
- If no player can play and all have cards remaining, the player with the fewest cards wins

### Penalty Variant (Optional)

Some house rules impose a chip/point penalty if you can't play on your turn. This can be a configuration option.

---

## Game State Model

```typescript
interface KingsCornerGameState {
  roomId: string;
  players: KCPlayer[];
  activePlayerIndex: number;
  drawPile: Card[];
  piles: Record<PilePosition, Card[]>;  // each pile is a stack, top card is last element
  phase: KCPhase;
  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface KCPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  hasDrawn: boolean;   // whether they've drawn this turn
}

interface Card {
  rank: Rank;
  suit: Suit;
}

type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type PilePosition = 'N' | 'S' | 'E' | 'W' | 'NW' | 'NE' | 'SW' | 'SE';

type KCPhase =
  | 'drawing'       // must draw a card
  | 'playing'       // playing cards from hand
  | 'game-over';
```

### Player View

```typescript
interface KCPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardCount: number;    // hand size (hidden)
  }[];

  piles: Record<PilePosition, Card[]>;  // public - all piles visible
  drawPileCount: number;

  // Private
  myHand: Card[];
  myIndex: number;
  hasDrawn: boolean;

  activePlayerIndex: number;
  phase: KCPhase;
  availableMoves: KCMove[];   // pre-computed legal moves

  gameOver: boolean;
  winner: string | null;
}

type KCMove =
  | { type: 'play-card'; cardIndex: number; targetPile: PilePosition }
  | { type: 'move-pile'; fromPile: PilePosition; toPile: PilePosition }
  | { type: 'end-turn' }
  ;
```

### Actions

```typescript
type KCAction =
  | { type: 'draw' }
  | { type: 'play-card'; cardIndex: number; targetPile: PilePosition }
  | { type: 'move-pile'; fromPile: PilePosition; toPile: PilePosition }
  | { type: 'end-turn' }
  ;
```

---

## UI Specification

### Board Layout (Phone)

```
+------------------------------------+
|   [NW]       [N:9h]       [NE]    |
|                                    |
|   [W:Jc]     (42)       [E:5d]    |
|              draw                  |
|   [SW]       [S:3s]       [SE]    |
+------------------------------------+
| YOUR HAND (5 cards):               |
| [Kh] [8c] [7d] [4s] [2h]         |
|                                    |
| Drag a card to a pile, or:         |
| [End Turn]                         |
+------------------------------------+
```

- Piles show top card (tap to expand and see full stack)
- Empty corners shown as dotted outlines
- Draw pile shows card count
- Hand at bottom, scrollable if many cards
- Drag-and-drop or tap card then tap pile

### Card Interactions

- **Play from hand**: Tap card, then tap valid pile (highlighted)
- **Move pile**: Tap pile, then tap destination pile
- **King to corner**: Tap King, corner positions highlight
- **Draw**: Tap draw pile (required at turn start)

---

## Hidden Information

- Each player's hand is hidden from others
- Draw pile order is hidden
- All piles are public

Server-authoritative recommended (hands are hidden).

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Turn timer | Off / 30s / 60s | Off |
| Penalty for no plays | Off / -1 pt per turn | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators | Yes / No | Yes |

---

## Edge Cases

- **Draw pile empty**: Skip drawing, just play
- **No valid moves after drawing**: Must end turn (penalty if enabled)
- **Multiple pile moves in one turn**: Allowed, as many as possible
- **King drawn from pile**: Can immediately play to corner
- **All corners filled**: No more corner moves, only build on existing piles
- **Stalemate**: All players stuck with cards, fewest cards wins

---

## Testing Plan

### Unit Tests
- Card placement validation (rank, color alternation)
- King-only corner starts
- Pile movement validation
- Win detection (empty hand)
- Draw pile depletion
- Stalemate detection
- Full game simulation

### E2E Tests
- 3-player game flow
- Draw, play cards, move piles
- King to corner
- Win by emptying hand
