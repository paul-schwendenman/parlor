# Calling Card (Love Letter): implementation brief

> Working Parlor name **Calling Card**, a re-theme of *Love Letter* (Seiji Kanai, 2012; AEG 2012–2018; Z-Man Games 2019 2nd edition). Package `@parlor/calling-card`, id `calling-card`. "Love Letter" is used in this doc only to identify the source game. See §2.

## 1. Overview

Each player holds **one secret card**. On your turn you draw a second card and play one of the two. Every card is a guest at the Duchess's house party, and playing it does something: guess someone's card to knock them out, peek at a hand, compare hands, swap hands, or hide. A round ends when one player is left, or when the deck runs out and the highest card wins. Win rounds (and the occasional Gossip bonus) to collect tokens, and the first to the target wins. **2–6 players** (21-card court, the default) or **2–4** (16-card classic court). **15–25 min** for a game, 2–4 min per round. **Peer mode** (each phone holds one hidden card; Jackbox host screen later, see §11). It suits Parlor well. Turns take a few seconds and the rules fit on one card. It plays from 2 to 6 people, kids can play it, and it has deduction to talk about. Bots fill seats easily. A player who is knocked out waits at most a couple of minutes for the next round.

## 2. Naming & IP

Per `docs/LEGAL.md` (Love Letter row: Low risk, rename the game and the characters, keep the mechanics):

- **Do not use:** the name "Love Letter", the Tempest setting (Princess Annette, Countess Wilhelmina, King Arnaud, Odette, Susannah, Tomas, Talus), the AEG/Z-Man card art, frames, rulebook text, reference-card wording, or the phrase "tokens of affection".
- **Re-theme: "Calling Card."** In a Victorian parlour, guests left calling cards. You are a guest at a manor party trying to get *your* calling card to the Duchess, and the card in your hand is the person carrying it. The theme fits the Parlor brand without copying the source's royal court.

| Value | Parlor name | Source role | Copies (court / classic) | Effect (our wording) |
|---|---|---|---|---|
| 0 | **Gossip** | Spy | 2 / 0 | No effect. At round end, if you are the only player still in who played or discarded a Gossip, +1 token. |
| 1 | **Inspector** | Guard | 6 / 5 | Choose another player and name a card other than Inspector. If they hold it, they're out. |
| 2 | **Maid** | Priest | 2 / 2 | Look at another player's card. |
| 3 | **Card Sharp** | Baron | 2 / 2 | Secretly compare cards with another player. The lower card is out. Ties do nothing. |
| 4 | **Chaperone** | Handmaid | 2 / 2 | Nobody else's cards can choose you until your next turn. |
| 5 | **Butler** | Prince | 2 / 2 | Choose any player (you may choose yourself). They discard their card without its effect and draw a new one. |
| 6 | **Secretary** | Chancellor | 2 / 0 | Draw 2. Keep 1 of your 3 cards and put the other 2 on the bottom of the deck in any order. |
| 7 | **Duke** | King | 1 / 1 | Trade cards with another player. |
| 8 | **Governess** | Countess | 1 / 1 | No effect. Must be played if your other card is the Duke or a Butler. |
| 9 | **Duchess** | Princess | 1 / 1 | If you play or discard her for any reason, you're out. |

Token = **"invitation"** (a wax-sealed card). All names are open to change (§11). The art is drawn by Parlor: stroke-icon portraits or simple glyphs, no imitation of the source art.

## 3. Rules (verified)

Sources: Z-Man 2019 rulebook (via RulesPal summary + nastol.io PDF), AEG 2012 rulebook PDF (text extracted), Wikipedia, BGA. Card values below are the **2019 numbering** for both decks. The 2012 deck printed King 6 / Countess 7 / Princess 8, which gives the same order and the same play. The Z-Man rulebook's own "Classic" variant also keeps the 2019 numbers.

### 3.1 Editions

