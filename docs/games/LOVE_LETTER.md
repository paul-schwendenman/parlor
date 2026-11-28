# Love Letter: implementation brief

> *Love Letter* by Seiji Kanai (2012; AEG 2012–2018; Z-Man Games 2019 2nd edition). Package `@parlor/love-letter`, id `love-letter`. Original game and card names, Parlor's own art and wording (§2).

## 1. Overview

Each player holds **one secret card**. On your turn you draw a second card and play one of the two. Every card is a member of the royal court with a value from 0 to 9, and playing it does something: guess someone's card to knock them out, peek at a hand, compare hands, swap hands, or hide. A round ends when one player is left, or when the deck runs out and the highest card wins. Win rounds (and the occasional Spy bonus) to collect tokens, and the first to the target wins. **2–6 players** (21-card 2019 deck, the default) or **2–4** (16-card classic deck). **15–25 min** for a game, 2–4 min per round. **Peer mode** (each phone holds one hidden card; Jackbox host screen later, see §11). It suits Parlor well. Turns take a few seconds and the rules fit on one card. It plays from 2 to 6 people, kids can play it, and it has deduction to talk about. Bots fill seats easily. A player who is knocked out waits at most a couple of minutes for the next round.

## 2. Naming & IP

Current policy: Parlor uses the real game name and the original card names, as it already does with Quixx. The rename rule in `docs/LEGAL.md` is now a step to take before any public launch, not current policy (see §11).

- **Name:** "Love Letter". Id `love-letter`, package `@parlor/love-letter`.
- **Card names:** the originals for both decks: Spy, Guard, Priest, Baron, Handmaid, Prince, Chancellor, King, Countess, Princess. Players win **tokens of affection**.
- **Ours, never copied:** card art, card frames, layout, icons, and all rules and effect wording. Parlor draws its own stroke-icon glyphs in the Game Box Lid style. Rules text (RulesModal, card effect lines, banners) is paraphrased in Parlor's plain voice. **Never copy rulebook or reference-card text verbatim.** Every rules line in this doc is a paraphrase.
- **Don't use** the Tempest story or flavour text (named characters such as Princess Annette), or the publishers' logos or trade dress.

| Value | Card | Copies (2019 / classic) | Effect (Parlor wording) |
|---|---|---|---|
| 0 | **Spy** | 2 / 0 | No effect when played. At round end, if you are the only player still in with a Spy on your trail, you get +1 token. |
| 1 | **Guard** | 6 / 5 | Pick another player and name any card except Guard. If that's their card, they're out. |
| 2 | **Priest** | 2 / 2 | Pick another player and secretly see their card. |
| 3 | **Baron** | 2 / 2 | You and another player privately compare cards. The lower one is out. A tie does nothing. |
| 4 | **Handmaid** | 2 / 2 | Until your next turn, other players' cards can't pick you. |
| 5 | **Prince** | 2 / 2 | Pick any player, yourself included. They throw away their card (no effect) and draw a fresh one. |
| 6 | **Chancellor** | 2 / 0 | Draw 2, keep 1 of your 3 cards, and tuck the other 2 under the deck in the order you like. |
| 7 | **King** | 1 / 1 | Swap cards with another player. |
| 8 | **Countess** | 1 / 1 | No effect. If your other card is the King or a Prince, you have to play her. |
| 9 | **Princess** | 1 / 1 | If she leaves your hand by being played or discarded, you're out. |

## 3. Rules (verified)

Sources: Z-Man 2019 rulebook (via RulesPal summary + nastol.io PDF), AEG 2012 rulebook PDF (text extracted), Wikipedia, BGA. Card values below are the **2019 numbering** for both decks. The 2012 deck printed King 6 / Countess 7 / Princess 8, which gives the same order and the same play. The Z-Man rulebook's own "Classic" variant also keeps the 2019 numbers.

### 3.1 Editions

| | **Standard (default)**: 2019, 21 cards | **Classic** (option): 16 cards |
|---|---|---|
| Players | 2–6 | 2–4 |
| Deck | 0×2, 1×6, 2×2, 3×2, 4×2, 5×2, 6×2, 7, 8, 9 | 1×5, 2×2, 3×2, 4×2, 5×2, 7, 8, 9 (2019 deck minus 1 Guard, 2 Chancellors, 2 Spies) |
| Tokens to win | 2p 6 · 3p 5 · 4p 4 · 5p 3 · 6p 3 | same table (2019 Classic variant). The 2012 printing used 2p 7 (see option `classicTargets`) |
| Tie when the deck runs out | All tied players win the round | Same by default. The 2012 printing breaks ties by the highest total of discarded values (option `tieBreak`) |

