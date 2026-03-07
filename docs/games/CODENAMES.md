# Codenames - Game Specification

## Overview

Codenames is a team word-association game for 4+ players. A 5x5 grid of word cards is laid out. Each team has a Spymaster who knows which words belong to their team. Spymasters give one-word clues linked to multiple words, and their teammates try to guess correctly. Touch an assassin word and you lose instantly.

Codenames is a **perfect Jackbox-mode game**. The grid lives on the big screen, Spymasters see the key card on their phone, and guessers discuss openly and tap to guess.

> **Note**: "Codenames" is trademarked by Czech Games Edition. Parlor needs an original name. The word-grid-with-hidden-assignments mechanic is not protectable. See `docs/LEGAL.md`.

---

## Rules

### Setup

- **25 word cards** arranged in a 5x5 grid (drawn from a large word pool)
- **2 teams**: Red and Blue
- Each team has a **Spymaster** and one or more **Guessers**
- A **key card** (visible only to Spymasters) assigns each word:
  - 9 words belong to the starting team
  - 8 words belong to the other team
  - 7 words are neutral bystanders
  - 1 word is the **assassin**
- Starting team has 9 words (slight disadvantage of going first is offset by having more words)

### Key Card

```
+---+---+---+---+---+
| R | B | N | R | A |    R = Red team
+---+---+---+---+---+    B = Blue team
| N | R | B | N | R |    N = Neutral
+---+---+---+---+---+    A = Assassin
| B | N | R | B | R |
+---+---+---+---+---+
| R | B | N | B | N |
+---+---+---+---+---+
| B | R | B | N | R |
+---+---+---+---+---+
```

Both Spymasters see the same key card. Guessers see only the word grid.

### Turn Structure

1. **Spymaster gives a clue**: One word + one number
   - The word is a thematic hint connecting multiple team words
   - The number indicates how many words relate to the clue
   - Example: "Animal 3" (three of our words relate to animals)
   - The clue word cannot be any word on the board (or a derivative)

2. **Guessers discuss and guess**: They tap/select words one at a time
   - They must make **at least 1 guess**
   - They may make up to **clue number + 1** guesses (the +1 allows catching up on previous clues)
   - They can **stop guessing** at any time after the first guess

3. **Reveal**: Each guessed word is revealed as:
   - **Team word**: Covered with team color. Continue guessing if desired.
   - **Neutral**: Turn ends immediately.
   - **Opponent's word**: Covered with opponent color. Turn ends. (You just helped them!)
   - **Assassin**: Game over. Your team **loses immediately**.

### Game End

