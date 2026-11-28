# Bad Apple (Skull) - Implementation Brief

Parlor's version of **Skull** (Hervé Marly; Lui-même 2011, now Space Cowboys / Asmodee). Rules verified against the publisher-derived sources listed in [Sources](#12-sources); where they disagree, the default chosen here is marked **Default**.

---

## 1. Overview

A pure bluffing game for **3-6 players**, about **15-30 minutes**. Each player owns four face-down discs: three good ones and one bad one. Players stack discs on their own mat, then bid on how many discs they can turn over without hitting a bad one. The highest bidder must turn over their own stack first, then other players' stacks. If they make it, they score. If they don't, they lose a disc for good. Two successful challenges win the game, and so does being the last player with any discs left.

- **Display mode:** peer (everyone on their own phone). Jackbox mode is a good fit later (the table of stacks on the big screen, discs and bids on phones), but it isn't part of this brief.
- **Why it fits Parlor:** the rules take a minute to teach, it works across a mixed-age table, rounds are fast, and the only hidden information is per-player, which suits a server-authoritative engine. It is the first pure-bluffing game on the shelf, and it tests a bluffing UI that a future Coup or Love Letter could reuse.

## 2. Naming & IP

| | |
|---|---|
| **Parlor name** | **Bad Apple** (id `bad-apple`, package `@parlor/bad-apple`) |
| **Theme** | Each player has a **crate** (the mat) and four **apples**: three **good apples** and one **bad apple** (wormy core). A successful challenge turns your crate over to its **ribboned** side, and the second success wins. "One bad apple spoils the bunch" explains the game in five words, and the theme suits children better than a skull does. |
| **Terms** | disc → apple, mat → crate, skull → bad apple, rose/flower → good apple, challenge/bet → **bid**, challenger → **picker**. Code identifiers use neutral words: `disc`, `'good' \| 'bad'`, `crate`, `challenger`. |
| **Do not use** | The names "Skull" or "Skull & Roses", the box art, the skull/rose disc art, the mat illustrations or the rulebook text (docs/LEGAL.md: rename and use our own art and wording; the mechanics themselves are free to use). The rules in `RulesModal` are written in our own words. |
| **Alternatives** | "Thorns" (roses and thorns) or "Poison Cup" if the human prefers. See Open questions. |

The rest of this document says "disc", "good" and "bad" so it matches the code.

## 3. Rules (verified)

### Setup
- Every player gets one crate (unscored side up) and **4 discs: 3 good, 1 bad**. Player count does not change the setup.
- **First player of the game:** chosen at random by the engine (the rules say "choose a first player" any way you like).
- `points` start at 0. The number of wins needed is **2** (fixed by the rules).

### Round structure

**1. Ante (simultaneous).** Every player still in the game places **one** disc of their choice face-down on their crate. No one sees which disc anyone placed.