**Recommendation: the 2019 deck (`standard`) as the default.** It covers the whole 2–6 range a Parlor lobby can have, it is the edition sold today, and Spy and Chancellor add decisions without adding complexity. Classic is a host option for 2–4 players. It plays tighter and is the "original" for people who know it. Supporting both costs very little: one deck-composition table, plus hiding Spy and Chancellor from the guess picker.

### 3.2 Setup (each round)

1. Shuffle the edition's deck.
2. Set aside the top card **face down**. Nobody sees it.
3. **2 players only:** set aside 3 more cards **face up**. Everyone sees them, and they are out of the round.
4. Deal 1 card to each player in the game.
5. First player: in round 1, a random seat (the printed start-player rules depend on facts about the players, which an online game can't check). In later rounds, the previous round's winner. If several players won, a random one of them. If that player has left, the next seat clockwise.

### 3.3 Turn

1. Your Handmaid protection (if any) ends.
2. **Draw** the top card (automatic; you now hold 2). The deck is never empty at the start of a turn, because the round ends as soon as a turn ends with an empty deck. The Chancellor never shrinks the deck (see below).
3. **Play** one of your 2 cards face up onto your trail. You must apply its effect, even if it hurts you.
   - **Countess forced:** holding Countess + King or Countess + Prince, you must play the Countess. Nobody else learns your other card.
   - Playing the **Princess** voluntarily is legal and knocks you out. The UI asks for confirmation (§8).
4. Resolve the effect (table in §2), then the turn passes clockwise to the next seat still in.

**Targeting.** "Choose another player" means a player who is still in the round, not protected by a Handmaid, and not you. The Prince may also choose you.
- If **no** other player can be chosen: the Guard, Priest, Baron and King are played with **no effect**. The Prince **must choose you**.
- You may play a targeted card even when it has no effect (a common way to dump it).

**Knocked out ("out of the round").** You discard your hand face up without its effect, skip your turns, and can't be chosen. A Princess discarded this way does nothing more. You are already out.

### 3.4 Card details & FAQ rulings (defaults chosen)

| Card | Ruling |
|---|---|
| Guard | 2019 deck: may name **any value except 1, including 0 (Spy)**. In the 2019 rules, only Guard is excluded. The old draft said Spy couldn't be named, which was **wrong**. Classic: names 2,3,4,5,7,8,9 (values not in the deck are not offered). Naming a value whose copies are all visible is allowed. The guess and the result are public. |
| Priest | Only the player of the Priest sees the card. Everyone sees *who* was looked at. |
| Baron | Only the two players involved see both cards. Everyone sees the result. A loser's hand goes onto their trail face up (knock-out), so the losing card becomes public anyway. On a **tie**, only the two players learn that they hold the same value. Everyone else sees just "tie". |
| Handmaid | Protection lasts until the start of your next turn. It only stops *other* players' cards. You can't be protected while it's your turn, because protection ends when your turn starts. |
| Prince | The discard goes to the target's trail without its effect (a Spy discarded this way **counts** for the Spy bonus. A Princess discarded this way knocks them out). The target then draws from the deck. **If the deck is empty**, they draw the face-down set-aside card. That happens at most once per round, because the round ends that turn. The 2-player face-up cards are never drawn. Using a Prince on yourself while holding the Princess knocks you out. |
| Chancellor | Deck ≥ 2: draw 2, keep 1 of 3, and put 2 on the bottom in an order you choose. Deck = 1: draw 1, keep 1 of 2, put 1 on the bottom. Deck = 0: no effect. The deck size is unchanged afterwards, so a Chancellor never ends the round early. The Countess rule does **not** apply to the cards you keep (you only keep one). You privately know the returned cards. |
| King | You swap your remaining card with the target's. Both of you now know both cards. Trading isn't discarding, so trading the Princess is safe. |
| Countess | You may also play her voluntarily. A forced play does not reveal the other card. |
| Princess | Out whenever she is played or discarded: voluntarily, by a Prince, or (never) by a Chancellor, because cards returned to the deck aren't discarded. |
| Spy | The bonus is checked at **every** round end, whether the deck ran out or only one player is left. Only players **still in** count. If exactly one of them has a Spy on their trail (played or Prince-discarded), they get +1. That stacks with winning the round, so one player can take 2. Two Spies on one player's trail still give 1. |

### 3.5 Round end & scoring

The round ends **after the turn** in which either:
- **Only one player is still in.** That player wins the round.
- **The deck is empty.** Everyone still in reveals their card. The highest value wins. **Ties:** every tied player wins a token (default `tieBreak: 'share'`). With `tieBreak: 'discards'` (2012 rule), the tied player with the highest sum of values on their trail wins. If they're still tied, all of them share.

Award 1 token per round winner, then the Spy bonus. Everyone's cards and the set-aside card are revealed on the round-over screen. That is a digital nicety, and the information is dead by then.

### 3.6 Game end

After tokens are awarded, if anyone has **≥ target** the game ends. **Everyone at or above the target wins.** The 2019 rules allow several winners (a shared tie, or a round win plus a Spy bonus). Standings are ordered by tokens. Otherwise a new round starts (§3.2).

### 3.7 Common misplays the engine enforces

Forgetting the forced Countess play. Naming "Guard" with a Guard. Choosing a protected or knocked-out player. Thinking a Prince can't target its own player. Ending the round when the deck empties mid-turn instead of after the turn. Giving the Spy bonus to a knocked-out player. Letting a Chancellor's returned cards count as "discarded".

## 4. Host options

There is **no per-game options mechanism in the platform yet** (`GameRoom` in `packages/multiplayer/src/RoomManager.ts` stores only `gameRules`, and `createState(room, players)` takes no options). Plan: the engine takes a `LoveLetterOptions` object in its constructor (default as below), so the options are fully tested now, and v1 ships with the defaults. The lobby toggles come when the platform adds game options (§11). Turn timers and spectators are platform-wide features and don't belong here.

| Option | Values | Default | Notes |
|---|---|---|---|
| `edition` | `'standard'` (21) / `'classic'` (16) | `'standard'` | Classic only for 2–4 seated. The engine throws `GameRuleError` otherwise. |
| `targetTokens` | `'auto'` / 1–10 | `'auto'` | auto = the table in §3.1. |
| `classicTargets` | `'2019'` / `'2012'` | `'2019'` | `'2012'` makes auto 2p = 7 in Classic. |
| `tieBreak` | `'share'` / `'discards'` | `'share'` | §3.5 |
| `hints` | on / off | **on** | Memory aid: shows what you have privately learned ("You saw Bea's Prince") and the count of unseen cards per value in the guess picker. Pure convenience for mixed-age tables. All of it can be derived from what the player has seen. |

## 5. State model

```ts
// games/love-letter/src/types.ts
export type CardValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Edition = 'standard' | 'classic';
export type Phase = 'turn' | 'chancellor' | 'round-over' | 'game-over';

export interface LoveLetterOptions {
  edition: Edition;
  targetTokens: 'auto' | number;
  classicTargets: '2019' | '2012';
  tieBreak: 'share' | 'discards';
  hints: boolean;
}

export type TrailCard = { value: CardValue; how: 'played' | 'discarded' | 'knocked-out' };

/** One resolved play, redacted per viewer by view(). */
export interface PlayEvent {
  seq: number;
  byId: string;
  card: CardValue;
  targetId: string | null;           // null = no target (all protected / untargeted card)
  noEffect: boolean;                 // targeted card with nobody to target, or Chancellor on empty deck
  guess?: CardValue;                 // Guard
  hit?: boolean;                     // Guard
  /** Priest: the seen card. Baron: both cards. Present only for the players entitled to it. */
  seen?: CardValue;
  compare?: { mine: CardValue; theirs: CardValue };
  baronResult?: 'win' | 'lose' | 'tie';     // Baron, from byId's side, public
  princeDiscard?: CardValue;                 // public (face-up discard)
  drewSetAside?: boolean;                    // Prince on an empty deck, public
  knockedOut: { id: string; card: CardValue }[]; // public
}

export interface RoundResult {
  reason: 'last-standing' | 'deck-empty';
  hands: { id: string; card: CardValue | null; discardTotal: number }[]; // all revealed
  setAside: CardValue;
  winnerIds: string[];
  gossipId: string | null;
}

export interface LoveLetterView {
  phase: Phase;
  edition: Edition;
  round: number;
  target: number;                    // tokens to win
  deckCount: number;
  faceUp: CardValue[];               // 2-player set-aside, public
  activePlayerId: string | null;
  players: {
    id: string; name: string; bot: boolean; connected: boolean;
    left: boolean;                   // removed from the game
    out: boolean;                    // knocked out this round
    protected: boolean;
    tokens: number;
    cardCount: number;               // 0 | 1 | 2 (3 during own Chancellor)
    trail: TrailCard[];
  }[];
  events: PlayEvent[];               // this round, redacted for the viewer
  lastRound: RoundResult | null;     // set in round-over / game-over
  winnerIds: string[];               // game-over
  // Private to the viewer (empty / null for spectators):
  myHand: CardValue[];
  /** For phase 'turn' and you're active: legal plays with their target options. */
  moves: { card: CardValue; targets: string[]; mustTargetSelf?: boolean; guesses: CardValue[] }[];
  forcedCountess: boolean;
  /** hints on: what you privately know about others' current cards. */
  known: { id: string; card: CardValue; source: 'priest' | 'baron' | 'king' }[];
  /** hints on: copies not visible to you (deck ∪ others' hands ∪ face-down set-aside). */
  unseen: Partial<Record<CardValue, number>>;
}

export type LoveLetterAction =
  | { type: 'play'; card: CardValue; target?: string; guess?: CardValue }
  | { type: 'chancellor'; keep: CardValue; bottom: CardValue[] }; // bottom[0] goes under first (deepest)

declare module '@parlor/game-types' {
  interface GameViewMap { 'love-letter': LoveLetterView }
  interface GameActionMap { 'love-letter': LoveLetterAction }
}
```

**Server state (engine private fields):**

```ts
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean; left: boolean;
  hand: CardValue[]; trail: TrailCard[]; out: boolean; protected: boolean;
  tokens: number;
  /** What this seat privately knows of others' current cards; drives `known` and the bot. */
  memory: Map<string, { card: CardValue; source: 'priest' | 'baron' | 'king' }>;
  returned: CardValue[];   // cards this seat put under the deck with a Chancellor (private)
}
class LoveLetterEngine {
  seats: Seat[]; options: LoveLetterOptions; target: number;
  deck: CardValue[]; setAside: CardValue | null; faceUp: CardValue[];
  active: number; phase: Phase; round: number; events: PlayEvent[] (unredacted + private fields);
  pendingChancellor: { bottomCount: 1 | 2 } | null;
  lastRound: RoundResult | null; winnerIds: string[];
}
```

**Memory updates** (applied to every seat's `memory`; used by both `known` and the bot):
- Priest: the player learns the target's card. Baron: both players learn each other's card (the loser is out anyway). King: each player learns the other's new card (it was their own).
- When seat X plays or discards value v: for every observer whose memory says X holds v, delete it (X may have played the known card). If memory says X holds w ≠ v, keep it (X played the drawn card).
- Prince on X, King involving X (for third parties), X knocked out: delete all memories *about* X, then apply the King rule above.
- Clear all memories at round start.

**Redaction** (`view(id?)`): `seen`/`compare` only for `byId` and the target (Priest: only `byId`). King events carry no cards. Chancellor events show only "kept 1, returned N". Deck order, `setAside` (until round-over) and other hands are never sent. A spectator gets `myHand: []`, `moves: []`, `known: []`, and `unseen` counted from public info only. Test all three viewpoints.

**State machine**

```
start → [setup round] → turn(active)
turn --play(non-Chancellor)--> resolve → endTurn
turn --play(Chancellor, deck>0)--> chancellor(active) --chancellor--> endTurn
endTurn: alive≤1 or deck=0 → round-over (score, set lastRound) ; else next alive seat → turn (clear its protection, draw)
round-over --advanceReveal (5.5s)--> anyone ≥ target ? game-over : [setup round] → turn
```

## 6. Actions

All are **turn-based** and only the active seat may act. Validation in `definition.ts` (shape) → engine (rules). The engine throws `GameRuleError` before mutating anything.

| Action | Payload shape (`validateAction`) | Engine rules | Transition |
|---|---|---|---|
| `play` | exact keys ⊆ `type, card, target, guess`. `card` an integer 0–9. `target` a string if present. `guess` an integer 0–9 if present. | phase `turn`, your turn. `card ∈ myHand`. Countess forced → card must be 8. **Target:** for 1/2/3/7: required iff a legal other target exists, and must be one of them. Forbidden otherwise. For 5: required, legal = other targets ∪ self, and self is the only one if no others. For 0/4/6/8/9: forbidden. **Guess:** required iff card=1 with a target, must be in the edition's guessable set (standard 0,2–9; classic 2,3,4,5,7,8,9). Forbidden otherwise. | Move the card to the trail, resolve, append the event. Chancellor with deck>0 → `chancellor`. Else endTurn. |
| `chancellor` | exact keys `type, keep, bottom`. `bottom` an array of length 1–2 of integers 0–9. | phase `chancellor`, your turn. `[keep, ...bottom]` must equal your hand as a multiset. `bottom.length === pendingChancellor.bottomCount`. | Hand = [keep]. Push `bottom` under the deck in order. Record in `returned`. endTurn. |

Reveal moments: the Guard guess and result, the Baron result, Prince discards, knock-outs and Handmaid are public in the event as soon as they happen. Priest and Baron cards are private to the players entitled to them. Every hand is revealed at `round-over`. No timed reveal phases within a turn. Instead `drive` paces bot moves (§7) so humans can read each event.

## 7. Mapping to this codebase

- **Package** `games/love-letter` (`@parlor/love-letter`, id `love-letter`), laid out exactly as in `docs/ADDING_GAMES.md` §1. **No `@parlor/cards` dependency**, because these aren't suited playing cards.
- **Copy from Hearts:** `games/hearts/src/{definition,engine,meta,types}.ts`, `package.json`, `tsconfig.json`, `turbo.json`. Use Oh Hell's single `act(id, action)` dispatch (`games/oh-hell/src/engine.ts:54`) for the two actions.
- **`rules.ts`** (pure, client-safe): `DECKS: Record<Edition, CardValue[]>`, `CARD_INFO` (name, one-line effect), `targetTokens(n, options)`, `guessable(edition)`, `mustPlayCountess(hand)`, `legalMoves(hand, seats, selfId, edition)`, `unseenCounts(...)`.
- **`meta.ts`:** `minPlayers: 2, maxPlayers: 6, minutes: { min: 15, max: 25 }, kind: 'cards', weight: 'light', format: 'individual', tags: ['deduction'], displayModes: ['peer'], supportsBots: true`.
- **Engine:** constructor `(players, randomInt = secureRandomInt, options = DEFAULT_OPTIONS)`. Use `fisherYatesShuffle` from `@parlor/multiplayer/random`. Plus `setConnected`, `automaticMove()` (Hearts pattern: return nothing if no connected human), `advanceReveal()` for `round-over`, `currentPhase`, `view(id?)`, and `remove(id)`.
- **`definition.ts` / `drive`:** as in Hearts, but the reveal is only `round-over` at **5500 ms**, and automatic moves wait **1100 ms**, not 400. Elimination plays are dramatic and humans have to read the event before the next one arrives. Timers only through `game.instance.schedule`.
- **Disconnects / removal:** a disconnected seat is played by a stand-in using the bot logic (Hearts pattern). `onPlayerRemoved` → `engine.remove(id)`: if the player is still in the round, knock them out (hand to the trail as `knocked-out`, no effect, Princess included), mark them `left` (skipped in future rounds, never first player), and run the round-end check. If fewer than 2 non-left seats remain → `game-over`, and the remaining player wins (Liar's Dice `forfeit` pattern, `games/liars-dice/src/lib/server/definition.ts:171`). If the active player leaves during `chancellor`, keep their hand's first card and return the rest in hand order.
- **Wire-up:** the six places in ADDING_GAMES §7. Add `{ ...loveLetterMeta, shelf: 'linen', tagline: 'Hold one card. Be the last one in.' }` to `apps/parlor/src/lib/games/catalog.ts`. Add a RulesModal section with a card table.
- **Reuse from `@parlor/ui`:** `TurnBanner`, `SeatChip` (`out`, `targetable`, `onclick`, `children` for token pips + shield), `CardBoard`, `Felt`, `DrawPile` (count display only; `canDraw` always false, since drawing is automatic), `Button`, `Modal` (Princess confirm), `GameOver` (standings detail "4 tokens"), `seatTone`.
- **NEW board-kit additions (flag):**
  1. **`CharacterCard.svelte`**: a printed card for named, valued cards. Same stock, outline, size var (`--card-w`) and `--card-back` as `PlayingCard`, with a big Nunito value top-left, the name, a stroke-icon glyph, and an optional one-line effect at `size="lg"`. Props mirror PlayingCard (`faceDown`, `playable`, `selected`, `dimmed`, `marked`, `onclick`). Coup (and later Skull) will need the same thing, so it belongs in `packages/ui/src/lib/cards/`. Coordinate with the Coup brief.
  2. **`CardTrail.svelte`** (smaller): one seat's face-up played cards as an overlapping row of mini `CharacterCard`s, with `how` styling (knock-out cards get a broken-seal mark). Keep it local to the game until a second game needs it, then promote it (Collection Rule).
  - `CardHand` is typed to `@parlor/cards` `Card`. Love Letter's hand is at most 3 cards, so it needs no overlap logic. Render a simple flex row of `CharacterCard`s and don't generalise `CardHand` for v1.

## 8. Board UI

**Shelf colour: `linen`.** Every palette block is already used by at least one game, and linen is the only one used once (Kings Corner). Love Letter would sit after Oh Hell (mustard) on the shelf, so neighbouring blocks differ. Its pieces: card backs printed in **Deep Clay with a cream wax-seal glyph** (`--card-back: var(--color-terracotta-deep)`), and the tokens of affection are small clay hearts. That gives the game its identity on its pieces, per the Collection Rule. Surface: the standard `Felt`. (Alternative in §11.)

**Phone (390px)**

```
┌ lid: PARLOR            [?] [Leave] ┐
│ TurnBanner: Your turn              │
│  "Play a card. Tap it again to…"   │
├────────────────────────────────────┤
│ Seats (wide rows, 2–6):            │
│ (B) Bea  ◆◆◇◇  🛡   [1][4][2]       │  ← SeatChip wide + trail
│ (C) Cal  ◆◇◇◇  out  [3][9✕]         │
│ (D) Dot  ◆◆◆◇       [5]   saw: 7   │  ← hint "You saw: King"
├──────────── Felt ──────────────────┤
│ [deck 9]   face-up (2p): [4][1][6] │
│ Last: "Bea's Guard named Prince │
│        on Cal: miss."              │
├────────────────────────────────────┤
│ Your hand                          │
│  ┌──────┐  ┌──────┐                │
│  │3     │  │7     │  (lg cards,    │
│  │Baron │  │King  │   effect line) │
│  │      │  │      │                │
│  └──────┘  └──────┘                │
│ Your trail: [0][1]   ◆◆◇◇ (2 of 4) │
└────────────────────────────────────┘
```

Desktop (≥900px): felt and seats on the left (seats around the felt in two columns), with hand + trail + event log (last ~6 events) in a 320px side column. The same components.

**Interactions**
1. **Play:** tap a card to lift it (banner: "Tap the Baron again to play it"), tap again to commit. If the Countess is forced, the other card is `dimmed` and the banner says why.
2. **Target:** if the card needs one, the seats become buttons with the mustard ring (`targetable`). Protected or out seats are not targetable. For a Prince, your own seat is also a target ("Pick yourself"). Tapping a seat selects it. If every other seat is protected, the banner says "Everyone is protected. This card will have no effect." and the second tap plays it.
3. **Guess (Guard):** after the target, a grid of value chips (name + value, 44px min) appears in the felt. Each chip shows its unseen count when hints are on ("×2"), and a 0 is faded but still tappable. The selection plus one `shout` button "GUESS PRINCE" commits.
4. **Princess:** choosing to play her opens a `Modal` confirm: "Play the Princess? You'll be out of the round."
5. **Chancellor:** the felt shows your 3 cards. Tap the one to keep (butter). Then the other two go into "Bottom of deck" slots in tap order, with a Swap button. Confirm.
6. **Private reveals:** a Priest / Baron result shows as an in-felt panel only on the entitled phones ("Only you saw this"), dismissed by tap or by the next event. A persistent `known` hint sits on that seat.
7. **Round over:** a felt panel lists each player's revealed card, the set-aside card, the winner(s), "+1 Spy" if any, and the tokens. Auto-advances after 5.5s (shows a countdown).

**Animations** (moderate; all dropped under reduced motion): the card slides from the hand to its trail. Guard guess: the chip flies to the target seat, then a "Miss" shake or a knock-out. Knock-out: the hand card flips face up and a wax-seal crack appears on the seat (SeatChip `out`). Baron: a 600ms face-off of two face-down cards between the seats, flipped only for the two players involved. Handmaid: a shield badge pops on. King: two backs cross over. Token award: a seal stamps onto the seat.

**Copy**: the banner names the effect in plain words ("Pick who to compare cards with"). Cards keep their original names; all effect and rules text is Parlor's own paraphrase, never rulebook wording.

## 9. Bot AI

Runs from `automaticMove()` with the seat's own `memory` + public info only (never peeking at server state). It uses the same function for bots and stand-ins. It is deterministic given the seeded random source.

Derived per decision: `unseen` counts from the bot's point of view; `p(v | X)` ∝ unseen[v] (uniform), or certain if memory knows X.

1. **Forced Countess** → play 8.
2. **Never play the Princess** (only possible otherwise with Countess + Princess, so play the Countess).
3. **Sure kills first:** if memory knows X holds v and X is targetable: Guard with guess v (v≠1). Baron if my other card > v. Prince on X if v = 9 (Princess).
4. **Choose which card to keep** (play the other), scoring the kept card by value, then by these adjustments: never keep the Spy if I can play it (play it early); don't keep a Baron if my other card is ≤ 4; prefer to *play* a Handmaid when I hold a high card (≥7); prefer to play the Priest early (information).
5. **Targets** (when no sure kill): among the legal targets, prefer the leader in tokens, then a player whose card I don't know, then random. A Prince targets self only when forced, or when my kept card ≤ 2 and I don't hold the Princess. Never Prince self while holding the Princess.
6. **Guard guess:** the value (≠1) with the most unseen copies for that target, ties to the higher value. If the target's card was revealed by a King trade with me, use that.
7. **King:** play the King only when my other card is ≤ 4 (trade up). Target the player I know holds the highest card, else the leader.
8. **Chancellor:** keep the highest card, except the Princess when 2+ Princes are unseen (then keep the next highest ≥ 5). Bottom order: the higher card deepest.
9. **Round-start / end:** no decisions.

This is roughly on par with the Hearts/Oh Hell heuristics, and it can later be tuned with `docs/AI_STRATEGIES.md` (Love Letter is a good small MCTS candidate: tiny state, fast playouts).

## 10. Test plan

**Engine (`apps/parlor/src/lib/server/love-letter.test.ts`, seeded `randomInt` + a test-only deck-stacking helper)**
- Setup: standard deck has 21 cards and values as in the table. Classic has 16. 2p sets aside 1 face-down + 3 face-up (4 removed) in both editions. Classic with 5 players throws. Auto targets for 2–6 (standard) and 2012 2p = 7.
- Turn draws automatically. The view shows 2 cards to the active player only.
- Countess forced with 7 and with 5. Not forced with 9. Voluntary Countess allowed.
- Guard: hit knocks out (hand to trail as `knocked-out`). Miss does nothing. Guessing 1 rejected. Guessing 0 allowed in standard, rejected in classic. Guessing 6 rejected in classic.
- Priest: `seen` only in the player's own view, not the target's, not a third player's, not a spectator's.
- Baron: lower out. Tie nobody. Both cards visible only to the two players. A third party sees `baronResult` only.
- Handmaid: protected seat rejected as target. Protection ends at the start of the owner's next turn. All others protected → Guard/Priest/Baron/King playable with no target, `noEffect`. Sending a target anyway is rejected.
- Prince: all others protected → only self is legal. Prince self. Prince forces a Princess discard → out. Prince-discarded Spy counts for the bonus. Empty deck → draws the set-aside card (`drewSetAside`).
- Chancellor: deck 5 → 3 in hand, phase `chancellor`, the 2 returned to the bottom in the given order (verify by drawing order). Deck 1 → returns 1. Deck 0 → no effect, turn ends. Bad multiset rejected. Wrong bottom length rejected. The deck count is unchanged afterwards.
- King: hands swap. Both players' `known` update. Trading the Princess is safe.
- Playing the Princess voluntarily → out.
- Round end: the last player standing wins mid-deck. The deck emptying ends the round **after** that turn, not before it resolves. Highest card wins. A tie shares tokens (`share`). `discards` tie-break picks the higher discard sum, and an equal sum shares.
- Spy: a single surviving Spy player +1. Two players with Spy → none. A knocked-out Spy player excluded. The bonus applies on a last-standing end. Round win + Spy = +2.
- Game end: the threshold reached by two players at once → both in `winnerIds`. Next round starts with the winner. A tie start is picked from the tied winners (seeded).
- Rejections leave the state unchanged (deep-equal the view before/after): wrong turn, wrong phase, card not in hand, illegal target, missing guess.
- Memory: knowledge cleared when the known card is played, on a Prince, and at round start. Kept when the other card is played.
- Disconnect → stand-in plays. No connected humans → `automaticMove()` is null. `remove()` of an active, an inactive, and a chancellor-phase player. Removal down to 1 seat → game-over.
- Bots: a full seeded game at 2, 4 and 6 bots + 1 human-stand-in finishes and never throws (fuzz 200 seeds, both editions).

**Socket:** add to `apps/parlor/src/lib/server/seededPlaythroughs.test.ts`. Assert that each player's `game:state` has only their own `myHand`, and that Priest `seen` appears only for the player. **Boundary:** malformed `play`/`chancellor` payloads in `actionBoundary.test.ts` (extra keys, a string card, 10, a bottom of length 3).

**Playwright** (`apps/parlor/e2e/love-letter.test.ts`, 390×844, modelled on `e2e/spades.test.ts`): open "How to play" for Love Letter → create a room → vote → add 2 bots → Start → wait for "Your turn" → tap the first enabled hand card twice. If seats become targetable, tap the first. If the guess grid appears, tap the first chip and the GUESS button. If the Princess confirm appears, cancel and pick the other card. If the Chancellor panel appears, keep the first card and confirm. Assert that a card appears on "Your trail" or the banner changes to another player's turn.

## 11. Open questions for the human

1. **Pre-launch rename:** if Parlor goes public, `docs/LEGAL.md` calls for a new name and new card names. Should the RulesModal and `rules.ts` keep all names in one `CARD_INFO` table so a later rename touches one file? (Recommended: yes.)
2. **Host options:** the platform has no per-game options yet. Build a small generic `gameOptions` lobby mechanism now (it would also serve Classic/Standard and other games' variants), or ship standard-deck defaults first?
3. **Shelf colour:** linen (shared with Kings Corner), or add a new palette block (e.g. a plum "wax" ink) to the design system so the shelf has a sixth colour?
4. **Jackbox host screen:** out of scope for v1 (peer only), OK?
5. **Hints default on:** acceptable for a faithful-rules-first product (the hints show only what the player has already seen or could count)?

## 12. Sources

- Z-Man Games, *Love Letter* (2019) rulebook, summarised at RulesPal: https://rulespal.com/love-letter-2019/rulebook. PDF copy: https://nastol.io/storage/games/files/love_letter_2/666154/ll-rulebook.pdf (setup, 2p face-up cards, card effects, ties share, Classic variant = remove 1 Guard, 2 Chancellors, 2 Spies, targets 6/5/4/3/3, multiple winners)
- AEG, *Love Letter* (2012) rulebook PDF: https://world-of-board-games.com.sg/docs/Love-Letter.pdf (16-card deck, discard-sum tie-break, targets 7/5/4, Prince on an empty deck draws the removed card, all-protected → no effect / Prince must choose self, Countess needn't reveal the other card)
- Wikipedia, *Love Letter (card game)*: https://en.wikipedia.org/wiki/Love_Letter_(card_game) (publication history, 2019 changes in values and cards)
- Board Game Arena, *Love Letter* game panel and rules summary: https://en.boardgamearena.com/gamepanel?game=loveletter (online conventions, discard-sum tie-break in the classic mode)
- Love Letter Premium rulebook (AEG), 2–4p targets: https://m102.nthu.edu.tw/~s102061202/Love-Letter-Premium_Rulebook.pdf
- `docs/LEGAL.md` (Love Letter row) and `docs/ADDING_GAMES.md`.
