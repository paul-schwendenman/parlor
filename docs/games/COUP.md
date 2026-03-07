# Coup - Game Specification

## Overview

Coup is a bluffing and deduction game for 2-6 players. Each player has two hidden influence cards representing characters in a dystopian court. Players take actions (some requiring specific characters), and others can challenge or block. Lose both your influence cards and you're out. Last player standing wins.

Coup is a strong candidate for **Jackbox mode** (hidden hands on phones, public actions on shared screen) but also works in **peer mode**.

> **Note**: For Parlor, this game will need an original name and re-themed characters. See `docs/LEGAL.md`. Working title used here for clarity.

---

## Rules (Standard Published)

### Components

- **15 character cards**: 3 each of 5 characters (Duke, Assassin, Captain, Ambassador, Contessa)
- **Treasury**: Pool of coins (unlimited supply)
- Each player starts with **2 coins** and **2 face-down influence cards**

### Characters & Abilities

| Character | Action | Effect | Can Block |
|-----------|--------|--------|-----------|
| **Duke** | Tax | Take 3 coins from treasury | Blocks Foreign Aid |
| **Assassin** | Assassinate (costs 3) | Target loses 1 influence | - |
| **Captain** | Steal | Take 2 coins from target player | Blocks Steal |
| **Ambassador** | Exchange | Draw 2 from deck, return 2 | Blocks Steal |
| **Contessa** | - | (no action) | Blocks Assassination |

### Turn Structure

On your turn, you MUST take exactly one action:

#### General Actions (no character required)

| Action | Cost | Effect |
|--------|------|--------|
| **Income** | Free | Take 1 coin from treasury |
| **Foreign Aid** | Free | Take 2 coins from treasury (can be blocked by Duke) |
| **Coup** | 7 coins | Target loses 1 influence. Mandatory if you have 10+ coins. Cannot be blocked or challenged. |

#### Character Actions (claim the character)

| Action | Cost | Claimed Character | Effect |
|--------|------|-------------------|--------|
| **Tax** | Free | Duke | Take 3 coins |
| **Assassinate** | 3 coins | Assassin | Target loses 1 influence (can be blocked by Contessa) |
| **Steal** | Free | Captain | Take 2 coins from target (can be blocked by Captain or Ambassador) |
| **Exchange** | Free | Ambassador | Draw 2 cards from deck, choose 2 to keep, return 2 |

### Challenging

Any player can **challenge** another player's action or block claim:

- "I don't believe you have that character"
- **If the challenge is correct** (they were bluffing): The challenged player loses 1 influence
- **If the challenge is wrong** (they do have the character): The challenger loses 1 influence. The challenged player shuffles their revealed card into the deck and draws a new one.

### Blocking

Some actions can be blocked by claiming a character:

| Action | Can Be Blocked By |
|--------|-------------------|
| Foreign Aid | Duke |
| Assassination | Contessa |
| Steal | Captain or Ambassador |

Blocks can themselves be challenged ("I don't believe you have a Contessa").

### Losing Influence

When you lose influence, you choose one of your face-down cards and flip it face-up. It's now public and permanently revealed. When both cards are face-up, you're eliminated.

### Game End

Last player with at least one face-down card wins.

---

## Game State Model

### Server State

```typescript
interface CoupGameState {
  roomId: string;
  players: CoupPlayer[];
  deck: CharacterCard[];        // face-down draw pile
  treasury: number;             // unlimited, tracked for display
  activePlayerIndex: number;
  phase: CoupPhase;
  currentAction: PendingAction | null;
  currentBlock: PendingBlock | null;
  currentChallenge: PendingChallenge | null;
  eliminatedPlayers: string[];  // player IDs in elimination order
  round: number;
  gameOver: boolean;
  winner: string | null;
}

interface CoupPlayer {
  id: string;
  name: string;
  connected: boolean;
  coins: number;
  influences: Influence[];      // their 2 (or 1) cards
  eliminated: boolean;
}

interface Influence {
  character: CharacterCard;
  revealed: boolean;            // face-up = dead influence
}

type CharacterCard = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

type CoupPhase =
  | 'action-select'        // active player choosing an action
  | 'action-challenge'     // window for others to challenge the action
  | 'action-resolve'       // action resolving (e.g. ambassador exchange)
  | 'block-declare'        // target declaring a block
  | 'block-challenge'      // window for others to challenge the block
  | 'challenge-resolve'    // revealing card for challenge
  | 'lose-influence'       // a player must choose which influence to lose
  | 'game-over';

interface PendingAction {
  playerId: string;
  action: ActionType;
  targetId?: string;        // for assassinate, steal, coup
  claimedCharacter?: CharacterCard;
}

interface PendingBlock {
  blockerId: string;
  claimedCharacter: CharacterCard;
  blockingAction: ActionType;
}

interface PendingChallenge {
  challengerId: string;
  targetId: string;          // who is being challenged
  claimedCharacter: CharacterCard;
}

type ActionType =
  | 'income'
  | 'foreign-aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';
```

