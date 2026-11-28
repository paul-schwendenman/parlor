# Gin Rummy

> Implementation brief, 2026-11-27. Rules verified against Pagat (primary). Parlor ships the standard 100-point game. The engine supports variants, and the lobby currently uses the defaults.

## 1. Overview

Gin Rummy is the two-player draw-and-discard rummy game. Each player holds 10 cards and tries to form sets and runs. You can knock once your unmatched cards total 10 or less, or go gin with none. Hands are 3–6 minutes and a game to 100 takes 20–40 minutes. **2 players only.** Display mode: **peer**, since both hands are hidden. It fits Parlor because it's the best-known two-player card game in the US. Today a pair has only Crazy Eights, Kings Corner and the dice games, and nothing with real strategy. It suits a couple or a grandparent and grandchild playing remotely, and a bot can fill the other seat for solo play. The meld engine (deadwood search, layoffs) can be reused later for Rummy 500 or Rummy (3–6).

## 2. Naming & IP

- **Name: "Gin Rummy"** (`id: gin-rummy`). It's a traditional public-domain game (around 1909) with no trademark concerns.
- Don't use "Oklahoma Gin" branding from any app, or copy text from the Gin Rummy Association or Hoyle. Rules are paraphrased below.
- Standard French-suited cards, drawn with the shared `PlayingCard`.

## 3. Rules (verified)

**Cards:** one 52-card deck, no jokers. **Aces are always low.** A-2-3 is a run and Q-K-A is not. Values: A=1, 2–10 at face value, J/Q/K=10.

**Melds**
- **Set:** 3 or 4 cards of the same rank.
- **Run:** 3 or more consecutive cards of the same suit.
- Each card can be in only one meld. **Deadwood** is the total value of the cards not in any meld. The engine always uses the arrangement with the lowest deadwood.

**Deal**
- The first dealer is random (instead of a cut). After that, **the winner of the previous hand deals**. After a void hand, the same dealer deals again.
- Each player gets 10 cards. The 21st card is turned face up to start the discard pile (the **upcard**). The rest form the stock.

**First turn (upcard offer)**
1. The non-dealer may take the upcard or pass.
2. If they pass, the dealer may take it or pass.
3. Whoever takes it then discards, and play continues with the other player.
4. If both pass, the non-dealer must draw from the **stock**, then discards, and normal play begins.

**Normal turn**
1. **Draw** the top card of the stock or of the discard pile.
2. **Discard** one card face up, or **knock** (below).
- If you took the top discard this turn, you can't discard that same card. You can discard a card taken from the pile on an earlier turn.

**Knocking**
- In place of a normal discard, you may knock. You discard one card face down, and the 10 cards left must have **deadwood of 10 or less**. Knocking is never required.
- **Gin:** knocking with 0 deadwood.
- The hand ends. The knocker's hand is spread with the arrangement chosen by the engine. Its melds are the lowest-deadwood arrangement. If several arrangements tie, the engine picks the one that gives the defender the fewest layoff points.
- **Defender:** spreads their own melds, then **lays off** deadwood cards onto the knocker's melds. A set can grow to 4 cards. A run can be extended at either end, and a card laid off on a run can itself be extended (lay off 8♠ then 9♠ on 5-6-7♠).
  - Cards can't be laid off on the knocker's deadwood.
  - Nothing can be laid off after a gin.
  - The knocker never lays off on the defender's melds.
  - The engine computes the defender's best melds plus layoffs automatically (see §7 algorithm). Lower is always better, so there's no choice to make.

**Hand scoring**
| Outcome | Who scores | Points |
|---|---|---|
| Knock, knocker's deadwood < defender's (after layoffs) | Knocker | difference |
| Knock, knocker's deadwood ≥ defender's (**undercut**) | Defender | difference + **10** (`undercutBonus`) |
| Gin | Knocker | **20** (`ginBonus`) + defender's deadwood (no layoffs). A gin can't be undercut. |
- A tie in deadwood counts as an undercut, so the defender scores the 10-point bonus.

**Stock exhaustion (void hand):** the player who draws the card that leaves **2 cards in the stock** may still knock or go gin. If they discard without knocking, the hand is void. Nobody scores, nothing counts toward the box bonus, and the same dealer redeals.