| | **Court (default)**: 2019, 21 cards | **Classic** (option): 16 cards |
|---|---|---|
| Players | 2–6 | 2–4 |
| Deck | 0×2, 1×6, 2×2, 3×2, 4×2, 5×2, 6×2, 7, 8, 9 | 1×5, 2×2, 3×2, 4×2, 5×2, 7, 8, 9 (2019 deck minus 1 Inspector, 2 Secretaries, 2 Gossips) |
| Tokens to win | 2p 6 · 3p 5 · 4p 4 · 5p 3 · 6p 3 | same table (2019 Classic variant). The 2012 printing used 2p 7 (see option `classicTargets`) |
| Tie when the deck runs out | All tied players win the round | Same by default. The 2012 printing breaks ties by the highest total of discarded values (option `tieBreak`) |

**Recommendation: Court as the default.** It covers the whole 2–6 range a Parlor lobby can have, it is the edition sold today, and Gossip and Secretary add decisions without adding complexity. Classic is a host option for 2–4 players. It plays tighter and is the "original" for people who know it. Supporting both costs very little: one deck-composition table, plus hiding Gossip and Secretary from the guess picker.

### 3.2 Setup (each round)

1. Shuffle the edition's deck.
2. Set aside the top card **face down**. Nobody sees it.
3. **2 players only:** set aside 3 more cards **face up**. Everyone sees them, and they are out of the round.
4. Deal 1 card to each player in the game.
5. First player: in round 1, a random seat (the rulebook's "most recently wrote a letter" or "most recent date" doesn't work online). In later rounds, the previous round's winner. If several players won, a random one of them. If that player has left, the next seat clockwise.

### 3.3 Turn

1. Your Chaperone protection (if any) ends.
2. **Draw** the top card (automatic; you now hold 2). The deck is never empty at the start of a turn, because the round ends as soon as a turn ends with an empty deck. The Secretary never shrinks the deck (see below).
3. **Play** one of your 2 cards face up onto your trail. You must apply its effect, even if it hurts you.
   - **Governess forced:** holding Governess + Duke or Governess + Butler, you must play the Governess. Nobody else learns your other card.
   - Playing the **Duchess** voluntarily is legal and knocks you out. The UI asks for confirmation (§8).
4. Resolve the effect (table in §2), then the turn passes clockwise to the next seat still in.

**Targeting.** "Choose another player" means a player who is still in the round, not protected by a Chaperone, and not you. The Butler may also choose you.
- If **no** other player can be chosen: the Inspector, Maid, Card Sharp and Duke are played with **no effect**. The Butler **must choose you**.
- You may play a targeted card even when it has no effect (a common way to dump it).

**Knocked out ("out of the round").** You discard your hand face up without its effect, skip your turns, and can't be chosen. A Duchess discarded this way does nothing more. You are already out.

### 3.4 Card details & FAQ rulings (defaults chosen)

| Card | Ruling |
|---|---|
| Inspector | Court: may name **any value except 1, including 0 (Gossip)**. The 2019 wording says "any character except Guard". The old draft said Gossip couldn't be named, which was **wrong**. Classic: names 2,3,4,5,7,8,9 (values not in the deck are not offered). Naming a value whose copies are all visible is allowed. The guess and the result are public. |
| Maid | Only the player of the Maid sees the card. Everyone sees *who* was looked at. |
| Card Sharp | Only the two players involved see both cards. Everyone sees the result. A loser's hand goes onto their trail face up (knock-out), so the losing card becomes public anyway. On a **tie**, only the two players learn that they hold the same value. Everyone else sees just "tie". |
| Chaperone | Protection lasts until the start of your next turn. It only stops *other* players' cards. You can't be protected while it's your turn, because protection ends when your turn starts. |
| Butler | The discard goes to the target's trail without its effect (a Gossip discarded this way **counts** for the Gossip bonus. A Duchess discarded this way knocks them out). The target then draws from the deck. **If the deck is empty**, they draw the face-down set-aside card. That happens at most once per round, because the round ends that turn. The 2-player face-up cards are never drawn. Butlering yourself while holding the Duchess knocks you out. |
| Secretary | Deck ≥ 2: draw 2, keep 1 of 3, and put 2 on the bottom in an order you choose. Deck = 1: draw 1, keep 1 of 2, put 1 on the bottom. Deck = 0: no effect. The deck size is unchanged afterwards, so a Secretary never ends the round early. The Governess rule does **not** apply to the cards you keep (you only keep one). You privately know the returned cards. |
| Duke | You swap your remaining card with the target's. Both of you now know both cards. Trading isn't discarding, so trading the Duchess is safe. |
| Governess | You may also play her voluntarily. A forced play does not reveal the other card. |
| Duchess | Out whenever she is played or discarded: voluntarily, by a Butler, or (never) by a Secretary, because cards returned to the deck aren't discarded. |
| Gossip | The bonus is checked at **every** round end, whether the deck ran out or only one player is left. Only players **still in** count. If exactly one of them has a Gossip on their trail (played or Butler-discarded), they get +1. That stacks with winning the round, so one player can take 2. Two Gossips on one player's trail still give 1. |