### Player View

```typescript
interface CoupPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    coins: number;
    influenceCount: number;       // how many face-down cards they have
    revealedInfluences: CharacterCard[];  // face-up cards (public)
    eliminated: boolean;
  }[];

  // Private to this player
  myInfluences: Influence[];       // can see own face-down cards
  myCoins: number;

  // Game state
  activePlayerIndex: number;
  phase: CoupPhase;
  currentAction: PendingAction | null;
  currentBlock: PendingBlock | null;
  currentChallenge: PendingChallenge | null;
  availableActions: ActionType[];  // pre-computed legal actions for this player

  // For exchange phase
  exchangeCards?: CharacterCard[]; // only sent to the exchanging player

  // For lose-influence phase
  mustLoseInfluence: boolean;      // true if this player must choose a card to lose

  round: number;
  gameOver: boolean;
  winner: string | null;
  eliminationOrder: string[];
}
```

### Actions (Client to Server)

```typescript
type CoupAction =
  | { type: 'action'; action: ActionType; targetId?: string }
  | { type: 'challenge' }
  | { type: 'pass-challenge' }           // decline to challenge
  | { type: 'block'; character: CharacterCard }
  | { type: 'pass-block' }               // decline to block
  | { type: 'lose-influence'; index: number }  // choose which card to lose
  | { type: 'exchange-return'; indices: number[] }  // return cards during exchange
  ;
```

---

## Turn Flow (Detailed)

```
1. Phase: 'action-select'
   - Active player must choose an action
   - If they have 10+ coins, they MUST coup
   - UI shows available actions with costs and targets

2. Action declared:
   - Income: resolves immediately (no challenge/block possible)
   - Coup: resolves immediately (target enters lose-influence phase)
   - Foreign Aid: enters block-declare phase (anyone can claim Duke to block)
   - Tax/Assassinate/Steal/Exchange: enters action-challenge phase

3. Phase: 'action-challenge' (timed window, ~10s)
   - Any player can challenge the action claim
   - If no challenge, proceed to block-declare (if blockable) or action-resolve
   - If challenged: enter challenge-resolve

4. Phase: 'challenge-resolve'
   - Challenged player reveals (or doesn't have) the claimed character
   - If bluffing: they lose influence, action fails
   - If truthful: challenger loses influence, card is swapped, action proceeds

5. Phase: 'block-declare' (timed window, ~10s)
   - Relevant players can declare a block
   - If no block, action resolves
   - If blocked: enter block-challenge phase

6. Phase: 'block-challenge' (timed window, ~10s)
   - Any player can challenge the block
   - If no challenge: block succeeds, action is cancelled
   - If challenged: resolve the challenge (same as step 4 but for the blocker)

7. Phase: 'action-resolve'
   - Apply the action's effect
   - Tax: +3 coins
   - Steal: transfer 2 coins (or all if target has < 2)
   - Assassinate: target enters lose-influence
   - Exchange: send 2 deck cards to active player, they choose 2 to keep

8. Phase: 'lose-influence'
   - Player chooses which face-down card to reveal
   - If both revealed: player is eliminated
   - Check for game end (1 player remaining)

9. Advance to next non-eliminated player, go to step 1
```

---

## Challenge/Block Timing

This is the trickiest part of Coup's UX. In person, challenges and blocks happen through social dynamics. Online, we need explicit windows.

### Approach: Timed Windows with Early Close

- When a challengeable/blockable action occurs, a timer starts (default ~10s)
- All eligible players see "Challenge" and/or "Pass" buttons
- Timer closes early if all eligible players have responded
- If anyone challenges, the timer stops and challenge resolves
- Visual countdown for urgency

### Who Can Challenge/Block

| Phase | Who Can Challenge | Who Can Block |
|-------|-------------------|---------------|
| Action declared | Any other player | - |
| Block on Foreign Aid | - | Any player (claim Duke) |
| Block on Assassination | - | Target only (claim Contessa) |
| Block on Steal | - | Target only (claim Captain/Ambassador) |
| Block declared | Any other player (including original actor) | - |

---

## UI Specification

### Display Modes

#### Peer Mode (Everyone on own device)

Each player sees:
- Their own hand (face-down cards visible to them)
- All players' public info (coins, revealed cards, eliminated status)
- Action log showing what's happening
- Action buttons when it's their turn or they can challenge/block

#### Jackbox Mode (Shared screen + phones)

**Host screen** shows:
- All players arranged in a circle/row
- Coins and revealed cards for each player
- Current action being declared
- Challenge/block timer countdown
- Action log / game narrative

