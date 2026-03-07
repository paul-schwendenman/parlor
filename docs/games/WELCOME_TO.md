# Welcome To - Game Specification

## Overview

Welcome To is a flip-and-write game for 1-50+ players. Three pairs of cards are flipped from shared decks each turn. All players simultaneously choose one pair and write numbers on their personal neighborhood scoresheet, building houses in numerical order across three streets. No player limit since everyone uses the same flipped cards.

Welcome To is an **ideal Jackbox-mode game**. The flipped cards go on the big screen, everyone fills in their sheet on their phone. Supports massive groups.

> **Note**: "Welcome To..." is trademarked by Blue Cocker Games. Parlor needs an original name. The flip-and-write mechanic is generic. See `docs/LEGAL.md`.

---

## Rules (Simplified Core)

### Components

- **81 construction cards** in 3 decks of 27
- Each card has a **number** (1-15) on one side and an **action** on the other
- **Scoresheet** per player with 3 streets of houses

### Card Actions

| Action | Effect |
|--------|--------|
| **Surveyor** (fence) | Build a fence between two adjacent houses on any street |
| **Real Estate Agent** | Increase the value of estates of a chosen size |
| **Landscaper** | Build a park (adds to park scoring for that street) |
| **Pool Manufacturer** | Build a pool on the chosen house (if it has a pool slot) |
| **Temp Agency** | Add or subtract 1-2 from the house number |
| **Bis** | Duplicate an adjacent house number (with a "bis" suffix, like 7b) |

### Scoresheet Layout

Three streets with varying house counts:
- **Street 1**: 10 houses
- **Street 2**: 11 houses
- **Street 3**: 12 houses

Each house is a blank slot that will receive a number. Numbers must be placed in **ascending left-to-right order** on each street (duplicates allowed only via Bis).

Some houses have pre-printed pool slots (can be activated with Pool action).

### Turn Structure (Simultaneous)

1. Flip the top card of each of the 3 construction decks
2. This reveals 3 pairs: each pair is a **number** (from the flipped card) + **action** (from the card now on top of the deck)
3. **All players simultaneously** choose one of the 3 pairs
4. Write the **number** on a valid house slot on any street
5. Optionally use the **action**
6. If a player **cannot legally place any number**, they mark a building permit refusal (penalty)

### Estates

- **Estates** are groups of consecutive houses separated by fences
- Estates score based on their size and the real estate value track:

| Estate Size | Base Value |
|-------------|------------|
| 1 house | 1 |
| 2 houses | 2 |
| 3 houses | 3 |
| 4 houses | 4 |
| 5 houses | 5 |
| 6+ houses | 6 |

Real Estate Agent actions increase the multiplier for a chosen size.

### City Plans (Objectives)

Three public objectives are available (e.g., "build two estates of exactly 3 houses on street 1"). First player to complete an objective scores more points than subsequent completers.

### Game End

The game ends when:
- A player completes **all 3 city plans**, OR
- A player takes their **3rd building permit refusal**, OR
- All 3 card decks are exhausted

### Scoring

| Category | Points |
|----------|--------|
| City Plans | Variable (first completion bonus) |
| Parks | Per street, based on count |
| Pools | Per pool built |
| Estates | Size x real estate value |
| Temp Agency | Bonus for using all temp agency actions |
| Refusals | -3 each (building permit refusals) |

Highest total wins.

---

## Game State Model

```typescript
interface WelcomeToGameState {
  roomId: string;
  players: WelcomeToPlayer[];
  decks: ConstructionDeck[];        // 3 decks
  flippedCards: FlippedPair[];      // 3 pairs available this turn
  cityPlans: CityPlan[];           // 3 shared objectives
  phase: WelcomeToPhase;
  turn: number;
  gameOver: boolean;
  winner: string | null;
}

interface WelcomeToPlayer {
  id: string;
  name: string;
  connected: boolean;
  sheet: Scoresheet;
  refusals: number;
  completedPlans: number[];        // indices of completed city plans
  hasSubmitted: boolean;           // submitted this turn's choice
}

interface Scoresheet {
  streets: Street[];               // 3 streets
  realEstateTrack: number[];       // value increase per estate size [1-6]
  tempAgencyUsed: number;
}

interface Street {
  houses: HouseSlot[];
  parks: number;
  fences: boolean[];               // fences between houses (length = houses - 1)
}

interface HouseSlot {
  number: number | null;
  isBis: boolean;
  hasPoolSlot: boolean;
  poolBuilt: boolean;
}

interface FlippedPair {
  number: number;                  // 1-15
  action: CardAction;
}

type CardAction = 'surveyor' | 'real-estate' | 'landscaper' | 'pool' | 'temp-agency' | 'bis';

interface CityPlan {
  description: string;
  requirement: PlanRequirement;
  firstScore: number;
  subsequentScore: number;
  completedBy: string[];           // player IDs who completed it
}

type WelcomeToPhase =
  | 'flipping'          // cards being flipped
  | 'choosing'          // players choosing a pair and placing
  | 'turn-over'         // brief, advancing to next turn
  | 'game-over';
```

### Player View

```typescript
interface WelcomeToPlayerView {
  flippedCards: FlippedPair[];     // 3 options this turn
  cityPlans: CityPlan[];

  players: {
    id: string;
    name: string;
    connected: boolean;
    refusals: number;
    completedPlans: number[];
    hasSubmitted: boolean;
  }[];

  // Private
  mySheet: Scoresheet;
  myIndex: number;
  validPlacements: Placement[];    // pre-computed legal moves

  phase: WelcomeToPhase;
  turn: number;
  gameOver: boolean;
  winner: string | null;
  finalScores: FinalScore[] | null;
}

interface Placement {
  pairIndex: number;               // which of the 3 pairs
  streetIndex: number;
  houseIndex: number;
  adjustedNumber?: number;         // if using temp agency
}
```

