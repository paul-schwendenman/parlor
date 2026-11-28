# Golf (Six-Card)

> Implementation brief, 2026-11-27. Rules verified against Pagat (primary) and Bicycle. Nothing here is shipped yet.

## 1. Overview

In Six-Card Golf each player has a 2×3 grid of cards, mostly face down. On your turn you draw and swap to bring your total down. Kings are worth zero, 2s are minus two, and two equal cards in a column cancel out. Nine deals ("holes") make a game, and the lowest total wins. **2–6 players**, about 2–3 minutes per hole and 20–30 minutes for 9 holes. Display mode: **peer**. Nothing is hidden from one player but not another (face-down cards are unknown to everyone), so a shared Jackbox-style screen would also work later. It fits Parlor because it's one of the best-loved family card games. An 8-year-old learns it in one hole and it still has real push-your-luck decisions for adults. It covers 2–6, the range most family calls have, with a single small grid instead of a big hand. That suits phones and avoids the 13-card-hand crowding of the trick games.

## 2. Naming & IP

- **Name: "Golf"** (`id: golf`). It's a traditional public-domain game. Use the shelf description to say "six-card".
- Don't borrow names or art from commercial power-card variants (Cabo, Skyjo and similar are separate products).
- The golf theme (holes, par) stays in the text only. Don't use club or course art that implies a real golf brand.

## 3. Rules (verified)

**Cards:** one 52-card deck for **2–4 players**. **Two decks shuffled together for 5–6** (Pagat: add a pack above 4 players). There are no jokers.

**Card values**
| Card | Points |
|---|---|
| A | 1 |
| 2 | **−2** |
| 3–10 | face value |
| J, Q | 10 |
| K | **0** |

**Deal (each hole)**
- The dealer rotates clockwise each hole, and the first dealer is random.
- Each player gets 6 cards face down in **2 rows × 3 columns**. Slots 0–2 are the top row and 3–5 the bottom, so column `c` is slots `c` and `c+3`.
- The rest form the stock. The top card is turned face up to start the discard pile.

**Setup:** each player turns **any two** of their own cards face up, all at once (simultaneously). Nobody may look at their face-down cards, so they're unknown to everyone, including their owner.

**Turn** (clockwise, starting left of the dealer)
- **Draw from the stock.** The card is shown face up, then you either:
  - **swap** it into any one of your six slots (face-up or face-down, chosen without peeking), putting the replaced card face up on the discard pile, or
  - **discard** it with no other change (Pagat and Bicycle base rules: no flip is required).
- **Or take the top discard.** You **must** swap it into a slot, and the replaced card goes to the discard pile. You can't take the discard and put the same card straight back.

**End of hole**
- The hole ends **immediately** when any player's sixth card is face up, whether by swapping into their last face-down slot or by any other route. This is the Pagat base text, and Bicycle agrees.
- All remaining face-down cards are then turned up and scored. See the `finalTurns` toggle.

**Scoring a hole**
- For each column: if the two cards have **equal rank**, the column scores **0**. This includes a pair of 2s (0, not −4) and a pair of Kings. Otherwise the column scores the sum of its two values.
- The hole score is the sum of the three columns.

**Game:** 9 holes, and the **lowest total wins**. Ties share the win (`GameOver` places shared, as other games report ties).

**FAQ / ambiguity rulings (our defaults)**
| Question | Ruling |
|---|---|
| Does the hole end immediately, or does everyone get one more turn? | Immediately (Pagat base, Bicycle). Toggle `finalTurns`. |
| Must you flip a card after discarding a stock draw? | No (base). Toggle `flipOnDiscard`. |
| Do the two setup cards have any placement restriction? | None. They can be any two. |
| Can you replace a face-down card? | Yes, without seeing it first. The replaced card is revealed on the discard pile. |
| A pair of 2s in a column? | 0, not −4 (Pagat base). |
| Equal cards in the same row, not a column? | No effect. Only columns cancel. |
| What if the stock runs out? | Pagat doesn't say. Our ruling: shuffle the discard pile, except its top card, into a new stock. |
| With two decks, do identical cards (two 7♥) pair? | Yes. Pairing is by rank, so suit never matters. |
| Common misplay: thinking the hole ends only when *all* players are face up | The banner says "Ana turned her last card. Last hole card!" whenever it happens. |