**Game end and bonuses** (Pagat standard)
- The game ends when a player's running total of hand scores reaches **100** or more at the end of a hand.
- That player gets the **game bonus of 100**.
- **Shutout:** if the loser scored nothing all game, the game bonus is 200.
- **Box (line) bonus:** 20 per hand won, for both players. It's added at the end and doesn't count toward reaching 100.
- Final score = hand points + box bonuses + game bonus. The winner is always the player who reached 100. The final scores show the margin. Nobody settles money.

**FAQ / ambiguity rulings (our defaults)**
| Question | Ruling |
|---|---|
| Discard the card just taken from the pile? | Not allowed (Pagat standard). Taking it from the stock and discarding it is fine. |
| Can the 50th-card drawer knock? | Yes. It's only void if they discard without knocking. |
| Who arranges the melds? | The engine, using the lowest-deadwood arrangement for both players. Humans never lose points to a bad arrangement. |
| Knock with 11 cards (no discard)? | Not allowed by default. See the Big gin toggle. |
| Must you knock when you're able to? | Never. |
| Can a set of 4 be split to help a run? | The engine considers every arrangement, so yes when it lowers deadwood. |
| Both players reach 100 in one hand? | Impossible, since only one player scores per hand. |
| Common misplay: thinking K-A-2 or Q-K-A is a run | The view's `deadwood` hint shows what really counts. |

## 4. Host options

There's no per-game options plumbing in Parlor yet (`RoomManager` has none). Put the options in an `options` constructor argument with these defaults, and show them in the lobby once the platform supports it. See §11.

