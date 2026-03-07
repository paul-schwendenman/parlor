# Boggle - Game Specification

## Overview

Boggle is a word-finding game for 2+ players. A grid of lettered dice is shaken, and all players simultaneously search for words by connecting adjacent letters. After a timer expires, players compare lists - only unique words score points. Longer words score more.

Boggle is a natural fit for **both display modes**. Jackbox mode shows the grid on the big screen while players type on phones. Peer mode shows the grid on each device.

> **Note**: "Boggle" is trademarked by Hasbro. Parlor needs an original name. The word-grid mechanic itself is not protectable. See `docs/LEGAL.md`.

---

## Rules (Standard)

### Components

- **16 letter dice** (4x4 grid) or **25 letter dice** (5x5 grid)
- Each die has 6 faces with different letters
- Timer (standard: 3 minutes)

### Standard Dice (4x4 - Classic Boggle)

```
Die  1: A A E E G N
Die  2: A B B J O O
Die  3: A C H O P S
Die  4: A F F K P S
Die  5: A O O T T W
Die  6: C I M O T U
Die  7: D E I L R X
Die  8: D E L R V Y
Die  9: D I S T T Y
Die 10: E E G H N W
Die 11: E E I N S U
Die 12: E H R T V W
Die 13: E I O S S T
Die 14: E L R T T Y
Die 15: H I M N Qu U
Die 16: H L N N R Z
```

Note: "Qu" is treated as a single unit on one die face.

### Setup

1. All 16 dice are "shaken" (randomized) and placed in the 4x4 grid
2. Timer starts (3 minutes default)

### Finding Words

During the timer, all players simultaneously find words:

- Words are formed by connecting **adjacent** letters (horizontally, vertically, or diagonally)
- Each die can only be used **once per word**
- Words must be **at least 3 letters** long
- Words must be **real English words** (no proper nouns, abbreviations, or slang)
- "Qu" counts as two letters

### Scoring (After Timer)

1. All players reveal their word lists
2. **Duplicate elimination**: Any word found by more than one player is crossed out for everyone
3. Only **unique** words score:

| Word Length | Points |
|-------------|--------|
| 3 letters | 1 |
| 4 letters | 1 |
| 5 letters | 2 |
| 6 letters | 3 |
| 7 letters | 5 |
| 8+ letters | 11 |

4. Highest total wins the round

### Word Validation

- Words must exist in a standard dictionary
- Words must be traceable on the board via adjacent connections
- Both conditions must be met

---

## Game State Model

### Server State

```typescript
interface BoggleGameState {
  roomId: string;
  players: BogglePlayer[];
  grid: string[][];              // 4x4 or 5x5 grid of letters
  gridSize: 4 | 5;
  phase: BogglePhase;
  timerDuration: number;         // seconds
  timerStartedAt: number | null;
  round: number;
  totalRounds: number;
  validWords: Set<string>;       // all valid words findable on this board
  gameOver: boolean;
  winner: string | null;
}

interface BogglePlayer {
  id: string;
  name: string;
  connected: boolean;
  currentWords: string[];        // words submitted this round
  roundScores: number[];
  totalScore: number;
}

type BogglePhase =
  | 'ready'            // about to start round, showing grid
  | 'playing'          // timer running, players finding words
  | 'scoring'          // comparing lists, showing results
  | 'round-over'       // displaying round scores
  | 'game-over';
```

### Player View

```typescript
interface BogglePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    wordCount: number;           // how many words submitted (not what they are)
    roundScores: number[];
    totalScore: number;
  }[];

  grid: string[][];
  gridSize: 4 | 5;
  phase: BogglePhase;
  timeRemaining: number;
  round: number;
  totalRounds: number;

  // Private
  myWords: string[];             // words I've submitted
  myIndex: number;

  // Scoring phase
  scoringResults: ScoringResult[] | null;

  gameOver: boolean;
  winner: string | null;
}

interface ScoringResult {
  word: string;
  foundBy: string[];             // player IDs
  valid: boolean;                // exists in dictionary AND traceable on board
  unique: boolean;               // only one player found it
  points: number;                // 0 if not unique or invalid
  length: number;
}
```

### Actions

```typescript
type BoggleAction =
  | { type: 'submit-word'; word: string }
  | { type: 'remove-word'; word: string }
  | { type: 'ready' }                       // ready for next round
  ;
```

---

## Turn Flow

```
1. Phase: 'ready'
   - Grid is generated (shake dice, place randomly)
   - Server pre-computes all valid words on this board
   - Brief countdown (3, 2, 1...) shown to all players

2. Phase: 'playing'
   - Timer starts (default 3 minutes)
   - All players simultaneously find and submit words
   - Players can type words or trace them on the grid
   - Players see their own list growing, others' word counts only
   - Timer visible to all

3. Timer expires -> Phase: 'scoring'
   - All word lists revealed
   - Server validates each word:
     a. Is it in the dictionary?
     b. Can it be traced on the board via adjacent connections?
   - Duplicate words crossed out
   - Points calculated for unique valid words

4. Phase: 'round-over'
   - Show all words, who found them, which scored
   - Show round scores and running totals
   - Highlight impressive/long words

5. If more rounds remain, go to step 1
   Otherwise -> Phase: 'game-over'
```

---

## Word Validation Algorithm

### Dictionary

- Use a standard English word list (e.g., TWL06 or SOWPODS for Scrabble)
- Filter to words of 3+ letters
- Store as a trie for fast prefix checking
- Ship dictionary as a static asset or compute server-side

### Board Path Validation