## 4. Host options

There's no lobby options plumbing yet. Pass these through an `options` constructor argument with these defaults.

| Option | Default | Alternatives |
|---|---|---|
| `holes` | 9 | 18, or 5 (a short family round, house rule) |
| `finalTurns` | off | on: after a player turns their last card, **each other player gets one more turn**, then the hole ends. This is Pagat's popular variant and many families' default. |
| `flipOnDiscard` | off | on: after discarding a stock draw you must turn one face-down card up, unless only one remains (Pagat variant) |
| `fourOfAKind` | off | on: two columns that are both pairs of the same rank score **−10** (Pagat variant) |

`fourOfAKind` with two decks: if all three columns are pairs of the same rank, they still score −10 only once. Pagat's −20 for six of a kind isn't offered.

## 5. State model

```ts
import type { Card } from '@parlor/cards';

export type GolfPhase =
  | 'setup'        // everyone turns two cards up (simultaneous)
  | 'turn'         // active player chooses stock or discard
  | 'drawn'        // active player holds a stock card: swap or discard
  | 'flip'         // flipOnDiscard: must turn one face-down card
  | 'hole-scoring' // reveal ~6s: every grid face up with column scores
  | 'game-over';

export interface Slot { card: Card; faceUp: boolean }

export interface GolfOptions {
  holes: number; finalTurns: boolean; flipOnDiscard: boolean; fourOfAKind: boolean;
}

// Server-only state
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean;
  grid: Slot[];                 // length 6
  setupFlips: number;           // 0..2
  holeScores: number[];         // one per completed hole
  finalTurnTaken: boolean;      // finalTurns variant
}
interface GolfState {
  seats: Seat[]; phase: GolfPhase; hole: number; dealer: number; active: number;
  stock: Card[];                // two decks for 5–6 seats; duplicates are expected
  discard: Card[];
  drawn: Card | null;           // the stock card in the active player's hand
  wentOutId: string | null;     // who turned their last card (finalTurns)
}

// View: the same for every seat and spectators except the `my*` / `can*` fields
export interface GolfView {
  phase: GolfPhase; hole: number; holes: number;
  dealerId: string; activePlayerId: string | null; wentOutId: string | null;
  players: {
    id: string; name: string; bot: boolean; connected: boolean;
    /** null = face down (unknown to everyone, the owner included). */
    grid: (Card | null)[];
    /** Score of the face-up cards so far (columns with a hidden card count only the visible card). */
    showing: number;
    holeScores: number[]; total: number;
    setupDone: boolean;
  }[];
  stockCount: number;
  discardTop: Card | null;
  /** The card the active player drew. Public, as at a real table where it's drawn face up. */
  drawn: Card | null;
  /** Viewer affordances (empty for spectators and non-active players). */
  setupFlipsLeft: number;               // setup only
  canDrawStock: boolean; canTakeDiscard: boolean; canDiscardDrawn: boolean;
  /** Slots the viewer may target now: swap targets, setup or `flip` picks. */
  targetSlots: number[];
  winnerIds: string[];
}
```

**Redaction:** face-down cards are `null` for **everyone**. The server never sends them until `hole-scoring`. That's the only secret, so no per-seat hand data exists. The stock order is never sent.

**Duplicate cards (two decks):** every action addresses **slot indexes** and **piles**, never a `Card` value, so duplicate 7♥s never cause ambiguity. Don't use `cardEquals` to look up a player's own cards.

