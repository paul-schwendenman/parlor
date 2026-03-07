# Bang! The Dice Game - Game Specification

## Overview

Bang! The Dice Game is a hidden-role dice game for 3-8 players set in the Wild West. Players roll dice Yahtzee-style (up to 3 rolls, keeping some), dealing damage, healing, or triggering special effects. Each player has a secret role (Sheriff, Deputy, Outlaw, Renegade) and a character with a unique ability. The goal depends on your role.

Works well in **peer mode** (hidden roles on phones) and potentially **Jackbox mode** (public board on screen, roles on phones).

> **Note**: "Bang!" is trademarked by dV Giochi. Parlor needs an original name and re-themed roles/characters. See `docs/LEGAL.md`.

---

## Rules (Standard)

### Roles & Win Conditions

| Role | Count (by player count) | Win Condition |
|------|------------------------|---------------|
| **Sheriff** | Always 1 | Eliminate all Outlaws and Renegade |
| **Deputy** | 0-2 (scales with players) | Sheriff survives (same as Sheriff) |
| **Outlaw** | 2-3 (scales with players) | Eliminate the Sheriff |
| **Renegade** | 1 | Be the last player alive |

Role distribution by player count:

| Players | Sheriff | Deputy | Outlaw | Renegade |
|---------|---------|--------|--------|----------|
| 3 | 1 | 0 | 2 | 0 (use 1 Renegade instead of 1 Outlaw) |
| 4 | 1 | 0 | 2 | 1 |
| 5 | 1 | 1 | 2 | 1 |
| 6 | 1 | 1 | 3 | 1 |
| 7 | 1 | 2 | 3 | 1 |
| 8 | 1 | 2 | 3 | 2 |

**The Sheriff's identity is public.** All other roles are hidden.

### Characters

Each player gets a random character with a unique ability and a specific number of life points (typically 6-9, Sheriff gets +2). There are 16 characters in the base game. Examples:

| Character | Life | Ability |
|-----------|------|---------|
| Bart Cassidy | 8 | Each time he loses a life point, he draws an arrow and immediately removes it |
| Black Jack | 8 | At the start of each turn, may re-roll Dynamite results |
| Calamity Janet | 8 | Can use 1s and 2s interchangeably for shooting |
| El Gringo | 7 | If another player makes him lose life points, that player takes an arrow |
| Jesse Jones | 9 | May choose which player takes the arrows he would take |
| Paul Regret | 9 | Players need to roll two 1s or two 2s to hit him |
| ... | ... | ... |

### Components

- **5 dice** with 6 faces each:
  - **1** (target): Shoot player 1 seat away
  - **2** (target): Shoot player 2 seats away
  - **Arrow**: Take an arrow token; if all arrows taken, Indian Attack
  - **Dynamite**: Cannot be re-rolled; 3 dynamites = lose 1 life, turn ends
  - **Beer**: Heal 1 life point (to another player or yourself)
  - **Gatling Gun**: 3 or more = deal 1 damage to ALL other players + discard all your arrows

- **9 arrow tokens** (shared pool)

### Turn Structure

#### 1. Roll Phase (Up to 3 rolls)

