# President

> Implementation brief, 2026-11-27. Rules verified against Pagat (primary). Parlor ships the fixed-seat, 11-point default. The engine supports variants, and the lobby currently uses the defaults.

## 1. Overview

President is a "climbing" shedding game. Players take turns beating the last play with a higher single, pair, triple or four of a kind, and the first to empty their hand becomes President. Finishing order sets social ranks, and those ranks carry into a card exchange that favours the winners next hand. The table talk ("Long live the President") is half the fun. **4–7 players**, 30–45 minutes to 11 points. Display mode: **peer**, since hands are hidden. It fits Parlor because it's the go-to game for groups of friends, students and families, and it's easy to learn in one hand. Parlor has nothing else for 6–7 people: only Oh Hell and the dice games seat 6, and nothing seats 7. It also adds a mechanic the shelf lacks (climbing, sets, a pass rotation) using a single deck.

## 2. Naming & IP

- **Name: "President"** (`id: president`). It's a traditional public-domain game with no trademark issues.
- **Do not use** the vulgar alternate name ("Asshole") or "Scum" anywhere in the product. Parlor is mixed-age.
- **Titles:** **President** (1st), **Vice President** (2nd), **Citizen** (everyone in the middle), **Vice Peasant** (second to last, only named when the two-card exchange is on), **Peasant** (last). "Peasant" comes from Pagat's European title list.
- Don't copy any commercial rule card or app wording. Rules are paraphrased.

## 3. Rules (verified)

**Cards:** one 52-card deck, no jokers. **Rank, high to low: 2, A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3.** Suits don't matter.

**Deal:** deal all 52 cards one at a time, starting left of the dealer, so some players hold one more card than others. The first dealer is random. Later hands are dealt by the Peasant (cosmetic only, since the dealer has no effect except who gets the extra cards).

**Seats (Parlor default: fixed seats).** Pagat's basic game reseats players by rank each hand. Parlor uses Pagat's **fixed seats** variant: the seats and seat colours never move, and play is always clockwise in seat order. Remote players have no physical chairs, and moving avatars mid-game is confusing.

**Card exchange** (from hand 2 on, after the deal)
- The Peasant gives the President their **highest card**. This is forced, so the engine does it.
- The President then gives the Peasant **any one card** of their choice.
- Nobody else exchanges in the basic game.

**Leading**
- **Hand 1:** the player to the dealer's left leads.
- **Later hands:** the President leads after the exchange.
- A lead is any single card or any set of 2–4 cards of the same rank.

**Turns**
- Clockwise, each player still holding cards either **passes** or **plays** a combination with the **same number of cards** at a **strictly higher rank** than the play on the table.
  - A pair of 6s beats a pair of 5s.
  - A single K can't beat a pair, and three 7s can't beat a pair.
- **Passing is always allowed, and it doesn't lock you out.** You may play later in the same trick if it comes back to you (Pagat basic).
- Players who have gone out are skipped.

**Ending a trick**
- A trick ends when the last play stands and **every other player still holding cards has passed since it was made**. The cards are cleared, and whoever made that play leads the next trick.
- **If that player has gone out**, the lead passes to the next player clockwise from them who still holds cards. Pagat doesn't say this explicitly, so this is our ruling and the common convention.
- A 2 (or a set of 2s) can't be beaten by rank, but the trick still only ends when everyone else passes. It isn't an automatic clear in the basic game; see the toggle.

**Ending a hand**
- Going out (playing your last card) is always allowed, including by playing 2s.
- The first player to empty their hand is President, the next Vice President, and so on.
- When only one player still has cards, they are the Peasant and the hand ends. Their cards aren't played.