**Phase machine**
```
deal → setup ─(all seats flipped 2)→ turn
turn ─draw-stock→ drawn ─swap→ (check out) → next turn
                       └discard-drawn→ (flipOnDiscard ? flip → (check out)) → next turn
turn ─take-discard(slot)→ (check out) → next turn
check out: a grid is all face up → hole-scoring           (finalTurns off)
           → finalTurns: mark wentOut, others get 1 turn each → hole-scoring
hole-scoring ─(hole < holes)→ deal (dealer + 1) ; else → game-over
```

## 6. Actions

`setup` is simultaneous. Everything else is turn-based for `activePlayerId` only.

| Action | Payload | Valid when | Effect |
|---|---|---|---|
| `reveal` | `{type, slot: 0–5}` | phase `setup`, the viewer's `setupFlips < 2`, the slot is face down | Flip it. When every seat has 2, the phase is `turn` (left of dealer). |
| `draw-stock` | `{type}` | phase `turn` | `drawn = stock.pop()`, phase `drawn`. If the stock is empty, reshuffle the discards except the top card first. |
| `take-discard` | `{type, slot: 0–5}` | phase `turn`, pile not empty | Pile top goes into the slot face up, and the old slot card goes face up onto the pile. This is atomic, so it can't be taken back. |
| `swap-drawn` | `{type, slot: 0–5}` | phase `drawn` | `drawn` goes into the slot face up, and the old card goes onto the pile. |
| `discard-drawn` | `{type}` | phase `drawn` | `drawn` goes onto the pile. With `flipOnDiscard` and ≥ 2 face-down slots, the phase is `flip`. Otherwise the turn ends. |
| `flip` | `{type, slot}` | phase `flip`, the slot is face down | Turn it up, then the turn ends. |

After each turn-ending action, run the end-of-hole check (§3), then move `active` to the next seat. With `finalTurns`, the hole ends when the turn would return to `wentOutId`.

`validateAction`: `hasExactKeys`, and `slot` an integer from 0 to 5. All the meaning checks live in the engine (`GameRuleError` before mutating).

**Reveal:** `hole-scoring` about **6000 ms**. Grids flip face up column by column on the client, and each column is labelled with its score.

## 7. Mapping to this codebase

- **Package** `games/golf` → `@parlor/golf`. Files per `docs/ADDING_GAMES.md` §1.
- **meta:** `minPlayers: 2, maxPlayers: 6, minutes: { min: 20, max: 30 }, kind: 'cards', weight: 'light', format: 'individual', tags: ['classic'], displayModes: ['peer'], supportsBots: true`.
- **rules.ts:** `golfValue(rank)`, `columnScore(top, bottom)`, `gridScore(grid, opts)`, `showingScore(grid)`, `isOut(grid)`. The board imports these to label columns.
- **Engine:** shape it like `games/oh-hell/src/engine.ts` (variable seats, rounds, `round-scoring` reveal → here `hole-scoring`). Copy `setConnected`/`automaticMove`/`view` from Hearts. The deck is `createDeck()`, doubled for 5–6, with `fisherYatesShuffle`.
- **Simultaneous setup:** like the Hearts `passing` phase. `automaticMove` resolves any automated seat that hasn't flipped, one seat per step.
- **Definition:** copy `games/hearts/src/definition.ts`. Steps:
  - The `hole-scoring` reveal takes about 6000 ms.
  - A bot's turn is **two scheduled steps** (draw, then about 700 ms later swap or discard), so humans see the drawn card.
  - `onPlayerRemoved` hands the seat to a stand-in. A grid can't just vanish mid-hole, and the scores need every seat.
- **Shared kit:**
  - `CardBoard`, `Felt`, `TurnBanner`, `Button`, `PlayingCard` (face-down = `faceDown`)
  - `SeatChip`: stat "12 total" / "showing 7"
  - `DrawPile` (stock), `GameOver` (detail "+14 (9 holes)")