### Actions

```typescript
type WelcomeToAction =
  | { type: 'place'; pairIndex: number; streetIndex: number; houseIndex: number; actionDetails?: ActionDetails }
  | { type: 'refuse' }            // can't place any number
  ;

type ActionDetails =
  | { action: 'surveyor'; fenceStreet: number; fenceIndex: number }
  | { action: 'real-estate'; estateSize: number }
  | { action: 'landscaper' }      // auto-adds to chosen street
  | { action: 'pool' }            // auto-builds pool if house has slot
  | { action: 'temp-agency'; adjustment: -2 | -1 | 1 | 2 }
  | { action: 'bis'; sourceHouseIndex: number }
  ;
```

---

## Turn Flow

```
1. Phase: 'flipping'
   - Top card of each deck is flipped
   - Reveals 3 number+action pairs
   - All players see the same 3 options

2. Phase: 'choosing'
   - All players simultaneously choose one pair
   - Place the number on a valid house slot
   - Optionally use the action
   - If no valid placement: mark a refusal
   - Wait for all players to submit

3. Check game-end conditions:
   - Anyone completed all 3 city plans?
   - Anyone at 3 refusals?
   - All decks exhausted?

4. Phase: 'turn-over'
   - Advance to next turn
   - Go to step 1

5. Phase: 'game-over'
   - Calculate final scores for all players
   - Display results
```

---

## UI Specification

### Jackbox Mode (Recommended)

#### Host Screen

```
+----------------------------------------------+
| WELCOME TO...         Turn 18                 |
+----------------------------------------------+
|                                               |
|  Card A: [7] + Surveyor                       |
|  Card B: [12] + Pool                          |
|  Card C: [3] + Landscaper                     |
|                                               |
|  City Plans:                                  |
|  1. Two 4-house estates on Street 1 [15/7pts] |
|  2. All pools on Street 2 [8/4pts]           |
|  3. Three 2-house estates anywhere [12/6pts]  |
|     Completed by: Alice                       |
|                                               |
|  Waiting for: Bob, Charlie                    |
|  Submitted: Alice, Dave, Eve                  |
+----------------------------------------------+
```

#### Phone - Scoresheet

```
+----------------------------+
| Card A:[7]+Surveyor        |
| Card B:[12]+Pool           |
| Card C:[3]+Landscaper      |
+----------------------------+
| Street 1:                  |
| [2][3]|[5][_][_]|[_][_][_][_][_]|
|    parks: 2                |
+----------------------------+
| Street 2:                  |
| [1][_][_]|[4][6][8]|[_][_][_][_][_]|
|    parks: 0    pools: 1   |
+----------------------------+
| Street 3:                  |
| [_][_][_][_][_][_][_][_][_][_][_][_]|
|    parks: 1                |
+----------------------------+
| Tap a house to place       |
| Refusals: 1/3              |
+----------------------------+
```

- Streets shown as rows of house slots
- Fences shown as `|` dividers
- Filled houses show their number
- Empty houses are tappable
- Valid placements highlighted for chosen card
- Parks and pools tracked per street

---

## Why Welcome To is Special for Parlor

1. **No player limit** - Everyone uses the same flipped cards. Could support 20+ players in one lobby.
2. **No hidden info between players** - Scoresheets are private but there's no competitive advantage to seeing them.
3. **Simultaneous play** - No waiting for other players' turns. Everyone goes at once.
4. **Perfect Jackbox fit** - Cards on big screen, sheets on phone.
5. **Solo mode built in** - Can play alone for practice/high score.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Turn timer | Off / 30s / 60s / 90s | Off |
| City plan set | Random / Beginner / Advanced | Random |
| Display mode | Jackbox / Peer | Jackbox |
| Spectators | Yes / No | Yes |
| Show other sheets | Off / After game | After game |

---

## Hidden Information

- Each player's scoresheet choices are private during play
- Flipped cards and city plans are fully public
- No strategic advantage to seeing other sheets (minor - estate race for plans)

Could work with consensus model. Server mainly needed for card flipping and plan completion tracking.

---

## Edge Cases

- **No valid placement**: Must take a refusal. Can't skip.
- **Bis placement**: Must be adjacent to an existing house with the same number
- **Temp agency**: Adjusted number must still fit ascending order on the street
- **City plan race**: First completer gets higher score. Simultaneous completion in same turn: both get first-place score.
- **All decks empty**: Some decks may empty before others. If fewer than 3 pairs available, players choose from what's left.
- **Massive player count**: Server handles card flipping, each client handles their own sheet locally. Minimal server load.

---

## Re-theming Notes

Welcome To's 1950s suburban housing theme is decorative. Any "build and fill a grid" theme works.

| Original | Direction |
|----------|-----------|
| Welcome To | Building anything: garden, city block, space station, aquarium |
| Houses/streets | Plots/rows, modules/corridors, tanks/wings |
| Construction cards | Resource cards, blueprint cards |

---

## Testing Plan

### Unit Tests
- Number placement validation (ascending order)
- Fence placement and estate calculation
- Each action type's effect
- City plan completion detection
- Scoring: estates, parks, pools, refusals
- Bis placement rules
- Temp agency number adjustment validation
- Game end conditions

### E2E Tests
- 3-player game with simultaneous choices
- Place numbers, use actions
- Complete a city plan
- Refusal scenario
- Full game to completion with scoring