1. Roll all 5 dice
2. **Arrows are locked immediately** - take an arrow token for each arrow rolled, cannot re-roll arrows
3. **Dynamite are locked** - cannot re-roll dynamite
4. Keep any other dice you want, re-roll the rest
5. Repeat up to 2 more times (3 total rolls)
6. If you roll **3 dynamite** at any point: lose 1 life, turn ends immediately (don't resolve other dice)

#### 2. Resolution Phase

After final roll, resolve dice in this order:
1. **Arrows**: Already resolved during rolling
2. **Dynamite**: Already checked (3 = explode)
3. **Gatling**: If 3+ gatling faces, deal 1 damage to all other players and discard all your arrows
4. **1s and 2s**: Deal 1 damage to each target at that distance (clockwise and counter-clockwise)
5. **Beer**: Heal 1 life per beer (can heal self or others, cannot exceed max life)

#### 3. Arrow Check

After resolving dice, if the **arrow pile is empty** (all 9 arrows have been taken by players), an **Indian Attack** occurs:
- Each player loses 1 life per arrow they hold
- All arrows return to the pile

### Elimination

When a player reaches 0 life:
- They are eliminated and their role is revealed
- **If an Outlaw is eliminated**: The killer draws (gets to re-roll? - actually no special reward in dice game)
- **If a Deputy is killed by the Sheriff**: Sheriff discards all dice results (penalty)

### Game End

- **Outlaws win** if the Sheriff is eliminated (unless only the Renegade remains)
- **Sheriff & Deputies win** if all Outlaws and Renegades are eliminated
- **Renegade wins** only if they are the last player alive (must kill everyone)

---

## Game State Model

### Server State

```typescript
interface BangDiceGameState {
  roomId: string;
  players: BangPlayer[];
  activePlayerIndex: number;
  arrowPile: number;              // arrows remaining in shared pool (start at 9)
  phase: BangPhase;
  dice: DieFace[];                // current 5 dice
  rollsRemaining: number;         // 0-2 after first roll
  keptDice: boolean[];            // which dice are locked/kept
  round: number;
  gameOver: boolean;
  winningTeam: 'sheriff' | 'outlaw' | 'renegade' | null;
}

interface BangPlayer {
  id: string;
  name: string;
  connected: boolean;
  role: BangRole;                 // hidden from others
  character: BangCharacter;
  life: number;
  maxLife: number;
  arrows: number;                 // arrows this player holds
  eliminated: boolean;
  isSheriff: boolean;             // public knowledge
}

type BangRole = 'sheriff' | 'deputy' | 'outlaw' | 'renegade';

interface BangCharacter {
  name: string;
  ability: string;
  baseLife: number;
}

type DieFace = '1' | '2' | 'arrow' | 'dynamite' | 'beer' | 'gatling';

type BangPhase =
  | 'rolling'           // active player rolling dice
  | 'resolving'         // resolving dice results
  | 'choose-targets'    // choosing who to shoot/heal (if ambiguous)
  | 'indian-attack'     // all players losing life from arrows
  | 'elimination'       // player eliminated, revealing role
  | 'game-over';
```

### Player View

```typescript
interface BangPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    character: BangCharacter;
    life: number;
    maxLife: number;
    arrows: number;
    eliminated: boolean;
    isSheriff: boolean;
    role: BangRole | null;        // only visible if eliminated or if it's your own
    seatIndex: number;            // position around the "table"
  }[];

  // Private
  myRole: BangRole;
  myIndex: number;

  // Game state
  activePlayerIndex: number;
  arrowPile: number;
  phase: BangPhase;
  dice: DieFace[];
  keptDice: boolean[];
  rollsRemaining: number;

  // For target selection
  targetOptions: TargetOption[] | null;

  round: number;
  gameOver: boolean;
  winningTeam: string | null;
}

interface TargetOption {
  type: '1' | '2' | 'beer';
  eligiblePlayerIds: string[];
}
```

### Actions

```typescript
type BangAction =
  | { type: 'roll'; keepIndices: number[] }      // which dice to keep, roll the rest
  | { type: 'resolve' }                          // confirm dice resolution
  | { type: 'choose-target'; dieType: string; targetId: string }
  | { type: 'beer-target'; targetId: string }    // who to heal
  ;
```

---

## Turn Flow

```
1. Phase: 'rolling'
   - Active player rolls all 5 dice (first roll)
   - Arrows immediately resolved: take arrow tokens from pile
   - Dynamite locked (can't re-roll)
   - If 3 dynamite: lose 1 life, turn ends
   - Player chooses which non-arrow, non-dynamite dice to keep
   - Can re-roll up to 2 more times
   - Check arrow pile after each arrow roll

2. Phase: 'resolving'
   - Resolve in order: gatling, 1s, 2s, beer
   - Gatling (3+): 1 damage to all others, discard arrows
   - 1s: damage to players 1 seat away (both directions)
   - 2s: damage to players 2 seats away (both directions)
   - If multiple targets at same distance, player may choose

3. Phase: 'choose-targets' (if needed)
   - Beer: player chooses who to heal
   - Seat ambiguity: resolved by targeting rules

4. Check for eliminations
   - Reveal eliminated players' roles
   - Check win conditions

5. Phase: 'indian-attack' (if arrow pile emptied)
   - All players lose 1 life per arrow they hold
   - Arrows return to pile
   - Check eliminations again

6. Next player's turn
```

---

## UI Specification

### Phone (Peer Mode)

**Your turn - rolling:**
```
+----------------------------+
| YOUR TURN (2 rolls left)   |
|                            |
| [1] [Dyn] [Beer] [2] [Arr]|
|  O    X     O     O    X  |
| keep  locked keep keep locked|
|                            |
| Tap dice to keep/release   |
| [ROLL AGAIN]  [STOP]      |
|                            |
| Your role: OUTLAW          |
| Life: 6/8  Arrows: 2      |
+----------------------------+
```

**Player circle (always visible):**
```
+----------------------------+
|       [Sheriff Bob]        |
|        Life: 7/9           |
|                            |
| [Alice]          [Charlie] |
| Life: 5/8        Life: 8/8 |
|                            |
|       [YOU]                |
|    Life: 6/8  Arrows: 2   |
|    Role: Outlaw            |
+----------------------------+
```

### Host Screen (Jackbox Mode)

- Players arranged in a circle with life bars, arrow counts
- Sheriff clearly marked
- Active player's dice shown large in the center
- Damage/healing animations between players
- Indian Attack: dramatic arrow rain animation
- Eliminated players grayed out with revealed role

---

## Hidden Information

- **Roles are hidden** (except Sheriff) until elimination
- **Character abilities are public**
- **Life, arrows, dice are all public**

Server-authoritative is recommended. Roles are the key secret, and they're simple to protect.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Display mode | Peer / Jackbox | Peer |
| Turn timer | Off / 30s / 60s | Off |
| Spectators allowed | Yes / No | Yes |

---

## Edge Cases

- **Sheriff eliminated with Renegade alive**: Outlaws win (even though Renegade is alive)
- **Renegade kills Sheriff in 1v1**: Renegade wins
- **Arrow pile empties during a roll**: Indian Attack happens mid-turn, then continue
- **3 dynamite on first roll**: Lose life, turn ends, don't resolve any other dice
- **Beer when at max life**: Wasted (or give to another player)
- **Gatling + arrows**: Gatling discards YOUR arrows, not others'
- **Elimination during Indian Attack**: Multiple players can die simultaneously

---

## Re-theming Notes

| Original | Direction |
|----------|-----------|
| Bang! The Dice Game | Any faction-conflict theme: space, medieval, pirates, corporate espionage |
| Sheriff/Deputy/Outlaw/Renegade | Roles in your chosen theme |
| Characters | Unique characters with abilities |
| Arrows / Indian Attack | Environmental hazard mechanic |

---

## Testing Plan

### Unit Tests
- Dice rolling: arrow/dynamite locking rules
- 3 dynamite explosion
- Gatling threshold (3+), damage to all, arrow discard
- Distance targeting (seat 1 and seat 2, wrapping around table)
- Arrow pile depletion -> Indian Attack
- Life/damage/healing calculations
- Win condition detection for all role combinations
- Character ability effects
- Full game simulation

### E2E Tests
- 4-player game setup, role distribution
- Roll dice, keep/re-roll flow
- Damage resolution and life tracking
- Elimination and role reveal
- Game end with correct winner determination
