# Telestrations - Game Specification

## Overview

Telestrations is a party game combining Telephone and Pictionary. Players start with a word, draw it, pass it to the next player who guesses what it is, then the next player draws that guess, and so on. The hilarious results come from how the word mutates through alternating draw/guess rounds. Everyone reveals their chain at the end for laughs.

This is a **strong Jackbox-mode game**. Players draw on their phones, and the reveal plays out on the big screen.

> **Note**: "Telestrations" is trademarked by The Op (USAopoly). Parlor needs an original name. The telephone-Pictionary mechanic is a common party game format. See `docs/LEGAL.md`.

---

## Rules

### Setup

- Each player receives a secret word or phrase
- Words can come from a curated list or players can submit their own

### Turn Structure (Simultaneous)

Each player has a "sketchbook" that circulates. All players act simultaneously:

1. **Round 1 - See Word**: Everyone sees their starting word
2. **Round 2 - Draw**: Everyone draws their word (timed, ~60s)
3. **Round 3 - Guess**: Everyone sees the previous player's drawing and writes a guess
4. **Round 4 - Draw**: Everyone draws the previous player's guess
5. **Round 5 - Guess**: Continue alternating...
6. Continue until sketchbooks return to their original owner

With N players, there are N rounds total (alternating draw/guess). Even player count means the last round is a guess. Odd means it ends on a draw.

### Reveal

After all rounds complete, each sketchbook is revealed one at a time:
1. Show the original word
2. Show each subsequent drawing and guess in order
3. Everyone laughs at how the word transformed

### Scoring (Optional)

Scoring is secondary to the fun, but options include:
- **Favorite drawing**: Vote on the funniest/best drawing each reveal
- **Accuracy**: Points if your guess matches the original word
- **Survival**: Points if the final guess matches the starting word (whole chain succeeded)
- **No scoring**: Just play for laughs (recommended default)

---

## Game State Model

```typescript
interface TelestrationsGameState {
  roomId: string;
  players: TelestrationsPlayer[];
  phase: TelestrationsPhase;
  currentRound: number;            // 0-indexed
  totalRounds: number;             // equals player count
  timerDuration: number;           // seconds per draw/guess phase
  timerStartedAt: number | null;
  sketchbooks: Sketchbook[];       // one per player, circulating
  revealIndex: number;             // which sketchbook is being revealed
  revealPage: number;              // which page of that sketchbook
  gameOver: boolean;
}

interface TelestrationsPlayer {
  id: string;
  name: string;
  connected: boolean;
  hasSubmitted: boolean;           // submitted their draw/guess for this round
}

interface Sketchbook {
  originalPlayerId: string;        // who started with this sketchbook
  currentHolderId: string;         // who has it now
  pages: SketchbookPage[];
}

type SketchbookPage =
  | { type: 'word'; word: string; authorId: string }
  | { type: 'drawing'; imageData: string; authorId: string }   // base64 or SVG path data
  | { type: 'guess'; guess: string; authorId: string }
  ;

type TelestrationsPhase =
  | 'word-assignment'    // players getting their words
  | 'drawing'            // everyone drawing
  | 'guessing'           // everyone guessing from drawings
  | 'waiting'            // waiting for all to submit
  | 'revealing'          // showing results one sketchbook at a time
  | 'voting'             // optional: voting on favorites
  | 'game-over';
```

### Player View

```typescript
interface TelestrationsPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    hasSubmitted: boolean;
  }[];

  // What I need to do right now
  myTask: DrawTask | GuessTask | WaitTask | WatchTask;

  phase: TelestrationsPhase;
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;

  // Reveal phase
  revealSketchbook: RevealView | null;

  gameOver: boolean;
}

interface DrawTask {
  type: 'draw';
  prompt: string;               // the word or guess to draw
  promptAuthor: string;         // who wrote it
}

interface GuessTask {
  type: 'guess';
  drawing: string;              // the image data to guess from
  drawingAuthor: string;
}

interface WaitTask {
  type: 'wait';                 // already submitted, waiting for others
}

interface WatchTask {
  type: 'watch';                // reveal phase, watching on big screen
}

interface RevealView {
  ownerName: string;            // whose sketchbook
  pages: {
    type: 'word' | 'drawing' | 'guess';
    content: string;
    authorName: string;
  }[];
  currentPage: number;
}
```

### Actions

```typescript
type TelestrationsAction =
  | { type: 'submit-drawing'; imageData: string }
  | { type: 'submit-guess'; guess: string }
  | { type: 'next-reveal' }                        // advance reveal
  | { type: 'vote-favorite'; sketchbookIndex: number; pageIndex: number }
  ;
```

---

## Turn Flow

```
1. Phase: 'word-assignment'
   - Each player is assigned a random word from the word list
   - Players see their word on their phone
   - Brief moment to read it

2. Phase: 'drawing' (Round 1)
   - All players draw their word simultaneously
   - Timer running (default 60s)
   - Submit when done or auto-submit when timer expires
   - Wait for all players

3. Sketchbooks pass to the next player (left)

4. Phase: 'guessing' (Round 2)
   - All players see the drawing from the previous player
   - Type a guess for what it is
   - Timer running (default 30s)
   - Wait for all players

5. Sketchbooks pass again

6. Alternate between drawing and guessing until all rounds complete
   (N rounds for N players)

7. Phase: 'revealing'
   - One sketchbook at a time, page by page
   - Host screen shows each page with dramatic reveal
   - Players react / laugh
   - Host or any player advances to next page

8. After all sketchbooks revealed:
   Phase: 'voting' (optional)
   - Vote on funniest drawing, best guess, etc.

9. Phase: 'game-over'
   - Show results/votes
   - Play again option
```

---

