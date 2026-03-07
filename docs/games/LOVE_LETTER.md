# Love Letter - Game Specification

## Overview

Love Letter is a quick deduction card game for 2-6 players. Players draw and play cards from a tiny 21-card deck, trying to either eliminate all other players or hold the highest-valued card when the deck runs out. Rounds are fast (5-10 minutes), and multiple rounds are played to a target score.

Love Letter works well in both **peer mode** and **Jackbox mode**. The hidden information is minimal (just one card in hand).

> **Note**: For Parlor, this game will need an original name and re-themed characters. See `docs/LEGAL.md`. Working title used here for clarity.

---

## Rules (Standard Published, 2-6 Player Edition)

### Components

**21 cards** with values 0-9:

| Value | Character | Count | Ability |
|-------|-----------|-------|---------|
| 0 | **Spy** | 2 | If you're the only player who played/discarded a Spy, gain 1 token at round end |
| 1 | **Guard** | 6 | Name a non-Guard card. If target has it, they're eliminated |
| 2 | **Priest** | 2 | Look at another player's hand |
| 3 | **Baron** | 2 | Compare hands with a player. Lower value is eliminated |
| 4 | **Handmaid** | 2 | You cannot be targeted until your next turn |
| 5 | **Prince** | 2 | Target player (can be yourself) discards their hand and draws a new card |
| 6 | **Chancellor** | 2 | Draw 2 cards, keep 1, put 2 on bottom of deck |
| 7 | **King** | 1 | Trade hands with another player |
| 8 | **Countess** | 1 | Must be played if you also hold King or Prince |
| 9 | **Princess** | 1 | If you discard this (for any reason), you're eliminated |

### Setup

1. Shuffle the deck
2. Remove the top card face-down (unseen by anyone) - this prevents perfect deduction
3. Each player draws 1 card
4. Youngest player goes first (in digital: random or host)

### Turn Structure

1. **Draw** a card from the deck (you now have 2 cards)
2. **Play** one of your 2 cards face-up in front of you (your discard pile is public)
3. **Resolve** the played card's ability
4. Next player's turn

### Forced Play Rule

- If you hold the **Countess** (8) along with the **King** (7) or **Prince** (5), you MUST play the Countess

### Elimination

A player is eliminated when:
- A Guard correctly guesses their card
- They lose a Baron comparison
- They discard the Princess (for any reason, including being forced by Prince)
- They cannot draw when required (deck is empty and they must draw)

Eliminated players reveal their hand and are out for the rest of the round.

### Round End

The round ends when:
- Only one player remains (they win the round)
- The deck runs out - the remaining player(s) with the **highest card value** wins

### Spy Bonus

At round end, if exactly one remaining player played or discarded a Spy during the round, that player gains 1 bonus token (in addition to any round win token).

### Winning the Game

- Players play multiple rounds
- Each round win = 1 token
- **Target tokens to win** (by player count):
  - 2 players: 6 tokens
  - 3 players: 5 tokens
  - 4 players: 4 tokens
  - 5 players: 3 tokens
  - 6 players: 3 tokens
- First player to reach the target wins the game

---

## Game State Model

### Server State

```typescript
interface LoveLetterGameState {
  roomId: string;
  players: LoveLetterPlayer[];
  deck: number[];                // card values remaining in draw pile
  removedCard: number;           // the card removed at start (hidden from all)
  activePlayerIndex: number;
  phase: LoveLetterPhase;
  round: number;
  roundOver: boolean;
  gameOver: boolean;
  winner: string | null;
  targetTokens: number;          // tokens needed to win (based on player count)
  pendingEffect: PendingEffect | null;
}

interface LoveLetterPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: number[];               // current card(s) in hand (usually 1, 2 during turn)
  discards: number[];           // played cards (public, in order)
  eliminated: boolean;
  protected: boolean;           // handmaid protection active
  tokens: number;               // round wins
  playedSpy: boolean;           // whether they played/discarded a spy this round
}

type LoveLetterPhase =
  | 'draw'              // active player about to draw
  | 'play'              // active player choosing a card to play
  | 'resolve-effect'    // resolving card ability (e.g. guard guess, baron compare)
  | 'round-over'        // showing round results
  | 'game-over';

type PendingEffect =
  | { type: 'guard-guess'; targetId: string }           // must guess a card
  | { type: 'priest-reveal'; targetId: string }         // seeing target's card
  | { type: 'baron-compare'; targetId: string }         // comparing hands
  | { type: 'prince-discard'; targetId: string }        // target discards and draws
  | { type: 'chancellor-choose'; drawnCards: number[] } // choose 1 of 3, return 2
  | { type: 'king-trade'; targetId: string }            // swap hands
  ;
```

