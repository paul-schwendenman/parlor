# The Mind - Game Specification

## Overview

The Mind is a cooperative card game for 2-4 players. Players hold numbered cards (1-100) and must play them in ascending order onto a single pile - **without communicating**. No talking, no signals, no turns. You just... feel when it's right to play. It's tense, meditative, and weirdly magical when it works.

This is a fascinating game to bring online. The "no communication" rule is naturally enforced since players can't see each other (unless on a video call). Works in **peer mode** - each player sees their hand and the pile.

> **Note**: "The Mind" is trademarked by NSV. Parlor needs an original name. The mechanic is simple enough to be generic. See `docs/LEGAL.md`.

---

## Rules

### Components

- **100 cards** numbered 1-100
- **Lives** (shared by team): Start with number based on player count
- **Throwing Stars** (shared): Used to discard everyone's lowest card

### Setup by Player Count

| Players | Cards per Player (Level 1) | Starting Lives | Starting Stars |
|---------|---------------------------|----------------|----------------|
| 2 | 1 | 2 | 1 |
| 3 | 1 | 3 | 1 |
| 4 | 1 | 4 | 1 |

Cards per player increase by 1 each level (level 2 = 2 cards each, level 3 = 3, etc.).

### Level Structure

- **Level N**: Each player is dealt N cards
- Players must play all their cards onto a central pile in ascending order
- Complete the level = advance to the next
- The game has as many levels as there are players times some factor... actually:

**Standard game length**: 12 levels for 2 players, 10 for 3, 8 for 4.

| Players | Total Levels |
|---------|-------------|
| 2 | 12 |
| 3 | 10 |
| 4 | 8 |

### Gameplay

There are **no turns**. At any moment, any player can play their lowest card onto the pile.

The only rule: **cards must be played in ascending order**.

Players may NOT:
- Talk
- Show their cards
- Signal in any way
- Indicate how high or low their cards are

Players MAY:
- Stare at each other (in person)
- Concentrate
- Feel the vibe

If someone plays a card and another player holds a **lower card**: That's a mistake. Every card lower than the played card is discarded and the team **loses a life**.

### Throwing Stars

Any player can propose using a throwing star by raising their hand (in person). If everyone agrees:
- 1 throwing star is spent
- Each player discards their **lowest card** (face up, so everyone sees)
- This gives information and clears dangerous low cards

**Digital equivalent**: Any player can request a star. All players must confirm.

### Rewards

At certain levels, the team earns rewards:
- **Extra life**: Awarded at specific levels (varies by player count)
- **Extra throwing star**: Awarded at specific levels

Standard reward schedule:

| Players | Life at levels | Star at levels |
|---------|---------------|----------------|
| 2 | 3, 6, 9 | 2, 5, 8 |
| 3 | 2, 3, 5, 6, 8, 9 | Actually, simplified: earn a life at levels 3,6,9 and a star at 2,5,8 for 2p |

The exact reward schedule varies by edition. A simplified version:
- Earn a **life** every 3 levels
- Earn a **star** every 4 levels
- Capped at max lives (based on player count) and max stars (3)

### Game End

- **Win**: Complete all levels
- **Lose**: Run out of lives

---

## Game State Model

```typescript
interface TheMindGameState {
  roomId: string;
  players: TheMindPlayer[];
  pile: number[];                  // cards played to the pile (in order)
  topCard: number;                 // highest card on pile (0 if empty)
  lives: number;
  maxLives: number;
  throwingStars: number;
  level: number;
  totalLevels: number;
  phase: TheMindPhase;
  starRequest: StarRequest | null;
  gameOver: boolean;
  won: boolean;
}

interface TheMindPlayer {
  id: string;
  name: string;
  connected: boolean;
  hand: number[];                  // their remaining cards (sorted ascending)
  cardsPlayed: number;             // how many they've played this level
}

interface StarRequest {
  requesterId: string;
  confirmations: string[];         // player IDs who agreed
  allConfirmed: boolean;
}

type TheMindPhase =
  | 'focus'             // brief concentration moment before level starts
  | 'playing'           // the main phase - anyone can play anytime
  | 'mistake'           // a card was played out of order, showing the error
  | 'star-request'      // someone wants to use a throwing star
  | 'level-complete'    // all cards played successfully
  | 'level-failed'      // lost a life but have more
  | 'game-won'
  | 'game-lost';
```

### Player View

```typescript
interface TheMindPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    cardsRemaining: number;        // how many cards they still hold (not what)
  }[];

  // Private
  myHand: number[];                // my remaining cards

  // Shared state
  topCard: number;                 // last card played (what everyone sees)
  lives: number;
  maxLives: number;
  throwingStars: number;
  level: number;
  totalLevels: number;
  phase: TheMindPhase;

  // Star request
  starRequest: {
    requesterName: string;
    waitingFor: string[];          // player names who haven't confirmed
  } | null;

  // Mistake info
  mistake: {
    playedCard: number;
    playerName: string;
    lowerCards: { playerName: string; card: number }[];  // cards that were skipped
  } | null;

  gameOver: boolean;
  won: boolean;
}
```

### Actions

```typescript
type TheMindAction =
  | { type: 'play-card' }                    // play your lowest card
  | { type: 'request-star' }                 // propose using a throwing star
  | { type: 'confirm-star' }                 // agree to use star
  | { type: 'deny-star' }                    // decline star usage
  | { type: 'ready' }                        // ready for next level / continue
  ;
```

Note: Players always play their **lowest** card. No choice needed - just "play" or "wait."

---

## Turn Flow