### 3.5 Round end & scoring

The round ends **after the turn** in which either:
- **Only one player is still in.** That player wins the round.
- **The deck is empty.** Everyone still in reveals their card. The highest value wins. **Ties:** every tied player wins a token (default `tieBreak: 'share'`). With `tieBreak: 'discards'` (2012 rule), the tied player with the highest sum of values on their trail wins. If they're still tied, all of them share.

Award 1 token per round winner, then the Gossip bonus. Everyone's cards and the set-aside card are revealed on the round-over screen. That is a digital nicety, and the information is dead by then.

### 3.6 Game end

After tokens are awarded, if anyone has **≥ target** the game ends. **Everyone at or above the target wins.** The 2019 rules allow several winners (a shared tie, or a round win plus a Gossip bonus). Standings are ordered by tokens. Otherwise a new round starts (§3.2).

### 3.7 Common misplays the engine enforces

Forgetting the forced Governess play. Naming "Inspector" with an Inspector. Choosing a protected or knocked-out player. Thinking a Butler can't target yourself. Ending the round when the deck empties mid-turn instead of after the turn. Giving the Gossip bonus to a knocked-out player. Letting a Secretary's returned cards count as "discarded".

## 4. Host options

There is **no per-game options mechanism in the platform yet** (`GameRoom` in `packages/multiplayer/src/RoomManager.ts` stores only `gameRules`, and `createState(room, players)` takes no options). Plan: the engine takes a `CallingCardOptions` object in its constructor (default as below), so the options are fully tested now, and v1 ships with the defaults. The lobby toggles come when the platform adds game options (§11). Turn timers and spectators are platform-wide features and don't belong here.

| Option | Values | Default | Notes |
|---|---|---|---|
| `edition` | `'court'` (21) / `'classic'` (16) | `'court'` | Classic only for 2–4 seated. The engine throws `GameRuleError` otherwise. |
| `targetTokens` | `'auto'` / 1–10 | `'auto'` | auto = the table in §3.1. |
| `classicTargets` | `'2019'` / `'2012'` | `'2019'` | `'2012'` makes auto 2p = 7 in Classic. |
| `tieBreak` | `'share'` / `'discards'` | `'share'` | §3.5 |
| `hints` | on / off | **on** | Memory aid: shows what you have privately learned ("You saw Bea's Butler") and the count of unseen cards per value in the guess picker. Pure convenience for mixed-age tables. All of it can be derived from what the player has seen. |

## 5. State model