## Drawing Canvas

### Requirements

- Simple touch/mouse drawing on phone screen
- Black pen on white canvas (minimum)
- Nice to have: color selection, pen size, undo, clear
- Canvas size: fixed aspect ratio (e.g., 4:3 or 1:1)
- Drawing data: SVG path data or compressed bitmap (keep small for transmission)

### Implementation Options

1. **HTML Canvas API**: Draw on `<canvas>`, export as PNG/data URL
   - Pros: Simple, well-supported
   - Cons: Bitmap, larger data size, can't undo strokes easily

2. **SVG Paths**: Record stroke paths as SVG
   - Pros: Vector, small data, easy undo (remove last path), replayable
   - Cons: Slightly more complex to implement

3. **Library**: Use a drawing library (e.g., perfect-freehand for pressure-sensitive strokes)
   - Pros: Better drawing feel, especially on phones
   - Cons: Dependency

**Recommendation**: SVG paths with the option to replay drawings during reveal (adds visual interest).

### Drawing Data Format

```typescript
interface DrawingData {
  strokes: Stroke[];
  width: number;
  height: number;
}

interface Stroke {
  points: [number, number][];     // [x, y] coordinates
  color: string;
  width: number;
  timestamp: number;              // for replay
}
```

---

## UI Specification

### Phone - Drawing Phase

```
+----------------------------+
| Draw: "ELEPHANT"           |
| 0:45 remaining             |
+----------------------------+
|                            |
|                            |
|   [Drawing Canvas]         |
|                            |
|                            |
|                            |
+----------------------------+
| [Undo] [Clear]    [Done]  |
| Color: * * * *   Size: -- |
+----------------------------+
```

- Large canvas area (maximize phone screen)
- Prompt word at top
- Minimal tools: undo, clear, submit
- Timer visible

### Phone - Guessing Phase

```
+----------------------------+
| What is this drawing?      |
| By: Alice                  |
| 0:22 remaining             |
+----------------------------+
|                            |
|   [Previous Drawing]       |
|                            |
+----------------------------+
| [___________________]      |
| [Submit Guess]             |
+----------------------------+
```

- Drawing displayed (not editable)
- Text input for guess
- Author shown

### Host Screen - Reveal

```
+----------------------------------------------+
| ALICE'S SKETCHBOOK                           |
|                                              |
|  Started with: "ELEPHANT"                    |
|                                              |
|  Bob drew:          Charlie guessed:         |
|  [Drawing]          "HIPPO"                  |
|                                              |
|  Diana drew:        Eve guessed:             |
|  [Drawing]          "FAT DOG"               |
|                                              |
|  [Next Page]   [Next Sketchbook]             |
+----------------------------------------------+
```

- Reveal one page at a time for dramatic effect
- Drawing replay animation (strokes appear in order)
- Side-by-side layout: drawing | guess | drawing | guess
- Big screen optimized - text and drawings are large

---

## Configuration Options

| Option | Values | Default |
|--------|--------|---------|
| Draw timer | 30s / 60s / 90s / 120s | 60s |
| Guess timer | 15s / 30s / 45s | 30s |
| Word source | Random from list / Players submit | Random |
| Word difficulty | Easy / Medium / Hard | Medium |
| Scoring | None / Vote favorites / Accuracy | None |
| Drawing tools | Pen only / Pen + colors / Full toolkit | Pen + colors |
| Display mode | Jackbox / Peer | Jackbox |

---

## Word List

Similar to Codenames, need a curated word list. But for Telestrations, words should be:
- **Drawable** - concrete nouns and actions work best
- **Varying difficulty**: Easy (cat, house), Medium (astronaut, waterfall), Hard (democracy, awkward)
- **Funny potential** - words that are likely to mutate hilariously
- **300+ words** minimum

Categories: animals, food, activities, professions, places, objects, fictional characters (generic), emotions (hard mode), abstract concepts (expert mode).

---

## Hidden Information

- Each player's drawing/guess is hidden until the reveal phase
- Words are hidden from everyone except the current holder
- During play, you only see what was passed to you

Moderate hidden info during play, everything revealed at end. Server-authoritative is simpler but not strictly necessary since there's no competitive advantage to cheating.

---

## Edge Cases

### Player Count
- **Minimum 4 players** recommended (fewer rounds = less mutation = less fun)
- **3 players**: Works but short chains (word → draw → guess, then done)
- **8+ players**: Long chains, more mutation, more fun. But also more waiting.
- **Odd players**: Last round is a drawing (no one guesses it until reveal)
- **Even players**: Last round is a guess

### Disconnection
- If a player disconnects during drawing: submit a blank canvas after timeout
- If during guessing: submit "???" as guess after timeout
- The chain continues - blank drawings are actually funny

### Drawing Size
- Keep drawing data under ~100KB per submission
- SVG paths are typically much smaller
- If using bitmap: compress aggressively, small canvas resolution

### Timer Expiry
- Auto-submit whatever is on the canvas when timer expires
- For guessing: submit empty string or "???" if nothing typed

---

## Re-theming Notes

Telestrations is a generic party game format (broken telephone + drawing). No specific theme needed. The name just needs to be original.

Possible names: Sketch Telephone, Draw & Guess, Broken Canvas, etc.

---

## Testing Plan

### Unit Tests
- Sketchbook circulation (correct rotation)
- Round counting and phase alternation (draw/guess/draw/guess)
- Timer management
- Word assignment (no duplicates)
- Drawing data serialization/deserialization

### E2E Tests
- 4-player game: word assignment, draw, guess, draw, guess
- Drawing canvas: draw strokes, undo, clear, submit
- Guess input and submission
- Timer expiry auto-submit
- Full reveal sequence
- Play again flow