- **Board-kit additions (flag):**
  1. **`DiscardPile`**: the same extraction from `games/crazy-eights/src/lib/components/game/Table.svelte` proposed in `GIN_RUMMY.md`. Whichever game lands first builds it in `packages/ui/src/lib/cards/`.
  2. **`CardGrid`**: a `rows × cols` grid of `PlayingCard`s with face-up and face-down cards, per-slot `playable` (mustard ring), and an `onpick(slot)` handler.
     - A `size` prop: `full` for your own grid, `mini` for opponents' grids.
     - An optional per-column caption ("0", "pair").
     - Golf needs it now. Future 4-, 8- or 9-card Golf variants and other tableau games would reuse it.
- **No `CardHand`:** Golf has no hand. The only "held" card is `drawn`, shown lifted on butter beside the piles.
- **App wiring:** the six places in ADDING_GAMES §7. Catalog: `{ ...golfMeta, shelf: 'felt', tagline: 'Swap cards to lower your score' }`. Add a `docs/GAMES.md` row.

## 8. Board UI

```
phone (390px)
┌──────────────────────────────────┐
│ TurnBanner: Your turn · Hole 4/9 │
│ "Draw, or take the K♠."          │
├──────────────────────────────────┤
│ opponents (scroll row of minis)  │
│ ┌Ana 18┐ ┌Bo 22┐ ┌Cy 9 ┐         │
│ │▢▢5   │ │K▢▢  │ │77▢  │  mini   │
│ │▢2▢   │ │▢▢▢  │ │▢▢Q  │  grids  │
│ └──────┘ └─────┘ └─────┘         │
│ ┌ Felt ────────────────────────┐ │
│ │ [stock 30] [K♠ discard] [drawn]│
│ └──────────────────────────────┘ │
│ Your grid (CardGrid full, 2×3)   │
│   [ 4♦ ][ ▢ ][ ▢ ]               │
│   [ 4♣ ][ ▢ ][ J♥ ]   col "0"    │
│ Showing 10 · Total 31            │
│ [ Discard it ]  (only in drawn)  │
└──────────────────────────────────┘
desktop: opponent grids at mini size in a row across the top (up to 5), felt + your grid centred, scorecard (holes × players table) on the right.
```
- **Setup:** "Turn two cards face up." All six of your slots wear the mustard ring. One tap flips a card, with no confirm step. Any two cards are fine and both picks are required, so there's nothing to get wrong.
- **Your turn:** the stock and discard both wear the mustard ring.
  - **Tap the stock** to draw. The card appears lifted on butter, every slot gets the ring, and an outline "Discard it" pill appears.
  - **Tap the discard pile** to lift it on butter (no server call yet), then tap a slot. The client sends `take-discard {slot}`. Tapping the pile again cancels.
- **Second-tap rule for swaps:** the first tap on a slot lifts it and the banner says "Tap again to swap the 9 of Clubs for this card." The second tap swaps. Swapping into your **last face-down slot** ends the hole, so the banner warns: "This turns your last card and ends the hole."
- **Column feedback:** a matching pair shows a small "0" seal between the two cards.
- **Hole scoring:** every grid flips, the column totals count up, and a scorecard table appears (holes × players, lowest total in mustard). This replaces a generic round-score list. Keep it game-local; it's just a table.
- **Animations:** the drawn card flips from the stock, the swapped-out card slides to the discard, and the end-of-hole column-by-column reveal. All are cut under reduced motion.
- **Shelf colour:** **felt** (golf green, a natural fit). It follows President (ink) and Gin Rummy (clay) on the shelf, so its neighbours differ in both one- and two-column layouts. Quixx and Euchre are also felt but sit far apart. `--card-back`: felt. Play on the standard `Felt`. The card backs in the grid carry the felt colour, set against paper cards.

## 9. Bot AI