```typescript
function isWordOnBoard(word: string, grid: string[][]): boolean {
  const size = grid.length;

  function dfs(row: number, col: number, index: number, visited: Set<string>): boolean {
    if (index === word.length) return true;

    const key = `${row},${col}`;
    if (visited.has(key)) return false;
    if (row < 0 || row >= size || col < 0 || col >= size) return false;

    const cell = grid[row][col]; // could be "Qu" or single letter
    const cellLen = cell.length;

    if (word.substring(index, index + cellLen).toUpperCase() !== cell.toUpperCase()) return false;

    visited.add(key);
    const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    for (const [dr, dc] of directions) {
      if (dfs(row + dr, col + dc, index + cellLen, visited)) return true;
    }

    visited.delete(key);
    return false;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (dfs(r, c, 0, new Set())) return true;
    }
  }
  return false;
}
```

### Pre-computing All Valid Words

At round start, the server can find ALL valid words on the board using the trie + DFS. This allows:
- Instant validation of player submissions
- Showing "words you missed" at round end
- Knowing the theoretical maximum score

---

## UI Specification

### Jackbox Mode

**Host screen**: Large grid, timer, player word counts, round scores.

```
+------------------------------------------+
|     B   R   A   E                        |
|     T   S   I   N                        |
|     O   D   E   L                        |
|     M   Qu  H   P                        |
|                                          |
|     2:34 remaining                       |
|                                          |
|  Alice: 12 words  |  Bob: 8 words       |
|  Charlie: 15 words                       |
+------------------------------------------+
```

**Phone controller**: Word input + personal list.

```
+----------------------------+
|  Type a word:              |
|  [_______________] [Add]   |
|                            |
|  Your words (12):          |
|  BRAIN, RAISE, RAINS,     |
|  BRAID, DAIS, SIDE,       |
|  AIDE, AIDES, RAID,       |
|  RAIDS, SINE, STEIN       |
|                            |
|  Tap a word to remove it   |
|                            |
|  2:34 remaining            |
+----------------------------+
```

### Peer Mode

Each device shows the grid + input area:

```
+----------------------------+
|  B  R  A  E                |
|  T  S  I  N                |
|  O  D  E  L                |
|  M  Qu H  P                |
+----------------------------+
|  [_______________] [Add]   |
|                            |
|  BRAIN, RAISE, RAINS...   |
|  (12 words)                |
|                            |
|  2:34        Others: 8,15  |
+----------------------------+
```

### Grid Interaction (Optional Enhancement)

- Players can **trace** words on the grid by dragging across adjacent letters
- As they trace, the path highlights and the word builds
- Releasing submits the word
- Fallback: typing always works

### Scoring Display

```
+-------------------------------------------+
| ROUND 1 RESULTS                          |
|                                           |
| UNIQUE WORDS:                             |
|  BRAIDS (6) - Alice only - 3 pts         |
|  STEIN (5) - Charlie only - 2 pts        |
|                                           |
| SHARED (no points):                       |
|  BRAIN - Alice, Bob, Charlie             |
|  RAISE - Alice, Charlie                  |
|                                           |
| INVALID:                                  |
|  BRAE - not in dictionary                |
|  TSID - can't trace on board             |
|                                           |
| WORDS YOU ALL MISSED:                     |
|  ASTRIDE (7) - 5 pts!                    |
|  DETAILS (7) - 5 pts!                    |
|                                           |
| Scores: Charlie 14, Alice 11, Bob 6      |
+-------------------------------------------+
```

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Grid size | 4x4 (Classic) / 5x5 (Big) | 4x4 |
| Timer | 1m / 2m / 3m / 5m | 3m |
| Rounds | 1 / 3 / 5 / 10 | 3 |
| Minimum word length | 3 / 4 / 5 | 3 |
| Dictionary | Standard / Expanded | Standard |
| Display mode | Peer / Jackbox | Peer |
| Show missed words | Yes / No | Yes |

---

## Hidden Information

- **During play**: Each player's word list is hidden from others (only word count shown)
- **After timer**: Everything is revealed

Minimal hidden information. Either state authority model works fine.

---

## Edge Cases

### "Qu" Handling
- "Qu" on a die counts as 2 letters for word length and scoring
- When typing, "Q" auto-becomes "QU" (no standalone Q words in English anyway)

### Same Word Different Paths
- A word that can be traced multiple ways still counts as one word
- Only matters for validation - as long as ANY valid path exists, the word is valid

### Disconnection
- Disconnected player's submitted words still count for duplicate elimination
- They just can't submit more words

### Vulgar/Offensive Words
- Standard dictionaries include some. For a family game, consider a blocklist filter.
- Configuration option: "family-friendly mode" that filters out offensive words

---

## Technical Notes

### Dictionary Loading
- English word list (~270K words) is ~2.5MB as plain text
- As a trie, it compresses well
- Options:
  - Server-side only: validate on submit, clients don't need the dictionary
  - Client-side: enable offline play, instant feedback as you type
  - Hybrid: client has the trie for prefix-checking (is this even a possible word?), server validates fully

### Performance
- Pre-computing all valid words on a 4x4 board takes <100ms
- 5x5 board may take longer, consider caching or async computation
- Player word submissions should be validated instantly (lookup in pre-computed set)

---

## Re-theming Notes

Boggle's mechanics (letter grid, adjacency, word finding) are completely generic. The name "Boggle" and the physical dice cube shaker are the only protectable elements.

Possible names: Word Grid, Letter Hunt, Lexicon, etc.

---

## Testing Plan

### Unit Tests
- `isWordOnBoard()` - valid paths, invalid paths, "Qu" handling
- Pre-compute all words on a known board, verify against expected set
- Scoring: word length points, duplicate elimination
- Grid generation: all dice placed, correct letter distributions

### E2E Tests
- Create game, see grid on all devices
- Submit words during timer
- Timer expires, scoring displayed
- Duplicate words correctly eliminated
- Multi-round game to completion