| Option | Default | Values |
|---|---|---|
| `target` | 100 | 100 / 150 / 250 |
| `knockLimit` | 10 | fixed 10, or `oklahoma` (the upcard's value sets the limit: picture cards = 10, **ace = gin only**; a spade upcard doubles the hand score) |
| `ginBonus` / `undercutBonus` | 20 / 10 | 25 / 25 ("modern" scoring) |
| `bigGin` | off | on: after drawing, if all 11 cards meld you may declare Big gin for 31 + defender's deadwood, with no discard. This is a common house rule that Pagat doesn't define, so it stays off. |
| `boxBonus` | on | off |

## 5. State model

```ts
// types.ts
import type { Card } from '@parlor/cards';

export type GinPhase =
  | 'upcard'        // the upcard offer: activeId is the non-dealer, then the dealer
  | 'draw'
  | 'discard'
  | 'hand-scoring'  // reveal: both hands spread with layoffs, or a void hand
  | 'game-over';

export interface Meld { kind: 'set' | 'run'; cards: Card[] }

export interface HandResult {
  outcome: 'knock' | 'gin' | 'big-gin' | 'undercut' | 'void';
  knockerId: string | null;
  winnerId: string | null;          // null for a void hand
  points: number;
  knocker: { melds: Meld[]; deadwood: Card[]; deadwoodCount: number } | null;
  defender: { melds: Meld[]; layoffs: { card: Card; meldIndex: number }[];
              deadwood: Card[]; deadwoodCount: number } | null;
}

export interface GinOptions {
  target: number; knockLimit: number | 'oklahoma'; ginBonus: number;
  undercutBonus: number; bigGin: boolean; boxBonus: boolean;
}

// Server-only state (engine.ts)
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean;
  hand: Card[];                 // 10, or 11 between draw and discard
  score: number;                // running total, without box or game bonus
  handsWon: number;
}
interface GinState {
  seats: [Seat, Seat];
  dealer: 0 | 1; active: 0 | 1; phase: GinPhase;
  stock: Card[]; discard: Card[];        // discard.at(-1) is the top card
  upcardPasses: number;                  // 0..2 during 'upcard'
  stockOnly: boolean;                    // the non-dealer's forced stock draw after both pass
  takenFromDiscard: Card | null;         // can't be discarded this turn
  knockLimit: number;                    // fixed for the hand (Oklahoma)
  doubled: boolean;                      // Oklahoma spade upcard
  lastResult: HandResult | null;
  handNumber: number;
  final: { id: string; hand: number; box: number; game: number; total: number }[] | null;
}

// Per-player view
export interface GinView {
  phase: GinPhase;
  handNumber: number; target: number; knockLimit: number; doubled: boolean;
  dealerId: string; activePlayerId: string | null;
  players: { id: string; name: string; bot: boolean; connected: boolean;
             cardCount: number; score: number; handsWon: number }[];
  stockCount: number;
  discardTop: Card | null;
  discardCount: number;
  myHand: Card[];                        // engine-sorted by suit, then rank
  /** Viewer's best arrangement now (also shown while waiting). */
  myMelds: Meld[]; myDeadwood: number;
  canTakeDiscard: boolean; canDrawStock: boolean; canPassUpcard: boolean;
  /** Cards that may be discarded (excludes the card just taken from the pile). */
  discardable: Card[];
  /** Cards whose discard leaves deadwood <= knockLimit (empty when you can't knock). */
  knockable: Card[];
  canBigGin: boolean;
  /** The opponent's discard-pile takes this hand (public information, shown as a hint). */
  opponentTook: Card[];
  lastResult: HandResult | null;         // set in hand-scoring and game-over
  final: GinState['final'];
  winnerIds: string[];
}
```

**Redaction:** a seat sees only its own `myHand`, `myMelds` and the `can*` lists. The opponent and spectators see only `cardCount`. Spectators get `myHand: []` and empty lists. Both hands become public only in `lastResult` during `hand-scoring`. The stock order is never sent.

**Phase machine**
```
deal → upcard ─take→ discard → draw (other player) ↺
          └─both pass→ draw (non-dealer, stockOnly) → discard → draw …
discard ─knock/gin→ hand-scoring ─(score < target)→ deal (winner deals)
discard ─no knock and stock == 2→ hand-scoring (void) → deal (same dealer)
hand-scoring ─(someone ≥ target)→ game-over
```

## 6. Actions

All are turn-based. Only `activePlayerId` may act.

| Action | Payload | Valid when | Effect |
|---|---|---|---|
| `take-discard` | `{type}` | phase `upcard` or `draw`, `!stockOnly`, pile not empty | Card goes to hand, `takenFromDiscard` is set, phase becomes `discard` |
| `pass-upcard` | `{type}` | phase `upcard` | Non-dealer passes: the dealer is active. Dealer passes: the non-dealer is active, phase `draw`, `stockOnly=true` |
| `draw-stock` | `{type}` | phase `draw` (stock > 2 is always true here) | Top stock card goes to hand, phase `discard` |
| `discard` | `{type, card}` | phase `discard`, card in hand, card ≠ `takenFromDiscard` | To pile. If the stock now has 2 cards, it's a void hand. Otherwise the other player is active, phase `draw` |
| `knock` | `{type, card}` | phase `discard`, valid discard, deadwood of the other 10 ≤ `knockLimit` | Card goes face down (not on the pile). Score as gin if deadwood is 0, otherwise as a knock. Phase `hand-scoring` |
| `big-gin` | `{type}` | `options.bigGin`, phase `discard`, the 11 cards have 0 deadwood | Scores 31 + defender's deadwood |

`validateAction` uses `hasExactKeys` and `parseCard`, as in `games/hearts/src/definition.ts`. Reveal: `hand-scoring` holds for about **7 s** (longer than Hearts' 5.5 s, because both spreads and layoffs have to be read). Then `advanceReveal()` deals the next hand or finishes the game.

## 7. Mapping to this codebase

- **Package** `games/gin-rummy` → `@parlor/gin-rummy`. Files per `docs/ADDING_GAMES.md` §1: `types.ts`, `meta.ts`, `rules.ts`, `engine.ts`, `definition.ts`, `GameView.svelte`. Copy `tsconfig.json`/`turbo.json` from `games/hearts`.
- **meta:** `minPlayers: 2, maxPlayers: 2, minutes: { min: 20, max: 40 }, kind: 'cards', weight: 'medium', format: 'individual', tags: ['classic', 'melding'], displayModes: ['peer'], supportsBots: true`.
- **rules.ts** (pure, importable on the client):
  - `cardValue`
  - `allMelds(hand)`: every set of 3, every 3-card subset of a 4-set, and every contiguous run of length ≥ 3 inside each suit (ace low)
  - `bestArrangement(hand)`: depth-first search over disjoint melds, minimizing deadwood. Use meld bitmasks over at most 11 cards. This is fast enough with no memoization.
  - `layOff(knockerMelds, defenderHand)`: for each arrangement of the defender's own melds (including non-maximal ones), lay off the leftovers repeatedly until nothing changes, trying run ends before sets. Return the minimum.
  - `scoreHand(...)`
- **Engine:** model it on `games/hearts/src/engine.ts`. Copy its seat shape, `setConnected`, `automaticMove()` (stand-ins pause when no connected human remains), `view(id?)` and `advanceReveal()`. Use `fisherYatesShuffle` and `secureRandomInt` from `@parlor/multiplayer/random`, as Hearts does.
- **Definition:** copy `games/hearts/src/definition.ts`. `drive()` uses the reveal delay of about 7000 ms for `hand-scoring` and 400–700 ms for bot moves. A bot draws and discards as two scheduled steps, so the human sees the draw happen. `onPlayerRemoved` hands the seat to a stand-in, as Hearts does, because the game needs both seats.
- **Shared kit:** `CardBoard`, `Felt`, `TurnBanner`, `SeatChip` (stat "62 pts · 10 cards"), `CardHand` (single-select, two taps), `DrawPile` (stock), `PlayingCard`, `Button`, `GameOver` (standings detail "148 (incl. 100 game, 60 box)").
- **Board-kit additions (flag):**
  1. **`DiscardPile`**: the top card face up, a face-down card tilted beneath it, a mustard ring when takeable, `ontake`. Crazy Eights draws this inline today (`games/crazy-eights/src/lib/components/game/Table.svelte`, lines ~40–50). Under the Collection Rule it should be extracted, and Golf needs it too.
  2. **`MeldSpread`**: a row of meld groups, each a tight overlapping fan, with deadwood shown faded and separated. Laid-off cards wear `marked`. Used in Gin's scoring reveal and in the "your melds" strip. Rummy 500 would reuse it.
- **App wiring:** the six places in ADDING_GAMES §7. Add `{ ...ginRummyMeta, shelf: 'clay', tagline: 'Meld sets and runs, then knock' }` to `apps/parlor/src/lib/games/catalog.ts`. Add a row to `docs/GAMES.md` (the implementer does this, not this brief).

## 8. Board UI

```
phone (390px)                          desktop (≥900px)
┌──────────────────────────────┐       ┌───────────────────────────────────────────┐
│ TurnBanner: Your turn        │       │ TurnBanner                                │
│ "Draw from the stock or      │       ├───────────────┬───────────────────────────┤
│  take the 7♥."               │       │ SeatChip opp  │  Felt                     │
├──────────────────────────────┤       │  10 cards     │  [stock] [7♥ discard]     │
│ (Ana) 10 cards · 42 pts      │       │ SeatChip you  │                           │
│ ┌ Felt ─────────────────────┐│       │  62 pts       │  opponent's back fan      │
│ │ [stock 31]   [7♥]         ││       │ Score 62–42   │                           │
│ └───────────────────────────┘│       │ to 100        ├───────────────────────────┤
│ Melds: [5♠6♠7♠] [Q♦Q♣Q♥]     │       │               │ MeldSpread (your melds)   │
│ Deadwood 9 · can knock       │       │               │ CardHand (10–11 cards)    │
│ CardHand (overlapped, 11)    │       │               │ [DISCARD] [KNOCK]         │
│ [ DISCARD ]   [ Knock ]      │       └───────────────┴───────────────────────────┘
└──────────────────────────────┘
```
- **Draw:** the stock (`DrawPile`) and `DiscardPile` both wear the mustard ring. One tap draws, with no confirm step because a draw is cheap and expected.
- **Discard:** tap a card to lift it, and the banner says "Tap the 9 of Clubs again to discard it." A second tap discards. If that card is in `knockable`, an outline **Knock** pill appears; it shouts **GIN** when deadwood would be 0. Knock is a deliberate tap on the lifted card's pill, never a double tap, because it ends the hand.
- **Hand order:** the engine sorts by suit and rank. Add a small "Sort: suit / melds" pill in game-local state. The "melds" order groups melds left to right with deadwood at the end. Players don't need drag-to-reorder.
- **Hints:** the deadwood count under the melds is always visible. The opponent's pile takes show as small chips ("Ana took 8♦, Q♣"), which is fair public information and helps newer players.
- **Scoring reveal:** two `MeldSpread`s stacked (knocker on top). Laid-off cards slide from the defender's row onto the knocker's meld with `marked`. Then a one-line result ("Undercut! Ana scores 14 + 10") and the running score.
- **Animations:** a card flies from the pile to the hand, the discard flips onto the pile, and layoffs slide in the reveal. All are cut under reduced motion.
- **Shelf colour:** **clay** (`--card-back` Deep Clay, after classic red-backed gin decks). It sits next to Oh Hell (mustard) and two places after Euchre (felt), so it stays distinct in both shelf layouts. Play on standard `Felt`.

## 9. Bot AI

The bot is a simple greedy player using `bestArrangement`:
1. **Upcard or draw:** take the discard if it lowers the bot's best deadwood after its best discard by ≥ 1 *and* the card joins a meld (not just as low deadwood). Otherwise draw from the stock. When declining the upcard, pass.
2. **Discard:** among `discardable`, pick the card that minimizes the resulting deadwood. Break ties in this order:
   - avoid cards that could complete a meld for the opponent (same rank as, or ±1 same suit of, a card in `opponentTook`)
   - discard higher value first
   - keep cards that are part of a partial meld (a pair or 2-card run)
3. **Knock:** always go gin when possible. Knock whenever deadwood ≤ limit, unless it's early (stock > 20) and deadwood > 6 (an undercut risk). A simple rule is enough.
4. Stand-ins for a disconnected human use the same policy (as in `automaticMove` in Hearts).

## 10. Test plan

**Engine and rules** (`apps/parlor/src/lib/server/gin-rummy.test.ts`, seeded `RandomInt`):
- `bestArrangement`:
  - A-2-3 is a run, and Q-K-A and K-A-2 are not
  - A card shared by a set and a run is assigned the way that minimizes deadwood (7♠7♥7♦ + 5♠6♠ → run 5-6-7♠ + leftover 7s vs set; pick the lower)
  - A 4-set split to make a run
  - Two 5-card runs make gin
- Layoff:
  - Onto a set to make 4
  - Onto both ends of a run
  - A chained layoff (8♠ then 9♠)
  - A card that could go on a set or a run prefers the run when that enables another
  - No layoff after gin
  - No layoff onto deadwood
- Scoring: a knock win, an undercut (equal deadwood is an undercut), and gin = 20 + deadwood
  - Oklahoma: the knock limit comes from the upcard, an ace upcard means gin only, a spade doubles
  - Game bonus, shutout 200, and box bonus excluded from the 100 check
- Upcard offer: non-dealer takes, dealer takes, both pass (then a discard-pile draw is rejected because of `stockOnly`)
- Rejections leave the state unchanged:
  - discarding the card just taken from the pile
  - knocking with deadwood 11
  - acting out of turn
  - drawing twice
  - `take-discard` during the `discard` phase
- Void hand: the player at 2 stock cards discards → no score, same dealer. Knocking at 2 stock cards is allowed.
- The winner deals next.
- Views:
  - The opponent's and spectator views contain no hand cards and no stock
  - `knockable` and `discardable` exist only for the active seat
  - `lastResult` reveals both hands only in `hand-scoring`
- A stand-in plays for a disconnected seat. With both seats disconnected, nothing moves.
- A full seeded bot-vs-bot game reaches `game-over` and the totals add up.

**Seeded socket playthrough:** add it to `seededPlaythroughs.test.ts`.

**Playwright** (`apps/parlor/e2e/gin-rummy.test.ts`, phone viewport, modelled on `e2e/spades.test.ts`): open the rules, create a room, pick Gin Rummy, add a bot, start, pass or take the upcard, then tap a hand card twice to discard. Assert the hand count is back to 10 and the banner shows the bot's turn.

## 11. Open questions for the human

1. **Host options:** Parlor has no lobby options mechanism. Should these brief's defaults ship hard-coded until a shared "House rules" panel exists?
2. **Auto-arranging melds** is friendlier than manual, but it removes the (rare) tactic of arranging to block layoffs. Is that OK? (Recommend yes.)
3. Should the box and game bonuses show in the standings, or only the raw race to 100? (Recommend the bonuses be shown, Pagat standard.)

## 12. Sources

- Pagat, *Gin Rummy*: https://www.pagat.com/rummy/ginrummy.html (primary: deal, upcard offer, knocking, layoffs, undercut, bonuses, 50th-card rule, Oklahoma variant)