The bot uses an expected-value greedy policy with an unknown card estimated at **E = 5.5**, the deck average: (1 − 2 + (3+…+10) + 10 + 10 + 0) / 13 = 71/13 ≈ 5.5.
- **Setup:** flip slots 0 and 3 (one column). Seeing a column early helps it build pairs.
- **Turn:**
  1. **Discard top `d`:** if it pairs a face-up card whose column partner is face down or worth more than `d`, take it into that partner slot. Else if `golfValue(d) ≤ 2` (A, 2, K), take it into the slot with the highest value (face-up unpaired, or face-down at E). Otherwise draw from the stock.
  2. **Stock card `s`:** use the same pairing check. Else if `golfValue(s) ≤ 5`, swap it into the highest-value slot (unpaired face-up, or face-down at E) when that improves the slot by ≥ 1. Else discard it.
  3. **Going-out guard:** if a swap would turn the bot's last face-down card, do it only if its resulting hole score is ≤ every other player's `showing + E × faceDownCount`. Otherwise prefer an alternative (a face-up target, or discard).
  4. **`flipOnDiscard`:** flip a face-down card whose column partner is face up and low.
- Stand-ins for disconnected humans use the same policy.

## 10. Test plan

**Engine** (`apps/parlor/src/lib/server/golf.test.ts`, seeded):
- Deal: 2–4 seats use 52 cards, 5–6 seats use 104. Six cards each, the upcard is set, and the stock count is correct.
- Setup: two flips each. A third flip, or flipping a face-up card, is rejected with no state change. Play starts only when all seats are done. Bots flip automatically.
- Turn legality, each rejection leaving the state unchanged:
  - Discarding a card taken from the pile is impossible (there's no action for it)
  - `swap-drawn` in the `turn` phase is rejected
  - `draw-stock` twice is rejected
  - Acting out of turn is rejected
  - A slot outside 0–5 is rejected by `validateAction`
- Scoring:
  - Column pair = 0, including 2-2 and K-K
  - A, 2 = −1
  - J/Q = 10, K = 0
  - Row pairs don't count
  - `fourOfAKind` −10
- End of hole:
  - Immediate on the last flip, including the swap of the last face-down slot and the `flip` phase
  - With `finalTurns`, every other seat gets exactly one more turn, then scoring
- Stock exhaustion: reshuffle the discards except the top card, and play continues.
- Two decks: duplicate cards in one grid pair by rank, and actions by slot are unambiguous.
- Views: face-down cards are `null` for owner, opponent and spectator alike. `drawn` is visible to all. Affordances exist only for the active seat.
- Dealer and starting player rotate each hole. After 9 holes it's `game-over`, the lowest total wins, and ties share the win.
- A stand-in plays a disconnected seat, and nothing moves when all humans are gone.
- A seeded 6-bot game finishes without stalling, and the scores add up.

**Seeded socket playthrough:** add a 5-player (two-deck) game to `seededPlaythroughs.test.ts`.

**Playwright** (`e2e/golf.test.ts`, phone): rules modal, create a room, pick Golf, add a bot, start. Flip two cards. On your turn tap the stock, then tap a face-down slot twice. Assert that slot now shows a card and the banner shows the bot's turn.

## 11. Open questions for the human

1. **End-of-hole rule:** the published default (immediate end) can feel abrupt to people who learned the "everyone gets one more turn" house rule. Should we keep the published default and expose `finalTurns`, or default it on? (Recommend the published default plus a clearly named toggle.)
2. **Host options plumbing** doesn't exist yet. Ship the defaults hard-coded for now?
3. **Max players:** Pagat allows more with two or three decks. Should we cap at 6 for phone layout (recommended), or allow 7–8?
4. **Jokers** (−5 or −2 in popular variants) need joker support in `@parlor/cards`. Is that out of scope for now?

## 12. Sources

- Pagat, *Golf*: https://www.pagat.com/draw/golf.html (primary: six-card rules, deck count by players, values, column pairs, 9 holes, all variants)
- Bicycle, *Six Card Golf*: https://bicyclecards.com/how-to-play/six-card-golf (confirms values, column pairs, the hole ending when a player's cards are all face up, and 9 holes)