### Player View

```typescript
interface LoveLetterPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardCount: number;          // how many cards in hand (0 if eliminated)
    discards: number[];         // public played cards
    eliminated: boolean;
    protected: boolean;
    tokens: number;
  }[];

  // Private
  myHand: number[];             // my current card(s)
  myIndex: number;

  // Game state
  activePlayerIndex: number;
  phase: LoveLetterPhase;
  deckRemaining: number;        // how many cards left in deck
  round: number;
  targetTokens: number;

  // Effect resolution
  pendingEffect: PlayerPendingEffect | null;
  mustPlayCountess: boolean;    // forced to play countess

  // Round end info
  roundWinner: string | null;
  roundResults: RoundResult[] | null;

  gameOver: boolean;
  winner: string | null;
}

interface RoundResult {
  playerId: string;
  finalCard: number | null;     // revealed at round end
  tokensGained: number;
}

// Priest reveal is only sent to the player who played it
interface PlayerPendingEffect {
  type: string;
  targetId?: string;
  revealedCard?: number;        // only for priest (your eyes only)
  chancellorOptions?: number[]; // only for chancellor (your eyes only)
}
```

### Actions (Client to Server)

```typescript
type LoveLetterAction =
  | { type: 'play-card'; cardIndex: number; targetId?: string }
  | { type: 'guard-guess'; cardValue: number }           // guess target's card (1-9, not 0 or 1)
  | { type: 'chancellor-keep'; keepIndex: number }        // which of 3 cards to keep
  ;
```

---

## Turn Flow (Detailed)

```
1. Phase: 'draw'
   - Active player draws a card from deck
   - They now have 2 cards in hand
   - If deck is empty, round ends instead

2. Phase: 'play'
   - Check for forced Countess play (holding 8 + 7 or 8 + 5)
   - Player selects one of their 2 cards to play
   - Card goes to their public discard pile
   - If playing a targeted card, select a target (non-eliminated, non-protected players)

3. Phase: 'resolve-effect'
   - Apply the played card's ability:

   Spy (0): No immediate effect. Mark that this player played a spy.

   Guard (1): Choose a target, then guess a card value (2-9).
     If correct: target is eliminated.
     If wrong: nothing happens.

   Priest (2): Look at target's hand.
     Privately reveal target's card to the playing player.

   Baron (3): Compare hands with target.
     Lower value is eliminated. Tie = nothing.

   Handmaid (4): Player is protected until their next turn.
     Cannot be targeted by any card.

   Prince (5): Target (or self) discards their hand and draws a new card.
     If they discard the Princess, they're eliminated.
     If deck is empty, they draw the removed card.

   Chancellor (6): Draw 2 cards from deck (now have 3).
     Choose 1 to keep, put 2 on bottom of deck.
     If deck has < 2 cards, draw what's available.

   King (7): Trade hands with target.

   Countess (8): No effect (just played as a card).

   Princess (9): Player is eliminated immediately.

4. Check round end:
   - Only 1 player remaining? They win the round.
   - Deck empty after this turn? Highest card wins.
   - Check spy bonus.

5. Award token(s), check for game winner.
   - If no game winner, start new round.
   - Otherwise, game over.
```

---

## Targeting Rules

When playing a targeted card, valid targets are:
- Not yourself (except Prince, which CAN target yourself)
- Not eliminated
- Not protected by Handmaid