```
1. Phase: 'focus'
   - Brief moment (3-5 seconds) where all players "concentrate"
   - Shows level number and cards-per-player
   - All players press "ready" or it auto-advances

2. Phase: 'playing'
   - No turns! Anyone can play at any time.
   - Each player has a [PLAY] button that plays their lowest card
   - When a card is played:
     a. Check if any player holds a lower card
     b. If yes: MISTAKE - those lower cards are discarded, lose 1 life
     c. If no: card is added to pile successfully
   - Star request can happen anytime (pauses play)

3. If mistake:
   Phase: 'mistake'
   - Show what went wrong (who had lower cards)
   - Discard the lower cards
   - Lose 1 life
   - If lives remain: continue playing (go to step 2)
   - If no lives: Phase: 'game-lost'

4. Phase: 'star-request'
   - Play pauses
   - All players vote to use star or not
   - If all agree: each player's lowest card is discarded (shown to all)
   - Resume playing

5. When all cards played:
   Phase: 'level-complete'
   - Award any earned lives/stars
   - Next level: deal more cards
   - Go to step 1

6. If all levels completed:
   Phase: 'game-won' - celebration!
```

---

## The Timing Challenge (Digital)

The core magic of The Mind is the timing - the shared sense of "now" that emerges between players. Digitally, this is challenging because:

- **Network latency**: If two players play "simultaneously," server sees them at slightly different times
- **No physical presence**: Can't read body language or feel the tension

### Approach: Server Timestamps

- When a player plays, the server records the timestamp
- If two plays arrive within a small window (~200ms), treat as simultaneous
- For simultaneous plays: the lower card goes first (it was "more correct")
- This is generous and keeps the game fun

### Approach: The Pause

- Before playing, a player can see the time elapsed since the last card
- A subtle visual indicator shows "time pressure" building
- This replaces the human intuition of "it's been long enough"

### Optional: Concentration Visualization

- Show a subtle ambient animation that all players see in sync
- Could be a slowly filling bar, a pulsing circle, or a breathing animation
- Gives players a shared rhythm to lock onto

---

## UI Specification

### Phone Layout

```
+----------------------------+
| THE MIND      Level 5      |
| Lives: ** *   Stars: *     |
+----------------------------+
|                            |
|      Pile: [47]            |
|                            |
|  Alice: 2 cards            |
|  Bob: 3 cards              |
|  You: 3 cards              |
+----------------------------+
|                            |
|  Your lowest card: 52      |
|                            |
|  [    PLAY    ]            |
|                            |
|  [Request Star]            |
+----------------------------+
```

- Top card of pile shown large and prominent
- Your lowest card shown (that's the only one you'd play)
- Big PLAY button
- Other players' card counts visible
- Lives and stars shown as icons

### Mistake Display

```
+----------------------------+
| MISTAKE!                   |
|                            |
| You played: 52             |
| But Alice had: 49, 51     |
|                            |
| Cards discarded.           |
| Lives remaining: 2         |
|                            |
| [Continue]                 |
+----------------------------+
```

### Level Complete

```
+----------------------------+
| LEVEL 5 COMPLETE!          |
|                            |
| All 15 cards played!       |
|                            |
| Bonus: +1 Life             |
|                            |
| Next: Level 6 (6 cards each)|
| [Ready]                    |
+----------------------------+
```

### Game Won

```
+----------------------------+
|                            |
|     YOU ARE IN SYNC        |
|                            |
|  All 8 levels completed!   |
|  Lives remaining: 1        |
|                            |
|  [Play Again]              |
+----------------------------+
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Starting lives | By player count / Custom (1-5) | By player count |
| Starting stars | 1 / 2 / 3 | 1 |
| Levels | Standard / Short (half) / Endless | Standard |
| Focus time | 3s / 5s / 10s | 5s |
| Display mode | Peer | Peer |
| Spectators | Yes / No | Yes |

---

## Hidden Information

- Each player's hand is completely hidden from all other players
- That's the entire game - you know nothing about others' cards
- The only shared information: top card on pile, cards remaining per player

Server-authoritative required.

---

## Edge Cases

- **Simultaneous plays**: Two players play within ~200ms. Lower card goes first. If both are valid (both > top card), both succeed. If the higher one would have been a mistake, only check after the lower one resolves.
- **Star with 0 cards**: If a player has 0 remaining cards, they auto-agree to star and discard nothing.
- **Star denied**: If any player denies, star is not used. Play resumes.
- **1 card each (Level 1)**: Quick level. Just need to play in order. Star is very powerful here (reveals your only card).
- **Disconnection**: Critical in a timing game. Auto-play their lowest card after a timeout? Or pause and wait for reconnect?
- **Card 1 and Card 100**: Card 1 should always be played immediately (nothing lower). Card 100 should always be played last (nothing higher). Test if players know this.

---

## Re-theming Notes

The Mind is almost theme-less already. It's about synchronicity and connection.

| Original | Direction |
|----------|-----------|
| The Mind | The Flow, Wavelength, In Sync, Pulse, etc. |
| Cards 1-100 | Just numbers. No re-theme needed. |

---

## Testing Plan

### Unit Tests
- Mistake detection (played card > lowest other player's card)
- Multiple lower cards discarded correctly
- Life loss on mistake
- Star usage: all confirm, discard lowest per player
- Level progression: correct cards per player
- Reward schedule: life/star at correct levels
- Win/loss detection
- Simultaneous play resolution

### E2E Tests
- 3-player game, level 1 through completion
- Mistake scenario: play out of order
- Star request and confirmation flow
- Level complete with reward
- Game over (win and lose)
- Timing: two players play near-simultaneously