```ts
// games/calling-card/src/types.ts
export type CardValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Edition = 'court' | 'classic';
export type Phase = 'turn' | 'secretary' | 'round-over' | 'game-over';

export interface CallingCardOptions {
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
  noEffect: boolean;                 // targeted card with nobody to target, or Secretary on empty deck
  guess?: CardValue;                 // Inspector
  hit?: boolean;                     // Inspector
  /** Maid: the seen card. Card Sharp: both cards. Present only for the players entitled to it. */
  seen?: CardValue;
  compare?: { mine: CardValue; theirs: CardValue };
  sharpResult?: 'win' | 'lose' | 'tie';     // Card Sharp, from byId's side, public
  butlerDiscard?: CardValue;                 // public (face-up discard)
  drewSetAside?: boolean;                    // Butler on an empty deck, public
  knockedOut: { id: string; card: CardValue }[]; // public
}

export interface RoundResult {
  reason: 'last-standing' | 'deck-empty';
  hands: { id: string; card: CardValue | null; discardTotal: number }[]; // all revealed
  setAside: CardValue;
  winnerIds: string[];
  gossipId: string | null;
}

export interface CallingCardView {
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
    cardCount: number;               // 0 | 1 | 2 (3 during own Secretary)
    trail: TrailCard[];
  }[];
  events: PlayEvent[];               // this round, redacted for the viewer
  lastRound: RoundResult | null;     // set in round-over / game-over
  winnerIds: string[];               // game-over
  // Private to the viewer (empty / null for spectators):
  myHand: CardValue[];
  /** For phase 'turn' and you're active: legal plays with their target options. */
  moves: { card: CardValue; targets: string[]; mustTargetSelf?: boolean; guesses: CardValue[] }[];
  forcedGoverness: boolean;
  /** hints on: what you privately know about others' current cards. */
  known: { id: string; card: CardValue; source: 'maid' | 'sharp' | 'duke' }[];
  /** hints on: copies not visible to you (deck ∪ others' hands ∪ face-down set-aside). */
  unseen: Partial<Record<CardValue, number>>;
}

export type CallingCardAction =
  | { type: 'play'; card: CardValue; target?: string; guess?: CardValue }
  | { type: 'secretary'; keep: CardValue; bottom: CardValue[] }; // bottom[0] goes under first (deepest)

declare module '@parlor/game-types' {
  interface GameViewMap { 'calling-card': CallingCardView }
  interface GameActionMap { 'calling-card': CallingCardAction }
}
```

**Server state (engine private fields):**

```ts
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean; left: boolean;
  hand: CardValue[]; trail: TrailCard[]; out: boolean; protected: boolean;
  tokens: number;
  /** What this seat privately knows of others' current cards; drives `known` and the bot. */
  memory: Map<string, { card: CardValue; source: 'maid' | 'sharp' | 'duke' }>;
  returned: CardValue[];   // cards this seat put under the deck with a Secretary (private)
}
class CallingCardEngine {
  seats: Seat[]; options: CallingCardOptions; target: number;
  deck: CardValue[]; setAside: CardValue | null; faceUp: CardValue[];
  active: number; phase: Phase; round: number; events: PlayEvent[] (unredacted + private fields);
  pendingSecretary: { bottomCount: 1 | 2 } | null;
  lastRound: RoundResult | null; winnerIds: string[];
}
```