- A team **wins** when all their words are covered (by either team's guesses)
- A team **loses** if they guess the assassin
- Game can also end when all words of one team are uncovered through the other team's mistakes

---

## Game State Model

```typescript
interface CodenamesGameState {
  roomId: string;
  teams: [CodenamesTeam, CodenamesTeam];  // 0 = Red, 1 = Blue
  grid: GridCard[];                        // 25 cards
  keyCard: CardAssignment[];               // 25 assignments (hidden from guessers)
  activeTeam: 0 | 1;
  startingTeam: 0 | 1;
  phase: CodenamesPhase;
  currentClue: Clue | null;
  guessesRemaining: number;
  gameOver: boolean;
  winner: 0 | 1 | null;
  lostToAssassin: 0 | 1 | null;
}

interface CodenamesTeam {
  name: string;                            // "Red" / "Blue"
  spymasterId: string;
  guesserIds: string[];
  wordsRemaining: number;                  // how many team words still uncovered
}

interface GridCard {
  word: string;
  revealed: boolean;
  assignment: CardAssignment | null;       // only set when revealed (or for spymasters)
}

type CardAssignment = 'red' | 'blue' | 'neutral' | 'assassin';

interface Clue {
  word: string;
  number: number;
  teamIndex: 0 | 1;
}

type CodenamesPhase =
  | 'team-setup'       // assigning spymasters and teams
  | 'giving-clue'      // active spymaster entering their clue
  | 'guessing'         // active guessers selecting words
  | 'game-over';
```

### Player View

```typescript
interface CodenamesPlayerView {
  grid: {
    word: string;
    revealed: boolean;
    assignment: CardAssignment | null;     // only if revealed, OR if player is a spymaster
  }[];

  teams: {
    name: string;
    spymaster: { id: string; name: string };
    guessers: { id: string; name: string }[];
    wordsRemaining: number;
  }[];

  // Private
  myRole: 'spymaster' | 'guesser';
  myTeam: 0 | 1;
  isSpymaster: boolean;
  keyCard: CardAssignment[] | null;        // only for spymasters

  // Game state
  activeTeam: 0 | 1;
  phase: CodenamesPhase;
  currentClue: Clue | null;
  guessesRemaining: number;

  gameOver: boolean;
  winner: 0 | 1 | null;
  lostToAssassin: boolean;
}
```

### Actions

```typescript
type CodenamesAction =
  | { type: 'assign-role'; teamIndex: 0 | 1; role: 'spymaster' | 'guesser' }
  | { type: 'give-clue'; word: string; number: number }
  | { type: 'guess'; cardIndex: number }
  | { type: 'end-guessing' }             // stop guessing early
  | { type: 'new-game' }
  ;
```

---

## Turn Flow

```
1. Phase: 'team-setup'
   - Players join teams and assign spymasters
   - Need at least 2 per team (1 spymaster + 1 guesser)
   - Host confirms when ready

2. Phase: 'giving-clue'
   - Active team's spymaster sees the key card
   - Spymaster types a one-word clue and a number
   - Server validates: clue word is not on the board
   - Clue is revealed to everyone

3. Phase: 'guessing'
   - Active team's guessers discuss (via chat or voice)
   - They select words one at a time
   - Each selection is immediately revealed:
     - Team word: decrement remaining, can continue
     - Neutral: turn ends
     - Opponent word: turn ends (opponent's remaining decremented)
     - Assassin: game over, this team loses
   - After mandatory first guess, team can choose to stop
   - Maximum guesses: clue number + 1
   - If all team words found: team wins

4. Switch to other team, go to step 2

5. Phase: 'game-over'
   - Reveal entire key card
   - Show winner (or assassin loss)
   - Option to play again (swap spymasters, new grid)
```

---

## UI Specification

### Jackbox Mode (Recommended)

#### Host Screen - The Grid

```
+---------------------------------------------------+
|  CODENAMES         Red: 5 left  |  Blue: 4 left   |
+---------------------------------------------------+
|                                                    |
| [PARIS]   [BANK]    [MOUSE]   [BERLIN]  [AGENT]   |
|           (blue)                         (red)     |
|                                                    |
| [PIANO]   [CHANGE]  [SPRING]  [GLASS]   [NAIL]    |
|  (red)              (neutral)                      |
|                                                    |
| [STAR]    [ROCK]    [PLATE]   [BRIDGE]  [SHIP]    |
|                                                    |
| [DOCTOR]  [FAIR]    [APPLE]   [CROWN]   [STICK]   |
|           (red)                                    |
|                                                    |
| [WATCH]   [BELL]    [MOON]    [EGYPT]   [LEMON]   |
|                     (blue)                         |
+---------------------------------------------------+
|  Current clue: "CAPITAL 2"  (Red team)             |
|  Guesses remaining: 3                              |
+---------------------------------------------------+
```

- Revealed cards colored by assignment (red, blue, tan/neutral)
- Unrevealed cards are white/neutral
- Assassin revealed as black with skull
- Current clue displayed prominently
- Team scores (words remaining) visible

#### Phone - Spymaster View

```
+----------------------------+
| YOU ARE SPYMASTER (Red)    |
+----------------------------+
| Key Card:                  |
| R  B  N  R  A             |
| N  R  B  N  R             |
| B  N  R  B  R             |
| R  B  N  B  N             |
| B  R  B  N  R             |
+----------------------------+
| Give a clue:               |
| Word: [___________]        |
| Number: [1] [2] [3] [4]   |
| [SUBMIT CLUE]              |
+----------------------------+
```

- Key card always visible with color coding
- Grid words overlaid on the key card (small text)
- Clue input with word field and number selector

#### Phone - Guesser View

```
+----------------------------+
| Red Team - Your turn!      |
| Clue: "CAPITAL 2"          |
| Guesses left: 3            |
+----------------------------+
| Tap a word to guess:       |
|                            |
| [PARIS]  [BANK]  [MOUSE]  |
| [BERLIN] [STAR]  [ROCK]   |
| [PLATE]  [BRIDGE][SHIP]   |
| [DOCTOR] [APPLE] [CROWN]  |
| [STICK]  [WATCH] [BELL]   |
| [EGYPT]  [LEMON]          |
+----------------------------+
| [END GUESSING]             |
+----------------------------+
```

- Only unrevealed words shown as tappable
- Already-revealed words removed or shown with their color

### Peer Mode

Each device shows the full grid. Spymasters see the overlay with assignments. This works but loses the social energy of a shared screen.

---

## Word List

A good word list is critical. Requirements:
- **400+ words** for variety across games
- Common, concrete nouns work best
- Avoid obscure words
- No proper nouns in the grid (though clues can reference them)
- Words should be diverse enough to allow creative connections

The original Codenames has 400 double-sided word cards (200 unique words per side). We need our own list.

Categories to draw from: animals, food, places, objects, nature, body parts, professions, actions, materials, weather, sports, music, etc.

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Grid size | 5x5 (standard) / 4x4 (quick) | 5x5 |
| Word list | Standard / Custom | Standard |
| Timer for clue giving | Off / 60s / 120s | Off |
| Timer for guessing | Off / 60s / 120s / 180s | Off |
| Display mode | Jackbox / Peer | Jackbox |
| Spectators | Yes / No | Yes |

---

## Hidden Information

- **Key card**: Hidden from guessers, visible to both spymasters
- **Team discussion**: In Jackbox mode, guessers discuss openly (everyone hears). In peer mode, team chat could be private (but usually discussion is public in Codenames)

Server-authoritative for the key card. Spymasters must be trusted not to share it.

---

## Edge Cases

### Clue Validation
- Clue cannot be a word currently on the board
- Clue must be a single word (no spaces, hyphens debatable)
- Number must be >= 0 (0 is legal - means "none of our words relate, but avoid these")
- "Unlimited" as a number: some variants allow this (clue relates to words but no count limit)

### Uneven Teams
- Works with unequal team sizes (e.g., 3 vs 2)
- Minimum: 1 spymaster + 1 guesser per team
- Odd player out can spectate or one team gets an extra guesser

### Spymaster Mistakes
- If a spymaster accidentally gives an invalid clue (word on the board), opponents can challenge
- Resolution: turn forfeited, or allow a new clue (house rules)

### 3-Player Variant
- 1 spymaster for both teams, 1 guesser per team
- Or: 1 spymaster, 2 guessers cooperating against the board (Codenames Duet style)

### Quick Game
- 4x4 grid with fewer team words for faster games
- Good for getting a feel before committing to a full game

---

## Re-theming Notes

| Original | Direction |
|----------|-----------|
| Codenames | Any spy/mystery theme, or completely different (could be abstract) |
| Red/Blue teams | Any two-team distinction |
| Spymaster | Clue giver, Captain, Leader |
| Assassin | Any instant-loss concept |

The mechanic is the game. Theme is purely cosmetic.

---

## Testing Plan

### Unit Tests
- Key card generation (correct distribution: 9/8/7/1)
- Clue validation (not on board, single word)
- Guess resolution (team/opponent/neutral/assassin)
- Guess count enforcement (max = clue number + 1)
- Win detection (all team words found)
- Assassin loss detection
- Word list loading and random selection

### E2E Tests
- Team setup with spymaster assignment
- Spymaster gives clue, guessers see it
- Guess a team word, continue guessing
- Guess neutral, turn ends
- Guess opponent word, turn ends
- Guess assassin, game over
- Full game to natural win