**Phone controller** shows:
- Your hidden cards
- Action buttons (on your turn)
- Challenge/Block/Pass buttons (during windows)
- Minimal - just what you need to act

### Player Display

```
+------------------+
| Alice (4 coins)  |
| [??] [Duke]      |  <- one hidden, one revealed
+------------------+
```

- Hidden cards shown as card backs to other players
- Revealed (dead) cards shown face-up with the character
- Eliminated players shown grayed out
- Active player highlighted

### Action Selection (Active Player's Turn)

```
+----------------------------------------+
| Your turn! Choose an action:           |
|                                        |
| [Income]  +1 coin                      |
| [Foreign Aid]  +2 coins (blockable)    |
| [Tax]  +3 coins (claim Duke)           |
| [Steal from ▼]  (claim Captain)        |
| [Assassinate ▼]  3 coins (claim Assassin) |
| [Exchange]  (claim Ambassador)         |
| [Coup ▼]  7 coins (unblockable)       |
+----------------------------------------+
```

- Actions requiring a target show a player selector
- Unaffordable actions are disabled
- Mandatory coup (10+ coins) disables all other options

### Challenge/Block Window

```
+----------------------------------------+
| Alice claims DUKE to take Tax (+3)     |
|                                        |
| [Challenge!]  [Let it go]             |
|                                        |
| ████████░░  8s remaining               |
+----------------------------------------+
```

### Action Log

```
Round 3:
  Alice takes Income (+1 coin)
  Bob claims Duke, takes Tax (+3 coins)
  Charlie steals from Alice (claims Captain)
    Alice challenges! Charlie reveals Captain.
    Alice loses influence (reveals Contessa).
    Charlie draws a new card.
  ...
```

A clear action log is essential since Coup's gameplay is heavily about reading past actions.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Challenge timer | 5s / 10s / 15s / 20s | 10s |
| Display mode | Peer / Jackbox | Peer |
| Spectators allowed | Yes / No | Yes |
| Turn timer | Off / 30s / 60s | Off |

---

## Hidden Information Handling

Coup has significant hidden information. Security considerations:

- **Server never sends hidden cards to other players** - each player's view only includes their own face-down cards
- **Deck contents are never revealed** to any client
- **Exchange cards** are only sent to the exchanging player
- **Challenge resolution**: server reveals the card, applies the result, then reshuffles if needed - clients don't see the new card drawn

This makes Coup a strong candidate for **server-authoritative** state management. The consensus model would need a commit-reveal scheme for hidden cards, adding significant complexity.

---

## Edge Cases

### Assassination + Block + Challenge

The most complex interaction:
1. Alice assassinates Bob (pays 3 coins)
2. Bob blocks (claims Contessa)
3. Alice challenges the block
4. Bob doesn't have Contessa - Bob loses influence from the failed block
5. Assassination also resolves - Bob loses another influence (if they have one)
6. Result: Bob could lose both influences in one turn

If Bob DID have Contessa:
1. Alice loses influence for the failed challenge
2. Block stands, assassination fails
3. Alice already paid the 3 coins (they're gone)

### Steal from Player with 0-1 Coins

- If target has 0 coins: steal does nothing (but you can still do it to bluff Captain)
- If target has 1 coin: steal takes 1 coin (not 2)

### Exchange When Deck is Low

- If deck has < 2 cards, draw whatever is available
- Player still returns the same number they drew

### Disconnect During Challenge Window

- Disconnected player auto-passes on challenges and blocks
- If the disconnected player IS the one being challenged, they auto-lose (treated as not having the card)
- Reconnecting player gets current state

### 2-Player Rules

Standard Coup plays fine with 2 players but is more aggressive. No special rule changes needed.

---

## Re-theming Notes

For the Parlor implementation, rename:

| Original | Suggested Direction |
|----------|-------------------|
| Coup | Political/court intrigue theme, or something entirely different |
| Duke | A character who collects wealth |
| Assassin | A character who eliminates |
| Captain | A character who steals |
| Ambassador | A character who trades/swaps |
| Contessa | A character who protects |

The mechanical abilities stay identical. Only names, art, and flavor change.

---

## Testing Plan

### Unit Tests (Vitest)

- Action validation (can afford assassination, must coup at 10+)
- Challenge resolution (bluff caught, truthful revealed, card swap)
- Block validation (correct character for the action being blocked)
- Influence loss and elimination
- Turn order with eliminated players skipped
- Steal edge cases (0-1 coins)
- Exchange card selection and return
- Game end detection (1 player remaining)
- Full game simulation

### E2E Tests (Playwright)

- 3-player game: create lobby, join, start
- Take income, foreign aid, and character actions
- Challenge flow: challenge a bluff, challenge a truth
- Block flow: block an action, challenge a block
- Play to elimination
- Reconnection during challenge window