**If all other players are protected by Handmaid**: The card is played with no target and no effect (it's "wasted"). Exception: Prince can target yourself.

---

## UI Specification

### Hand Display (Phone)

```
+-------------------------------------------+
| Your hand:                                |
|                                           |
|  +--------+    +--------+                 |
|  |   3    |    |   7    |                 |
|  | Baron  |    |  King  |                 |
|  |        |    |        |                 |
|  | Compare|    | Trade  |                 |
|  | hands  |    | hands  |                 |
|  +--------+    +--------+                 |
|                                           |
|  Tap a card to play it                    |
+-------------------------------------------+
```

- Cards shown large enough to read on phone
- Card ability summarized on the card face
- Tapping a card selects it, then shows target selection if needed
- Forced Countess highlighted/auto-selected

### Player Status Row

```
Alice (2 tokens) - [Guard] [Priest] [Baron] - Protected
Bob (1 token) - [Guard] - ELIMINATED
You (1 token) - [Spy]
Charlie (3 tokens) - (no discards yet)
```

- Discarded cards shown as a row of small face-up cards
- Eliminated players grayed out / crossed
- Protected players have a shield indicator
- Token count visible

### Guard Guess UI

```
+-------------------------------------------+
| You played Guard targeting Charlie.       |
| Guess their card:                         |
|                                           |
| [Priest 2] [Baron 3] [Handmaid 4]       |
| [Prince 5] [Chancellor 6] [King 7]      |
| [Countess 8] [Princess 9]               |
|                                           |
| (Cannot guess Guard or Spy)              |
+-------------------------------------------+
```

### Priest Reveal (Private)

```
+-------------------------------------------+
| You peeked at Charlie's hand:            |
|                                           |
|  +--------+                               |
|  |   5    |                               |
|  | Prince |                               |
|  +--------+                               |
|                                           |
| Only you can see this. Remember it!       |
| [Got it]                                  |
+-------------------------------------------+
```

### Baron Compare

```
+-------------------------------------------+
| Baron comparison with Charlie:            |
|                                           |
| You: Baron (3) vs Charlie: Prince (5)    |
|                                           |
| Charlie wins! You are eliminated.         |
+-------------------------------------------+
```

### Round End

```
+-------------------------------------------+
| ROUND 4 OVER - Deck empty!              |
|                                           |
| Alice: King (7) - WINNER (+1 token)     |
| You: Prince (5)                          |
| Charlie: Baron (3)                       |
|                                           |
| Spy bonus: Charlie (+1 token)           |
| (only player who played a Spy)           |
|                                           |
| Scores: Alice 3, Charlie 3, You 2       |
| Target: 5 tokens                         |
|                                           |
| [Next Round]                              |
+-------------------------------------------+
```

### Jackbox Host Screen

- All players shown with their discard piles
- Current action animated in the center ("Alice plays Guard on Bob!")
- Card count indicators (how many cards left in deck)
- Token scoreboard
- No hidden information displayed on host screen

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Target tokens | Auto (by player count) / Custom (1-10) | Auto |
| Turn timer | Off / 15s / 30s | Off |
| Display mode | Peer / Jackbox | Peer |
| Spectators allowed | Yes / No | Yes |

---

## Hidden Information

- Each player's hand is hidden (only 1 card, or 2 during their draw phase)
- The removed card at game start is hidden from everyone
- Priest reveals are private to the player who played it
- All discards are public and ordered (deduction element)
- Deck count is public

**State authority**: Server-authoritative is strongly recommended. Hidden cards must never leak to other clients.

---

## Edge Cases

### Prince Forcing Princess Discard

- If a player is hit by Prince and holds the Princess, they must discard it and are eliminated
- This is one of the strongest plays in the game

### Chancellor with Near-Empty Deck

- If deck has 1 card: draw 1, choose 1 of 2 to keep, put 1 on bottom
- If deck has 0 cards: no draw, Chancellor has no effect

### Prince with Empty Deck

- Target discards their card and draws the removed card (the one set aside at game start)

### All Other Players Protected

- If you play a targeted card (Guard, Priest, Baron, King) and all other players are protected by Handmaid, the card is played with no effect
- Prince can always target yourself as a fallback

### Tie in Baron Comparison

- Both players survive, nothing happens

### Multiple Spies

- Spy bonus only triggers if exactly ONE surviving player played/discarded a Spy
- If multiple surviving players played Spies, no one gets the bonus

### 2-Player Variant

- Standard rules work fine with 2 players
- Game is more tactical with full information deduction from discards

---

## Re-theming Notes

Love Letter has been officially re-themed many times (Batman, Star Wars, Lovecraft, etc.), proving the mechanics are fully separable from the theme.

| Original | Direction |
|----------|-----------|
| Love Letter | Any theme - palace intrigue, heist crew, space station, etc. |
| Guard through Princess | Characters fitting your chosen theme, ordered by "power" 0-9 |

The mechanical abilities stay identical. The theme can be completely different.

---

## Testing Plan

### Unit Tests (Vitest)

- Card ability resolution for all 10 card types
- Guard: correct guess eliminates, wrong guess doesn't
- Baron: higher wins, tie does nothing
- Prince: discard and draw, Princess elimination
- Chancellor: card selection and deck placement
- Countess forced play detection
- Handmaid protection (can't be targeted)
- Spy bonus calculation (exactly one player)
- Targeting validation (not eliminated, not protected, self-target rules)
- Round end: last player standing vs. highest card
- Token counting and game win detection
- Full round simulation
- Full multi-round game simulation

### E2E Tests (Playwright)

- 3-player game: create, join, play a round
- Guard guess flow
- Baron comparison display
- Priest private reveal (verify other players can't see)
- Play to round end, verify token award
- Play to game end
- Reconnection mid-round