**2. Placing (turn-based, clockwise from the round's first player, skipping eliminated players).** On your turn, do one of the following:
- **Add** one more disc from your hand face-down on top of your stack, or
- **Open the bidding** by naming a number from 1 up to the total number of discs on all crates.

If you have **no discs left in hand**, you **must** open the bidding. The first player may open on their very first turn, straight after the ante. Once anyone opens, no more discs are placed this round.

**3. Bidding (turn-based, clockwise from the opener, skipping eliminated players and anyone who has passed).**
- On your turn, either **raise** (name any higher number, up to the total on the crates) or **pass**.
- A pass is final for this round: you cannot bid again.
- The opener may not pass on the opening action. The opener must name a number.
- Bidding ends when **every player but one has passed**, or **immediately when someone bids the total** number of discs on the crates. The highest bidder becomes the **challenger**.

**4. Revealing (challenger only, one disc at a time).**
- The challenger flips **their own stack first, from the top down**. If the bid is smaller than their own stack, they flip only until the bid is reached (**Default**, following BGA and the official rules: the challenge is won the moment `bid` good discs are showing).
- Once their own stack is used up, they choose **any other player's stack** and flip its **top** unflipped disc. They may switch stacks freely between flips and do not have to empty a stack.
- The moment a **bad** disc is revealed, flipping stops and the challenge **fails**.
- If `bid` good discs are showing, the challenge **succeeds**.
- Flipped discs stay face-up until the round ends. Unflipped discs are never revealed.

**5a. Success.** The challenger turns their crate over (`points` goes up by 1). At **2 points they win the game immediately**.

**5b. Failure: losing a disc.** First, every player takes their placed discs back into hand. Then the challenger permanently loses **one** of their (now 1-4) discs:

| Whose bad disc was revealed | Who picks the lost disc | How |
|---|---|---|
| **Another player's** | **The owner of that bad disc** | The challenger's discs are shuffled face-down and the owner picks one **blind** (so it is effectively random). |
| **The challenger's own** | **The challenger** | They choose which of their own discs to lose, knowing what each one is. |

- The lost disc goes back in the box **face-down**. **Nobody except its former owner ever learns what it was**: not the player who picked it, not the other players, not spectators. Everyone does see that the challenger's disc count went down by one.
- If the challenger has no discs left, they are **eliminated**. Their crate is removed and they are skipped from now on (they stay in the standings and can still watch).

**6. Next round's first player.**

| Outcome | First player next round |
|---|---|
| Challenge succeeded (game not over) | Challenger |
| Challenge failed, challenger still in | Challenger |
| Challenger **eliminated by another player's** bad disc | **The owner of that bad disc** |
| Challenger **eliminated by their own** bad disc | **The challenger chooses** any remaining player (BGA picks automatically. Parlor lets them choose, and a stand-in or bot picks the next player clockwise.) |

All placed discs return to their owners' hands, and the next round starts with the ante.

### Game end
- A player reaches **2 points**: they win.
- **Only one player is left in the game:** they win, whatever their points.
- Ties cannot happen, because only one challenger acts per round.
- **Standings** for `GameOver`: the winner first, then the other players still in the game sorted by points and then by discs left, then eliminated players in reverse order of elimination (the last one out ranks highest).

### Edge cases & FAQ rulings (defaults)

| Situation | Ruling |
|---|---|
| A player has only 1 disc left | They ante it and have nothing in hand, so on their placing turn they must open the bidding. If that disc is bad and they end up challenging, they flip it, fail, and are eliminated. |
| Every player has emptied their hand during placing | The next player to act must open. That can't deadlock, because a forced open is always legal (bid 1 is allowed). |
| Opener bids the total immediately | Bidding is skipped and the opener reveals at once. |
| A raise over the total | Rejected. The maximum is the total number of discs on the crates. |
| A player who passed wants back in | Rejected: a pass lasts the whole round. |
| Bid is smaller than the challenger's own stack | Only the top `bid` of their own discs are flipped, and then they win. A bad disc lower down stays hidden. |
| Flipping another stack before your own is used up | Rejected ("Turn over your own apples first."). |
| Flipping a disc that isn't on top | Not possible: the action names a player, not a disc, and the server always flips that stack's top unflipped disc. |
| Challenger flips their **own** bad disc as their last disc | Failure, own-skull branch: the challenger picks the disc to lose (here the only disc left), is eliminated, and chooses the next first player. |
| Lost disc chosen while some discs are still on crates | Can't happen: discs return to hand first, so the challenger loses one of **all** their remaining discs. |
| Bad disc owner is the one who gets eliminated | Not possible: only the challenger ever loses discs. |
| 2 players left | Play continues normally. A bid can still go up to the total. |
| Accidental reveal | Can't happen digitally. |
| A player loses their bad disc | They can still play. Nobody else is told. They can still bluff with good discs. |
| Opener passes instead of bidding | Not allowed: opening is itself a bid of at least 1. |

**Rulebook conflict noted:** some summaries (rulespal) say a challenger who hits their own bad disc loses a *random* disc, and that the bad disc's owner *chooses* (rather than picks blind). **Default:** follow the official Space Cowboys rules as reflected by BGA, Wikipedia and Meeple Like Us: the owner picks blind and the challenger chooses after hitting their own bad disc. Section 4 offers a host toggle.

## 4. Host options

The platform has **no host-options plumbing yet** (`GameMeta` has no options field, and engines take constants as constructor arguments, like Hearts' `goal`). Build the engine with a `SkullOptions` constructor argument now, using these defaults, and add the lobby UI once the platform supports options. See Open questions.

| Option | Values | Default | Notes |
|---|---|---|---|
| `ownBadLoss` | `'choose'` / `'random'` | `'choose'` | Rulebook conflict from section 3. |
| `revealPaceMs` | 0 / 600 / 1200 | 600 | A short suspense pause before each flip is shown (the definition holds a `revealing-flip` beat; see section 6). |
| Turn timer | platform-level | off | Not game-specific. |

No published variants are worth exposing at launch. The 2023 "Last Chance" disc and the 12-player combined sets are out of scope.

## 5. State model

```ts
// types.ts
export type Disc = 'good' | 'bad';
export type BadApplePhase =
  | 'ante'            // simultaneous: every live player with nothing placed places 1
  | 'placing'         // active player: place or open
  | 'bidding'         // active player: raise or pass
  | 'revealing'       // challenger flips one at a time
  | 'penalty'         // picker (bad-disc owner, or challenger after own bad) picks the lost disc
  | 'choose-starter'  // challenger eliminated by own bad disc picks next first player
  | 'round-over'      // reveal pause; advanceReveal() → next ante or game-over
  | 'game-over';

export interface BadAppleOptions { ownBadLoss: 'choose' | 'random' }

/** Server only (engine.ts). */
interface Seat {
  id: string; name: string; bot: boolean; connected: boolean;
  hand: Disc[];            // discs not on the crate (private)
  stack: Disc[];           // placed, index 0 = bottom (private until flipped)
  flipped: number;         // how many from the TOP of stack are face-up this round
  points: 0 | 1 | 2;
  eliminatedOrder: number | null; // 1 = first out
  passed: boolean;         // this round's bidding
  lastBid: number | null;  // this round, public (bots use it)
}
interface EngineState {
  seats: Seat[];           // seat order = clockwise
  phase: BadApplePhase;
  round: number;
  starter: number;         // seat index that starts this round's placing
  active: number;          // seat index to act (placing/bidding/revealing/penalty/choose-starter)
  bid: number | null;  bidderId: string | null;  openerId: string | null;
  challengerId: string | null;
  flips: { ownerId: string; disc: Disc }[];   // this round, in order (public)
  badOwnerId: string | null;                  // owner of the revealed bad disc
  penaltySlots: number;                       // face-down choices offered to a blind picker
  result: RoundResult | null;
  winnerId: string | null;
}
export interface RoundResult {
  challengerId: string;
  bid: number;
  success: boolean;
  badOwnerId: string | null;
  lostDisc: boolean;            // challenger lost a disc
  eliminatedId: string | null;
  nextStarterId: string | null; // null when game over
}
```

### Per-player view (`view(id?)`)

```ts
export interface BadAppleView {
  phase: BadApplePhase;
  round: number;
  options: BadAppleOptions;
  players: {
    id: string; name: string; bot: boolean; connected: boolean;
    seat: number;
    discCount: number;        // hand + stack (public: physically countable)
    handCount: number;
    stackCount: number;
    flippedCount: number;     // face-up from the top of the stack
    anted: boolean;           // during 'ante': has placed (not what)
    points: number;
    eliminated: boolean;
    passed: boolean;
    lastBid: number | null;
  }[];
  activePlayerId: string | null;      // null during 'ante' and reveal phases
  starterId: string;
  totalOnCrates: number;
  bid: number | null; bidderId: string | null; challengerId: string | null;
  flips: { ownerId: string; disc: Disc }[];   // public once flipped
  badOwnerId: string | null;
  result: RoundResult | null;
  winnerId: string | null;

  // Private to `id` (empty/null for others and spectators)
  myHand: Disc[];                     // sorted good-first; composition is secret
  myStack: Disc[];                    // own placed discs, bottom→top
  canAnte: boolean;
  canOpen: boolean; mustOpen: boolean; canPlace: boolean;
  legalBids: number[];                // opening: 1..total; raising: bid+1..total
  canPass: boolean;
  flipTargets: string[];              // player ids whose top disc may be flipped now
  penalty:                           // only for the picker
    | { kind: 'blind'; slots: number }        // pick slot 0..slots-1, faces unknown
    | { kind: 'choose'; discs: Disc[] }       // challenger's own discs, faces known
    | null;
  starterChoices: string[];           // 'choose-starter' only, for the challenger
}
```

**Secrecy rules (test each as acting player, another player, and spectator):**
- Another player's `hand`/`stack` composition never appears. Only counts appear, plus face-up discs in `flips`.
- **The lost disc is never broadcast.** `RoundResult` says only `lostDisc: true`. The challenger learns it because `myHand` shrinks. The blind picker sees only `slots`. The server shuffles the challenger's discs with `fisherYatesShuffle(this.randomInt)` each time it enters `penalty`, so a slot index tells the picker nothing.
- `legalBids`, `flipTargets` and `penalty` belong only to the player who can act on them.
- Spectators get the public view with every private field empty.
- At `round-over`, unflipped discs stay hidden. Hands are rebuilt from `hand + stack` without revealing anything.

### State machine

```
            ┌──────────────── advanceReveal (round-over) ─────────────────┐
            ▼                                                             │
 [ante] ──all live players anted──▶ [placing] ──open(n)──▶ [bidding]      │
   (simultaneous)                    │ place → next live seat   │ raise/pass
                                     │ hand empty ⇒ must open   │ (skip passed)
                                     └── open(total) ───────────┤
                                                                ▼
                       all-but-one passed OR bid==total ──▶ [revealing]
                                                     flip ─┬─ good & count==bid ─▶ success
                                                           └─ bad ─▶ return discs to hands ▶ [penalty]
 success: points++ ─▶ points==2 ? [game-over] : [round-over]
 penalty: lose disc ─▶ discs==0 ? eliminate : –
          live==1 ? [game-over]
          eliminated && own bad ? [choose-starter] ─pick─▶ [round-over]
          else [round-over]  (starter = rules in §3.6)
```

## 6. Actions

All actions are **turn-based** except `ante`, which every live player does at once (the ante order is hidden, and nothing is shown until everyone has placed).

| Action | Payload | Phase / who | Validation (throw `GameRuleError` before mutating) | Effect |
|---|---|---|---|---|
| `ante` | `{ type: 'ante'; disc: Disc }` | `ante`, any live seat with an empty stack | disc in hand | Push to stack. When every live seat has anted, `phase='placing'`, `active=starter`. |
| `place` | `{ type: 'place'; disc: Disc }` | `placing`, active | Hand contains `disc` | Push. `active` = next live seat. |
| `open` | `{ type: 'open'; amount: number }` | `placing`, active | Integer with `1 ≤ amount ≤ totalOnCrates` | `bid=amount`, bidder=opener. If `amount==total`, go to `revealing`. Otherwise go to `bidding` with `active` = next live, unpassed seat. |
| `raise` | `{ type: 'raise'; amount: number }` | `bidding`, active, not passed | Integer with `bid < amount ≤ total` | Update bid and bidder. If `amount==total`, go to `revealing`. Otherwise advance. |
| `pass` | `{ type: 'pass' }` | `bidding`, active | Turn order never reaches the high bidder, so no extra check is needed | `passed=true`. If only the bidder is left unpassed, go to `revealing`. Otherwise advance. |
| `flip` | `{ type: 'flip'; targetId: string }` | `revealing`, challenger | `targetId` in `flipTargets`: own seat while own unflipped>0; otherwise a live non-self seat with unflipped>0 | Reveal the top unflipped disc of that stack and append to `flips`. If it is bad, `failure()`. If good discs flipped equal `bid`, `success()`. |
| `lose-disc` | `{ type: 'lose-disc'; index: number }` | `penalty`, picker | Integer index in range (`slots` for blind; `discs` for choose) | Remove it from the challenger. Eliminate at 0. Resolve the next starter. |
| `choose-starter` | `{ type: 'choose-starter'; playerId: string }` | `choose-starter`, eliminated challenger | Must be a live player | `starter` = chosen seat, `phase='round-over'`. |

- **`validateAction`** (definition.ts) uses `hasExactKeys`. `disc` must be `'good' | 'bad'`. `amount` and `index` must be safe integers with `1 ≤ amount ≤ 24` and `0 ≤ index ≤ 3`. `targetId` and `playerId` must be strings of at most 64 characters. Return `invalid(...)` otherwise.
- **Picker in `penalty`:** `active` = `badOwnerId` (blind), or the challenger when they hit their own bad disc (choose). With `ownBadLoss='random'`, the engine resolves the own-bad case immediately with `randomInt`, without a `penalty` phase.
- **If the challenger has exactly 1 disc left** when the penalty applies, skip the pick (there is nothing to choose) and resolve straight away. In the blind case the owner's tap is pointless, so the engine auto-resolves.
- **Timing / reveal moments (definition `drive`):**
  - `round-over` → `advanceReveal()` after **3500 ms** (success) or **4500 ms** (failure, enough time to read who lost a disc and who starts).
  - Bots and stand-ins act after **~700 ms**, a little slower than Hearts' 400 ms, so a bluff reads as a decision. During `revealing`, a bot's flips are paced at **`900 ms`** so humans can follow along.
  - Optional `revealPaceMs` suspense: the client shows a lift-and-turn animation for that long before showing the face. The server state changes instantly, and the animation is purely client-side, keyed by `flips.length`.
- **Automation (`automaticMove`)** covers every phase. In `ante`, it returns one move per automated seat that hasn't anted, one per call. Like Hearts, it pauses when no connected human remains.

## 7. Mapping to this codebase

- **Package:** `games/bad-apple/` → `@parlor/bad-apple`, id `'bad-apple'`. No `@parlor/cards` dependency.
- **Files (per docs/ADDING_GAMES.md):**

| File | Contents | Copy from |
|---|---|---|
| `package.json`, `tsconfig.json`, `turbo.json` | standard | `games/hearts/` |
| `src/types.ts` | Section 5 types + `declare module '@parlor/game-types'` | `games/hearts/src/types.ts` |
| `src/meta.ts` | `name: 'Bad Apple'`, `minPlayers: 3`, `maxPlayers: 6`, `estimatedMinutes: '15-30'`, `tags: ['bluffing', 'party']`, `displayModes: ['peer']`, `supportsBots: true` | `games/hearts/src/meta.ts` |
| `src/rules.ts` | Pure helpers: `totalOnCrates`, `legalBids`, `flipTargets`, `nextLiveSeat`, `nextStarter(result)` | `games/hearts/src/rules.ts` |
| `src/bot.ts` (or inside engine) | Section 9 | `automaticMove` in `games/hearts/src/engine.ts` |
| `src/engine.ts` | `BadAppleEngine(players, randomInt = secureRandomInt, options = DEFAULTS)`: `ante/place/open/raise/pass/flip/loseDisc/chooseStarter`, `advanceReveal`, `automaticMove`, `setConnected`, `view` | `games/hearts/src/engine.ts` |
| `src/definition.ts` | `drive()` with reveal = `round-over`; schedule key `'bad-apple-step'` | `games/hearts/src/definition.ts` |
| `src/GameView.svelte` | Section 8 | `games/hearts/src/GameView.svelte`, `games/oh-hell/src/GameView.svelte` (bid grid) |
| `src/Disc.svelte`, `src/Crate.svelte` | Game pieces | new |

- **Wiring:** the six places in ADDING_GAMES.md section 7, **plus** `apps/parlor/src/lib/games/catalog.ts` (add `{ ...badAppleMeta, shelf: 'linen', tagline: 'Bluff, bid, and dodge the bad apple' }`). Add the rules section to `RulesModal.svelte` under the headings "Setting up", "Placing", "Bidding", "Turning over" and "Losing an apple".
- **`onPlayerRemoved`:** like Hearts, the seat stays and is played by a stand-in. Removing the seat mid-round would change the total and break a bid that is already in progress. *Alternative for later:* at the next `round-over`, mark the seat eliminated with its discs gone. See Open questions.
- **Reuse from `@parlor/ui`:** `TurnBanner` (always first), `SeatChip` (`out` for eliminated players, `active`, `you`, `bot`, `connected`, `targetable` + `onclick` for flip targets and starter choice, and a `children` snippet for disc count and crate points), `Felt` (default felt tone as the orchard table), `Button` (`shout` for the main move, `secondary` for the bid grid), `GameOver` (standings measure: "2 crates" / "3 apples left" / "out 2nd"), `seatTone`.
- **New pieces:** `Disc` (a round printed token with an ink outline: back, good face, bad face) and `Crate` (a player's stack seen from the side, with a points ribbon). **Keep them in the game package for now.** Under the Collection Rule they become a board-kit addition (`@parlor/ui/tokens/Disc.svelte`, a generic face-down token stack) as soon as a second game needs face-down tokens (Coup's coins and influence, Love Letter). **Flag: candidate board-kit addition `TokenStack`.**
- **Tests:** `apps/parlor/src/lib/server/bad-apple.test.ts` (copy the shape of `hearts.test.ts`). Add the game to `seededPlaythroughs.test.ts` and malformed payloads to `actionBoundary.test.ts`. Add `apps/parlor/e2e/bad-apple.test.ts` (shape of `e2e/spades.test.ts`).

## 8. Board UI

**Shelf colour: linen.** Linen is the only palette colour used by just one game (Kings Corner). The felt, mustard, clay and ink spines each appear twice already. The pieces carry the identity: disc **backs in Deep Clay** (apple-skin red) with a cream leaf glyph, **good faces** on paper with a clay apple and forest leaf, the **bad face** in espresso with a cream wormy core. Crates are linen boxes with an ink outline, and the scored side shows a mustard ribbon. The board plays on `Felt` (the default felt tone reads as orchard grass).

### Phone (390px)

```
┌────────────────────────────────┐
│ TurnBanner: "Your turn"        │
│ "Add an apple or start a bid." │
├────────────────────────────────┤
│ Felt ─ the table               │
│ ┌──────┐ ┌──────┐ ┌──────┐     │  one crate per seat (2-3 per row)
│ │Ana ⓡ │ │Bo    │ │Cy  ⓡ │     │  name + ribbon if 1 point
│ │ ◖◖◖  │ │ ◖    │ │ ◖◖   │     │  stacked disc backs (count visible)
│ │ 4 ●  │ │ 3 ●  │ │ 2 ●  │     │  discs left
│ └──────┘ └──────┘ └──────┘     │
│ Bid: 5 by Ana · 9 on crates    │  heading row on the felt
├────────────────────────────────┤
│ Your crate: [◐ good][◐ bad]    │  own stack face-up to you only
│ Your hand:  (good)(good)       │  tap to lift, tap again to place
│ [ START A BID ]  (shout)       │
└────────────────────────────────┘
```

- **Bidding:** a bid grid replaces the hand (`legalBids` as `secondary` buttons in an auto-fit grid, as in Oh Hell, up to 24 numbers) plus a **Pass** outline pill. Tap a number to select it, then press **BID 6** (shout) to confirm, so a mis-tap can't commit a bid.
- **Revealing:** flippable crates wear the **mustard ring** (`targetable`). Your own crate is the only one ringed until its discs are used up. Tap a crate to flip its top disc (a single tap, because the target is already deliberate and the next flip is forced anyway). A counter reads "3 of 5 good apples".
- **Penalty (blind):** the bad disc's owner sees N face-down Deep Clay discs in a row: "Pick one of Bo's apples to throw away." Tap one to lift it, tap again to confirm. **Penalty (choose):** the challenger sees their own faces and picks one the same way.
- **Choose starter:** seats become `targetable` SeatChips with the banner "Choose who starts the next round."
- **Round-over:** a banner such as "Ana turned over 5 good apples!" or "Bad apple! Bo loses an apple." with the next starter named.

### Desktop

The same order, wider: the crates sit in a single row (up to 6) on a wider Felt. Your hand and the controls sit in a side column (≥1024px) so the table and the controls are both visible without scrolling.

### Animations (moderate)
- A disc slides onto the stack when placed (others see a back appear).
- **Flip:** a 3D Y-axis turn of about 300 ms, after the optional `revealPaceMs` lift. A bad flip gets a short shake on the crate.
- The crate turns over to its ribbon side when a player scores.
- A lost disc slides off-screen face-down.
- Honour `prefers-reduced-motion` with a cross-fade only.

## 9. Bot AI

Bots act through `automaticMove()`, which returns a closure as in Hearts. Randomness comes from the injected `randomInt`, so tests are deterministic. Bots read only their own seat plus the public view.

| Decision | Heuristic |
|---|---|
| **Ante** | If the hand holds the bad disc: place it with 30% chance, otherwise a good one. If only the bad disc is in hand, place it. |
| **Place vs open** | Must open if the hand is empty. If my stack has a bad disc, keep placing good discs (this builds the trap) until the hand is empty or `total ≥ live+3`, then open with **1** (a bluff). If my stack is clean, open when `total ≥ live + 1` with chance 50%, otherwise place a good disc. |
| **Opening amount** | Clean stack: `min(total, myStack + floor(0.4 × othersOnCrates))`, at least `myStack`. Dirty stack: 1. |
| **Estimate E** | `-∞` if my stack contains bad. Otherwise `myStack + floor(p × others)`, where `p = 0.6` minus 0.1 for each opponent whose `lastBid` is null (players who stayed quiet are more likely to be holding a trap). |
| **Raise / pass** | Raise to `bid+1` if `bid+1 ≤ E`, otherwise pass. |
| **Flip target** | Own stack first (forced). Then score each other stack: +2 if that player bid this round (a bidder probably has a clean stack), +1 if the stack has already shown a good disc, −1 if that player never bid, +0.5 if the stack has 2 or more unflipped discs. Break ties at random. |
| **Blind penalty pick** | A random slot. |
| **Own-bad penalty pick** | Throw away a **good** disc while 2 or more good discs remain, so the bad one is kept for bluffing. Otherwise throw away the bad disc. |
| **Choose starter** | The next live seat clockwise. |

Stand-ins for disconnected humans use the same bot.

## 10. Test plan

### Engine unit tests (`apps/parlor/src/lib/server/bad-apple.test.ts`)

Every rejection test asserts that the action throws `GameRuleError` and that `view()` is deep-equal before and after.

1. **Setup:** 3 and 6 players each get 4 discs (3 good, 1 bad). The constructor throws for 2 or 7 players. The starter is drawn from `randomInt`.
2. **Ante:** simultaneous. A player can't ante twice. A player can't ante a disc they don't hold. The phase becomes `placing` only after every live seat has anted. Before all have anted, other views show `anted` but not the disc.
3. **Placing:** only the active seat may place. Rejected: placing out of turn, placing from an empty hand, `open(0)`, and `open(total+1)`. **A player with an empty hand must open**: `place` is rejected and `mustOpen` is true.
4. **Bidding:** a raise must be higher than the current bid. A pass is final, and turn order skips passed players. An opener's `open(total)` goes straight to `revealing`. A raise to the total ends bidding. When all but one have passed, the highest bidder becomes the challenger, **including when the opener is the only one left**.
5. **Reveal order:** a flip on another stack while own discs remain unflipped is rejected. Flips take the top of the stack: a stack of [bad(bottom), good(top)] reveals good first. `bid < ownStack` succeeds without revealing the rest. A stack with nothing left to flip is rejected as a target.
6. **Success:** `points` goes from 0 to 1, and the next starter is the challenger. A second success makes the phase `game-over` with `winnerId` set.
7. **Failure, other's bad disc:** the phase becomes `penalty`, the picker is `badOwnerId`, and the view shows `{kind:'blind', slots: challengerDiscs}` to the owner only. The challenger's disc count drops by 1. The challenger starts the next round.
8. **Failure, own bad disc:** the picker is the challenger with `{kind:'choose'}`. Under `ownBadLoss='random'` there is no penalty phase.
9. **Lost disc is hidden:** after the penalty, the views of the picker, a third player and a spectator, and every `RoundResult`, contain no field revealing the lost disc's face. Only the challenger's `myHand` changes. Penalty slot order changes with the seed.
10. **Discs return before the loss:** a challenger with 4 discs (2 placed) loses from all 4 (`slots === 4`).
11. **Elimination by another's bad disc:** a challenger with 1 disc hits the owner's bad disc and is eliminated. The next starter is the **bad disc's owner**. The eliminated seat is skipped in ante, placing and bidding.
12. **Elimination by own bad disc:** the phase becomes `choose-starter`. Only the challenger may act. Choosing an eliminated player or themselves is rejected. After a choice, `starterId` is the chosen player.
13. **Last player standing:** when an elimination leaves one player, the phase becomes `game-over` with that player as winner, **without** going through `choose-starter`.
14. **Total-on-crates max** after eliminations (e.g. 2 live players with 3 discs each).
15. **Stand-ins:** a disconnected seat moves through every phase (`ante`, `place`/`open`, `raise`/`pass`, `flip`, `lose-disc`, `choose-starter`). `automaticMove()` returns undefined when no connected human remains.
16. **Bot soak:** 200 seeded all-bot games at 3 and 6 players (with one fake connected human) always end in `game-over` within 200 rounds, and no action throws.
17. **Standings order:** winner, then live players by points and discs, then eliminated players by order of elimination.

### Socket / boundary
- `seededPlaythroughs.test.ts`: one seeded game end to end. Assert that each socket receives only its own `myHand`/`myStack`, and that the spectator view has every private field empty.
- `actionBoundary.test.ts`: `{type:'open', amount:'3'}`, `amount: 2.5`, `disc:'skull'`, `index:-1`, extra keys, and `targetId` as an object are all rejected.

### Playwright smoke (`apps/parlor/e2e/bad-apple.test.ts`, 390×844)
1. Home → open "How to play" for Bad Apple, see the "Bidding" heading, and close it.
2. Create a room, vote for Bad Apple, add 2 bots, and start.
3. Ante a good apple (tap it, then tap again). The banner changes once the bots have anted.
4. On your placing turn, press **START A BID**, pick **1**, and confirm.
5. Wait until you are the challenger, or a bot is revealing. If you are the challenger, tap your own ringed crate and see a face-up good apple and "1 of 1".
6. Expect a round-over banner. Use `allTextContents()` for optional banners (per the project's Playwright notes).

## 11. Open questions for the human

1. **Name:** "Bad Apple" (recommended), "Thorns" or "Poison Cup"?
2. **Host options:** should this game wait for a platform-level options mechanism, or ship with the defaults hard-coded (own bad disc → challenger chooses)?
3. **Leaving mid-game:** a stand-in for the rest of the game (default, as in Hearts), or eliminate the seat at the next round boundary?
4. **Shelf colour:** linen puts it next to Kings Corner's linen. Is that fine for the planned shelf order, or should the spine be clay to match the apple-red pieces?

## 12. Sources

- Board Game Arena, *Skull* game help (BGA's implementation of the official rules; own-stack-first, top-of-stack, random loss vs own-skull choice, next-first-player rules, max-bid auto-end): https://en.doc.boardgamearena.com/Gamehelpskull
- BGA game panel: https://en.boardgamearena.com/gamepanel?game=skull
- Space Cowboys official rulebook (PDF link from search; the server refused automated download, so its rules were cross-checked through BGA and the sources below): https://www.spacecowboys.fr/_files/ugd/59baa2_a7befd4787684a0d9adce3ed85f62ce5.pdf
- Wikipedia, *Skull (card game)* (designer, publisher, skull owner picks the lost disc at random, elimination, end conditions): https://en.wikipedia.org/wiki/Skull_(card_game)
- Meeple Like Us, *Skull (2011)* review (the challenger fans out discs face-down and the skull owner picks one; nobody else sees it): https://www.meeplelikeus.co.uk/skull-2011/
- Rulespal, *Skull* rulebook summary + FAQ index (forced challenge with an empty hand, permanent pass, one-disc player; conflicting own-skull ruling): https://rulespal.com/skull/rulebook, https://rulespal.com/skull/faq
- Official Game Rules, *Skull* (the skull owner removes a disc; FAQ conflict on own skull): https://officialgamerules.org/game-rules/skull/
- Zatu, *How to play Skull*: https://zatu.com/how-to-play-skull/
- BoardGameGeek entry (reference): https://boardgamegeek.com/boardgame/92415/skull