**Memory updates** (applied to every seat's `memory`; used by both `known` and the bot):
- Maid: the player learns the target's card. Card Sharp: both players learn each other's card (the loser is out anyway). Duke: each player learns the other's new card (it was their own).
- When seat X plays or discards value v: for every observer whose memory says X holds v, delete it (X may have played the known card). If memory says X holds w ≠ v, keep it (X played the drawn card).
- Butler on X, Duke involving X (for third parties), X knocked out: delete all memories *about* X, then apply the Duke rule above.
- Clear all memories at round start.

**Redaction** (`view(id?)`): `seen`/`compare` only for `byId` and the target (Maid: only `byId`). Duke events carry no cards. Secretary events show only "kept 1, returned N". Deck order, `setAside` (until round-over) and other hands are never sent. A spectator gets `myHand: []`, `moves: []`, `known: []`, and `unseen` counted from public info only. Test all three viewpoints.

**State machine**

```
start → [setup round] → turn(active)
turn --play(non-Secretary)--> resolve → endTurn
turn --play(Secretary, deck>0)--> secretary(active) --secretary--> endTurn
endTurn: alive≤1 or deck=0 → round-over (score, set lastRound) ; else next alive seat → turn (clear its protection, draw)
round-over --advanceReveal (5.5s)--> anyone ≥ target ? game-over : [setup round] → turn
```

## 6. Actions

All are **turn-based** and only the active seat may act. Validation in `definition.ts` (shape) → engine (rules). The engine throws `GameRuleError` before mutating anything.

| Action | Payload shape (`validateAction`) | Engine rules | Transition |
|---|---|---|---|
| `play` | exact keys ⊆ `type, card, target, guess`. `card` an integer 0–9. `target` a string if present. `guess` an integer 0–9 if present. | phase `turn`, your turn. `card ∈ myHand`. Governess forced → card must be 8. **Target:** for 1/2/3/7: required iff a legal other target exists, and must be one of them. Forbidden otherwise. For 5: required, legal = other targets ∪ self, and self is the only one if no others. For 0/4/6/8/9: forbidden. **Guess:** required iff card=1 with a target, must be in the edition's guessable set (court 0,2–9; classic 2,3,4,5,7,8,9). Forbidden otherwise. | Move the card to the trail, resolve, append the event. Secretary with deck>0 → `secretary`. Else endTurn. |
| `secretary` | exact keys `type, keep, bottom`. `bottom` an array of length 1–2 of integers 0–9. | phase `secretary`, your turn. `[keep, ...bottom]` must equal your hand as a multiset. `bottom.length === pendingSecretary.bottomCount`. | Hand = [keep]. Push `bottom` under the deck in order. Record in `returned`. endTurn. |

Reveal moments: the Inspector guess and result, the Card Sharp result, Butler discards, knock-outs and Chaperone are public in the event as soon as they happen. Maid and Card Sharp cards are private to the players entitled to them. Every hand is revealed at `round-over`. No timed reveal phases within a turn. Instead `drive` paces bot moves (§7) so humans can read each event.

## 7. Mapping to this codebase

- **Package** `games/calling-card` (`@parlor/calling-card`, id `calling-card`), laid out exactly as in `docs/ADDING_GAMES.md` §1. **No `@parlor/cards` dependency**, because these aren't suited playing cards.
- **Copy from Hearts:** `games/hearts/src/{definition,engine,meta,types}.ts`, `package.json`, `tsconfig.json`, `turbo.json`. Use Oh Hell's single `act(id, action)` dispatch (`games/oh-hell/src/engine.ts:54`) for the two actions.
- **`rules.ts`** (pure, client-safe): `DECKS: Record<Edition, CardValue[]>`, `CARD_INFO` (name, one-line effect), `targetTokens(n, options)`, `guessable(edition)`, `mustPlayGoverness(hand)`, `legalMoves(hand, seats, selfId, edition)`, `unseenCounts(...)`.
- **`meta.ts`:** `minPlayers: 2, maxPlayers: 6, estimatedMinutes: '15-25', tags: ['cards', 'deduction', 'family'], displayModes: ['peer'], supportsBots: true`.
- **Engine:** constructor `(players, randomInt = secureRandomInt, options = DEFAULT_OPTIONS)`. Use `fisherYatesShuffle` from `@parlor/multiplayer/random`. Plus `setConnected`, `automaticMove()` (Hearts pattern: return nothing if no connected human), `advanceReveal()` for `round-over`, `currentPhase`, `view(id?)`, and `remove(id)`.
- **`definition.ts` / `drive`:** as in Hearts, but the reveal is only `round-over` at **5500 ms**, and automatic moves wait **1100 ms**, not 400. Elimination plays are dramatic and humans have to read the event before the next one arrives. Timers only through `game.instance.schedule`.
- **Disconnects / removal:** a disconnected seat is played by a stand-in using the bot logic (Hearts pattern). `onPlayerRemoved` → `engine.remove(id)`: if the player is still in the round, knock them out (hand to the trail as `knocked-out`, no effect, Duchess included), mark them `left` (skipped in future rounds, never first player), and run the round-end check. If fewer than 2 non-left seats remain → `game-over`, and the remaining player wins (Liar's Dice `forfeit` pattern, `games/liars-dice/src/lib/server/definition.ts:171`). If the active player leaves during `secretary`, keep their hand's first card and return the rest in hand order.
- **Wire-up:** the six places in ADDING_GAMES §7. Add `{ ...callingCardMeta, shelf: 'linen', tagline: 'Hold one card. Be the last one in.' }` to `apps/parlor/src/lib/games/catalog.ts`. Add a RulesModal section with a card table.
- **Reuse from `@parlor/ui`:** `TurnBanner`, `SeatChip` (`out`, `targetable`, `onclick`, `children` for token pips + shield), `CardBoard`, `Felt`, `DrawPile` (count display only; `canDraw` always false, since drawing is automatic), `Button`, `Modal` (Duchess confirm), `GameOver` (standings detail "4 invitations"), `seatTone`.
- **NEW board-kit additions (flag):**
  1. **`CharacterCard.svelte`**: a printed card for named, valued cards. Same stock, outline, size var (`--card-w`) and `--card-back` as `PlayingCard`, with a big Nunito value top-left, the name, a stroke-icon glyph, and an optional one-line effect at `size="lg"`. Props mirror PlayingCard (`faceDown`, `playable`, `selected`, `dimmed`, `marked`, `onclick`). Coup (and later Skull) will need the same thing, so it belongs in `packages/ui/src/lib/cards/`. Coordinate with the Coup brief.
  2. **`CardTrail.svelte`** (smaller): one seat's face-up played cards as an overlapping row of mini `CharacterCard`s, with `how` styling (knock-out cards get a broken-seal mark). Keep it local to the game until a second game needs it, then promote it (Collection Rule).
  - `CardHand` is typed to `@parlor/cards` `Card`. Calling Card's hand is at most 3 cards, so it needs no overlap logic. Render a simple flex row of `CharacterCard`s and don't generalise `CardHand` for v1.

## 8. Board UI

**Shelf colour: `linen`.** Every palette block is already used by at least one game, and linen is the only one used once (Kings Corner). Calling Card would sit after Oh Hell (mustard) on the shelf, so neighbouring blocks differ. Its pieces: card backs printed in **Deep Clay with a cream wax-seal glyph** (`--card-back: var(--color-terracotta-deep)`), and the invitation tokens are small clay seals. That gives the game its identity on its pieces, per the Collection Rule. Surface: the standard `Felt`. (Alternative in §11.)

**Phone (390px)**

```
┌ lid: PARLOR            [?] [Leave] ┐
│ TurnBanner: Your turn              │
│  "Play a card. Tap it again to…"   │
├────────────────────────────────────┤
│ Seats (wide rows, 2–6):            │
│ (B) Bea  ◆◆◇◇  🛡   [1][4][2]       │  ← SeatChip wide + trail
│ (C) Cal  ◆◇◇◇  out  [3][9✕]         │
│ (D) Dot  ◆◆◆◇       [5]   saw: 7   │  ← hint "You saw: Duke"
├──────────── Felt ──────────────────┤
│ [deck 9]   face-up (2p): [4][1][6] │
│ Last: "Bea's Inspector named Butler│
│        on Cal: miss."              │
├────────────────────────────────────┤
│ Your hand                          │
│  ┌──────┐  ┌──────┐                │
│  │3     │  │7     │  (lg cards,    │
│  │Card  │  │Duke  │   effect line) │
│  │Sharp │  │      │                │
│  └──────┘  └──────┘                │
│ Your trail: [0][1]   ◆◆◇◇ (2 of 4) │
└────────────────────────────────────┘
```

Desktop (≥900px): felt and seats on the left (seats around the felt in two columns), with hand + trail + event log (last ~6 events) in a 320px side column. The same components.

**Interactions**
1. **Play:** tap a card to lift it (banner: "Tap the Card Sharp again to play it"), tap again to commit. If the Governess is forced, the other card is `dimmed` and the banner says why.
2. **Target:** if the card needs one, the seats become buttons with the mustard ring (`targetable`). Protected or out seats are not targetable. For a Butler, your own seat is also a target ("Butler yourself"). Tapping a seat selects it. If every other seat is protected, the banner says "Everyone is protected. This card will have no effect." and the second tap plays it.
3. **Guess (Inspector):** after the target, a grid of value chips (name + value, 44px min) appears in the felt. Each chip shows its unseen count when hints are on ("×2"), and a 0 is faded but still tappable. The selection plus one `shout` button "GUESS BUTLER" commits.
4. **Duchess:** choosing to play her opens a `Modal` confirm: "Play the Duchess? You'll be out of the round."
5. **Secretary:** the felt shows your 3 cards. Tap the one to keep (butter). Then the other two go into "Bottom of deck" slots in tap order, with a Swap button. Confirm.
6. **Private reveals:** a Maid / Card Sharp result shows as an in-felt panel only on the entitled phones ("Only you saw this"), dismissed by tap or by the next event. A persistent `known` hint sits on that seat.
7. **Round over:** a felt panel lists each player's revealed card, the set-aside card, the winner(s), "+1 Gossip" if any, and the tokens. Auto-advances after 5.5s (shows a countdown).

**Animations** (moderate; all dropped under reduced motion): the card slides from the hand to its trail. Inspector guess: the chip flies to the target seat, then a "Miss" shake or a knock-out. Knock-out: the hand card flips face up and a wax-seal crack appears on the seat (SeatChip `out`). Card Sharp: a 600ms face-off of two face-down cards between the seats, flipped only for the two players involved. Chaperone: a shield badge pops on. Duke: two backs cross over. Token award: a seal stamps onto the seat.

**Copy**: the banner names the effect in plain words ("Pick who to compare cards with"). The rules use Parlor names everywhere, never "Guard/Princess".

## 9. Bot AI

Runs from `automaticMove()` with the seat's own `memory` + public info only (never peeking at server state). It uses the same function for bots and stand-ins. It is deterministic given the seeded random source.

Derived per decision: `unseen` counts from the bot's point of view; `p(v | X)` ∝ unseen[v] (uniform), or certain if memory knows X.

1. **Forced Governess** → play 8.
2. **Never play the Duchess** (only possible otherwise with Governess + Duchess, so play the Governess).
3. **Sure kills first:** if memory knows X holds v and X is targetable: Inspector with guess v (v≠1). Card Sharp if my other card > v. Butler on X if v = 9 (Duchess).
4. **Choose which card to keep** (play the other), scoring the kept card by value, then by these adjustments: never keep the Gossip if I can play it (play it early); don't keep a Card Sharp if my other card is ≤ 4; prefer to *play* a Chaperone when I hold a high card (≥7); prefer to play the Maid early (information).
5. **Targets** (when no sure kill): among the legal targets, prefer the leader in tokens, then a player whose card I don't know, then random. A Butler targets self only when forced, or when my kept card ≤ 2 and I don't hold the Duchess. Never Butler self while holding the Duchess.
6. **Inspector guess:** the value (≠1) with the most unseen copies for that target, ties to the higher value. If the target's card was revealed by a Duke trade with me, use that.
7. **Duke:** play the Duke only when my other card is ≤ 4 (trade up). Target the player I know holds the highest card, else the leader.
8. **Secretary:** keep the highest card, except the Duchess when 2+ Butlers are unseen (then keep the next highest ≥ 5). Bottom order: the higher card deepest.
9. **Round-start / end:** no decisions.

This is roughly on par with the Hearts/Oh Hell heuristics, and it can later be tuned with `docs/AI_STRATEGIES.md` (Love Letter is a good small MCTS candidate: tiny state, fast playouts).

## 10. Test plan

**Engine (`apps/parlor/src/lib/server/calling-card.test.ts`, seeded `randomInt` + a test-only deck-stacking helper)**
- Setup: court deck has 21 cards and values as in the table. Classic has 16. 2p sets aside 1 face-down + 3 face-up (4 removed) in both editions. Classic with 5 players throws. Auto targets for 2–6 (court) and 2012 2p = 7.
- Turn draws automatically. The view shows 2 cards to the active player only.
- Governess forced with 7 and with 5. Not forced with 9. Voluntary Governess allowed.
- Inspector: hit knocks out (hand to trail as `knocked-out`). Miss does nothing. Guessing 1 rejected. Guessing 0 allowed in court, rejected in classic. Guessing 6 rejected in classic.
- Maid: `seen` only in the player's own view, not the target's, not a third player's, not a spectator's.
- Card Sharp: lower out. Tie nobody. Both cards visible only to the two players. A third party sees `sharpResult` only.
- Chaperone: protected seat rejected as target. Protection ends at the start of the owner's next turn. All others protected → Inspector/Maid/Sharp/Duke playable with no target, `noEffect`. Sending a target anyway is rejected.
- Butler: all others protected → only self is legal. Butler self. Butler forces a Duchess discard → out. Butler-discarded Gossip counts for the bonus. Empty deck → draws the set-aside card (`drewSetAside`).
- Secretary: deck 5 → 3 in hand, phase `secretary`, the 2 returned to the bottom in the given order (verify by drawing order). Deck 1 → returns 1. Deck 0 → no effect, turn ends. Bad multiset rejected. Wrong bottom length rejected. The deck count is unchanged afterwards.
- Duke: hands swap. Both players' `known` update. Trading the Duchess is safe.
- Playing the Duchess voluntarily → out.
- Round end: the last player standing wins mid-deck. The deck emptying ends the round **after** that turn, not before it resolves. Highest card wins. A tie shares tokens (`share`). `discards` tie-break picks the higher discard sum, and an equal sum shares.
- Gossip: a single surviving Gossip player +1. Two players with Gossip → none. A knocked-out Gossip player excluded. The bonus applies on a last-standing end. Round win + Gossip = +2.
- Game end: the threshold reached by two players at once → both in `winnerIds`. Next round starts with the winner. A tie start is picked from the tied winners (seeded).
- Rejections leave the state unchanged (deep-equal the view before/after): wrong turn, wrong phase, card not in hand, illegal target, missing guess.
- Memory: knowledge cleared when the known card is played, on a Butler, and at round start. Kept when the other card is played.
- Disconnect → stand-in plays. No connected humans → `automaticMove()` is null. `remove()` of an active, an inactive, and a secretary-phase player. Removal down to 1 seat → game-over.
- Bots: a full seeded game at 2, 4 and 6 bots + 1 human-stand-in finishes and never throws (fuzz 200 seeds, both editions).

**Socket:** add to `apps/parlor/src/lib/server/seededPlaythroughs.test.ts`. Assert that each player's `game:state` has only their own `myHand`, and that Maid `seen` appears only for the player. **Boundary:** malformed `play`/`secretary` payloads in `actionBoundary.test.ts` (extra keys, a string card, 10, a bottom of length 3).

**Playwright** (`apps/parlor/e2e/calling-card.test.ts`, 390×844, modelled on `e2e/spades.test.ts`): open "How to play" for Calling Card → create a room → vote → add 2 bots → Start → wait for "Your turn" → tap the first enabled hand card twice. If seats become targetable, tap the first. If the guess grid appears, tap the first chip and the GUESS button. If the Duchess confirm appears, cancel and pick the other card. If the Secretary panel appears, keep the first card and confirm. Assert that a card appears on "Your trail" or the banner changes to another player's turn.

## 11. Open questions for the human

1. **Name and theme:** OK with "Calling Card" / the manor-party cast (Gossip … Duchess) and "invitations"? Alternatives: "Sealed Note", "Courier".
2. **Host options:** the platform has no per-game options yet. Build a small generic `gameOptions` lobby mechanism now (it would also serve Classic/Court and other games' variants), or ship Court-only defaults first?
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