**Scoring** (Pagat's suggestion; President itself has no fixed scoring)
- President +2, Vice President +1, everyone else 0.
- The game ends at the end of the hand in which someone reaches **11**.
- The highest total wins. If totals tie, the better finish in the final hand wins.

**FAQ / ambiguity rulings (our defaults)**
| Question | Ruling |
|---|---|
| Can you play after passing in the same trick? | Yes (Pagat basic). Toggle: Australian "pass means out until the next lead". |
| Who leads when the trick winner went out? | The next player clockwise from them who still holds cards. |
| Can you beat a pair with three of a kind, or play an equal rank? | No. Same count, strictly higher rank. See toggles. |
| Can you lead or play a 2 to go out? | Yes. There's no "can't finish on a 2" rule by default. |
| Does the President choose which card goes back? | Yes, any card. The Peasant's card is forced (their highest). With tied highest ranks, give the first card in sort order (suit is irrelevant). |
| Must you play if you can? | No. Passing is always legal. |
| Do Vice President and Vice Peasant exchange? | Not in the basic game. See the two-card toggle. |
| Common misplay | Playing a single on a pair, or treating 2 as low. The view's `legalPlays` prevents both. |

## 4. Host options

There's no lobby options plumbing yet. Pass these through an `options` constructor argument with these defaults. See §11.

| Option | Default | Alternatives |
|---|---|---|
| `target` | 11 | 5 (quick) / 21 |
| `firstLead` | `left-of-dealer` | `three-of-clubs`: the holder of 3♣ leads hand 1, and the lead must include it |
| `exchange` | `one` | `two`: the Peasant gives their 2 highest and the President returns any 2, and with 4+ players the Vice Peasant gives their 1 highest to the Vice President, who returns 1 (Pagat variant) |
| `passIsOut` | off | on: once you pass, you can't play until the next trick starts |
| `twoClears` | off | on: a single 2 (or a set of 2s matching the count) ends the trick at once, and its player leads again (Pagat "single two wins") |
| `revolution` | off | on: four of a kind reverses rank order until the next four of a kind (Pagat variant) |

Jokers and the equal-play skip variants are left out, because `@parlor/cards` has no joker type.

## 5. State model

```ts
import type { Card, Rank } from '@parlor/cards';

export type PresidentPhase =
  | 'exchange'      // the President (and the VP with `two`) chooses cards to return
  | 'playing'
  | 'trick-cleared' // reveal: the winning play stays ~1.0s before clearing
  | 'hand-scoring'  // reveal: finishing order and titles, ~5.5s
  | 'game-over';

export type Title = 'president' | 'vice-president' | 'citizen' | 'vice-peasant' | 'peasant';

export interface Play { playerId: string; cards: Card[] }

export interface PresidentOptions {
  target: number; firstLead: 'left-of-dealer' | 'three-of-clubs';
  exchange: 'one' | 'two'; passIsOut: boolean; twoClears: boolean; revolution: boolean;
}

// Server-only state
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean;
  hand: Card[]; score: number;
  title: Title | null;                 // from the last hand; null in hand 1
  finishedAt: number | null;           // 1-based finishing place this hand
  passed: boolean;                     // since the current standing play
  owes: number; owed: number;          // exchange bookkeeping
  received: Card[];                    // cards received in this hand's exchange
}
interface PresidentState {
  seats: Seat[]; phase: PresidentPhase; hand: number; dealer: number; active: number;
  trick: Play[];                       // all plays this trick, oldest first
  leaderOfTrick: number;
  reversed: boolean;                   // revolution variant
  finishOrder: string[];
}

// Per-player view
export interface PresidentView {
  phase: PresidentPhase; hand: number; target: number; reversed: boolean;
  activePlayerId: string | null;
  players: { id: string; name: string; bot: boolean; connected: boolean;
             cardCount: number; score: number; title: Title | null;
             finishedAt: number | null; passed: boolean }[];
  /** The play to beat (null when leading), plus earlier plays for the stack. */
  trick: Play[];
  myHand: Card[];                      // sorted low → high by President rank
  received: Card[];                    // highlight with isMarked
  /** Legal plays for the viewer now: rank + allowed counts (1–4 when leading). */
  legalPlays: { rank: Rank; counts: number[] }[];
  canPass: boolean;
  /** Exchange: how many cards the viewer must give back now (0 = none). */
  mustReturn: number;
  /** Last exchange, public: who gave how many cards to whom (cards hidden). */
  exchanges: { from: string; to: string; count: number }[];
  winnerIds: string[];
}
```

**Redaction:** each seat sees only `myHand`, `received`, `legalPlays` and `mustReturn`. Spectators get empty versions. The identities of exchanged cards are private to the two players involved. Card counts, titles, the passed flags and the trick are public.

**Phase machine**
```
deal → (hand 1) playing
deal → (hand ≥ 2) auto-give Peasant's highest → exchange (President chooses) → playing
playing ─all others passed→ trick-cleared → playing (new lead)
playing ─only one player holds cards→ hand-scoring ─(max score < target)→ deal
hand-scoring ─(someone ≥ target)→ game-over
```

## 6. Actions

Turn-based. During `exchange`, only the seats with `mustReturn > 0` act. With `two`, the President and VP return in parallel.

| Action | Payload | Valid when | Effect |
|---|---|---|---|
| `return-cards` | `{type, cards: Card[]}` | phase `exchange`, the length equals `mustReturn`, distinct cards, all in hand | Cards move to the partner (marked as `received`). When all exchanges are done, the phase becomes `playing` with the President active. |
| `play` | `{type, cards: Card[]}` | phase `playing`, viewer active, 1–4 distinct cards in hand of one rank. Leading: any count. Otherwise: count equals the standing play's count and the rank is higher (or lower when `reversed`). Hand 1 with `three-of-clubs`: the lead includes 3♣. | Cards leave the hand, the play is pushed, all `passed` flags clear. If the hand is empty, set `finishedAt`. Then the effects in order: `twoClears` (ends the trick), `revolution` (four of a kind flips `reversed`), then advance to the next seat holding cards (skipping players who passed if `passIsOut`). If only one seat holds cards, it's `hand-scoring`. |
| `pass` | `{type}` | phase `playing`, viewer active, not leading | `passed = true`. If every other holder has passed since the standing play, it's `trick-cleared`, and the next leader follows the rule in §3. |

`validateAction`: `hasExactKeys`, and `parseCard` for each card with a dedupe check (as in the Hearts `pass-cards` validator). The engine checks hand membership and legality and throws `GameRuleError` before mutating anything.

**Reveal timings:** `trick-cleared` about 1000 ms, `hand-scoring` about 5500 ms.

**Turn-loop safety:** plays strictly increase within a trick, so a trick always ends. Also, if all other holders have passed but the standing play's owner has gone out, the trick clears instead of waiting for them.

## 7. Mapping to this codebase

- **Package** `games/president` → `@parlor/president`. Files per `docs/ADDING_GAMES.md` §1.
- **meta:** `minPlayers: 4, maxPlayers: 7, estimatedMinutes: '30-45', tags: ['cards','classic','party'], displayModes: ['peer'], supportsBots: true`. The `RoomManager` cap of 8 allows 7.
- **rules.ts:** `presidentRankValue(rank)` (3 = 0 … 2 = 12), `beats(play, standing, reversed)`, `legalPlays(hand, standing, opts)`, `titleFor(place, players, exchange)`, `scoreFor(place)`.
- **Engine:** model it on `games/oh-hell/src/engine.ts`, the variable-seat-count reference (validates counts against meta, deals by seat). Copy `automaticMove`/`setConnected`/`view` from Hearts.
- **Definition:** copy `games/hearts/src/definition.ts`. Reveals are `trick-cleared` (1000 ms) and `hand-scoring` (5500 ms), and bot moves take about 600 ms (a little slower than Hearts so humans can follow multi-card plays). `onPlayerRemoved` uses a stand-in, like Hearts.
- **Shared kit:**
  - `CardBoard`, `Felt`, `TurnBanner`, `Button`, `GameOver` (detail "11 pts · President ×4")
  - `SeatChip`: stat "President · 6 cards", "Out · 2nd", or "Passed"; `out` once finished
  - `CardHand` in **multi-select mode** (pass an array to `selected`, as the Hearts pass does) with `isMarked` for received cards
  - `PlayingCard`
- **Board-kit candidate (flag, game-local for now):** **`PlayStack`**, the current play fanned in the middle of the felt over the earlier plays of the trick (offset and dimmed), with the player's name under it. Keep it in `games/president/src/` until a second climbing game appears. `TrickTable` doesn't fit because it has one slot per seat.
- **App wiring:** the six places in ADDING_GAMES §7. Catalog: `{ ...presidentMeta, shelf: 'ink', tagline: 'Beat the last play, finish first' }`. Add a `docs/GAMES.md` row.

## 8. Board UI

```
phone (390px)
┌──────────────────────────────────┐
│ TurnBanner: Your turn            │
│ "Beat a pair of 9s, or pass."    │
├──────────────────────────────────┤
│ seats (wrap, up to 7):           │
│ (Ana) President·4  (Bo) Passed   │
│ (Cy) 9 cards  (you) 8   (Di) Out │
│ ┌ Felt ────────────────────────┐ │
│ │      [9♦][9♣]  ← PlayStack   │ │
│ │      Bo · pair of 9s         │ │
│ └──────────────────────────────┘ │
│ CardHand (multi-select, ≤13)     │
│ [ PLAY 2 JACKS ]     [ Pass ]    │
└──────────────────────────────────┘
desktop: seats in a left column (wide SeatChips with titles + scores), felt and hand on the right.
```
- **Selecting:** tapping a card selects it, and tapping a card of a **different rank** replaces the selection (one rank at a time). Tapping again deselects. Cards whose rank can't legally be played are dimmed. When leading, every rank is playable. When following, only ranks in `legalPlays` with a count ≥ the required count are playable.
- **Shortcut:** selecting the first card of a rank when a pair or triple is required auto-selects that many of the rank, and the player can swap which suits by tapping. Suits don't matter, so this is safe.
- **Confirm:** the shout button names the play ("PLAY 2 JACKS", "PLAY K") and is enabled only when the selection is legal. **Pass** is an outline pill. Multi-card plays always use the button, never the two-tap shortcut, per the multi-select convention in ADDING_GAMES §6.
- **Exchange:** the banner says "You're President. Give Ana one card back." The received card is `marked`, and there's a "GIVE BACK" shout button. A waiting Peasant sees "Ana is choosing a card to give you."
- **Hand end:** an order list with titles, "+2 / +1", and the running scores.
- **Animations:** played cards fly from the seat or hand to the felt, the trick slides off on clear, and titles stamp onto the seats at hand end. All are cut under reduced motion.
- **Shelf colour:** **ink** (espresso). It sits between Gin Rummy (clay) and Golf (felt), and differs from Oh Hell (mustard) two places back. `--card-back`: ink.

## 9. Bot AI

The bot uses a greedy "shed low, keep power" policy and groups its hand by rank (`count[r]`).
- **Leading:** play the lowest rank, with **all** cards of that rank. When holding ≤ 3 distinct ranks, lead the group that can't be beaten (2s, or a large set) last, so the bot finishes on it.
- **Following** a play of count `n`:
  - Candidates are ranks above the standing play with `count[r] ≥ n`.
  - Prefer `count[r] == n` (no breaking sets), then the lowest rank.
  - Only break a larger set, or play an A or 2, when the bot has ≤ 5 cards or the play would make it go out.
  - Otherwise pass.
- **Exchange (President):** give back the lowest card that isn't part of a pair or larger set (otherwise just the lowest).
- **`passIsOut` on:** the same policy applies, but the bot passes less readily (it plays the lowest legal rank even when that breaks a set below J).
- Stand-ins for disconnected humans use the same policy.

## 10. Test plan

**Engine** (`apps/parlor/src/lib/server/president.test.ts`, seeded):
- The deal spreads 52 cards unevenly: 4p 13 each, 5p 11/11/10/10/10, 7p 8×3 + 7×4.
- Hand 1 lead: left of dealer, and with `three-of-clubs` the holder leads and a lead without 3♣ is rejected.
- Legality, with each illegal play throwing and leaving the state unchanged:
  - Single over single, and a pair can't beat a single
  - Triple vs pair, and an equal rank is rejected
  - 2 beats A
  - Mixed ranks rejected, a card not in hand rejected, duplicate cards rejected, acting out of turn rejected
- Passing then playing in the same trick is allowed, and rejected with `passIsOut`.
- Trick end: all other holders pass and the last player leads. **The trick winner went out**, so the next holder clockwise leads. Players who are out are skipped in turn order.
- Hand end: the last holder becomes Peasant, titles are correct for 4 and 7 players, and scores are +2/+1/0.
- Exchange:
  - The Peasant's highest goes automatically (tied highest handled)
  - The President must return exactly 1 (or 2 with `two`)
  - The VP and Vice Peasant swap with `two` and 4+ players
  - Other seats can't act during the exchange
  - Received cards are visible only to the receiver
- Variants:
  - `twoClears` ends the trick with the same leader
  - `revolution` flips the comparison, and a second four of a kind flips it back
- Game end: reaching 11 ends the game at hand end, and ties are broken by the last hand's finish.
- Views:
  - No hand cards in other views
  - `legalPlays` only for the active seat
  - Spectators see counts only
- Stand-in: a disconnected seat plays. All humans gone pauses play.
- A seeded 7-bot game reaches `game-over` (no infinite trick).

**Seeded socket playthrough:** add it to `seededPlaythroughs.test.ts` (5 players, so the deal is uneven).

**Playwright** (`e2e/president.test.ts`, phone): rules modal, create a room, pick President, add 3 bots, start. On your lead, tap the lowest card and press PLAY. Assert the card is on the felt and the hand shrank by one. Alternatively press Pass when following.

## 11. Open questions for the human

1. **Host options plumbing** doesn't exist. Should the Pagat-basic defaults ship until a shared "House rules" panel lands?
2. **Fixed seats** instead of reseating by rank is a deliberate deviation for remote play. Is that OK? (Recommend yes.)
3. **3 players:** Pagat says 4–7, but plenty of groups play with 3. Should `minPlayers` be 3 (a bot fills the 4th seat otherwise)?
4. **Peasant wording:** is "Peasant" right for the family audience, or should it be something softer like "Last place"?

## 12. Sources

- Pagat, *President*: https://www.pagat.com/climbing/president.html (primary: ranking, sets, passing, trick end, titles, exchange, scoring suggestion, all variants above)
- Pagat, *Climbing games index*: https://www.pagat.com/climbing/ (context for the climbing family and the related games Big Two and Tichu)
