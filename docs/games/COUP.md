# Cloak & Coin (Coup-style bluffing): implementation brief

> Working reference: *Coup* (Rikki Tahta, Indie Boards & Cards / La Mame, 2012). Internal docs may say "Coup"; nothing player-facing may. See §2.

## 1. Overview

Each player secretly holds two courtier cards and a few coins. On your turn you take one action. Some actions need a particular courtier, and you can claim that courtier whether or not you hold it. Any player can call your bluff, and some actions can be blocked by claiming another courtier. When you lose a challenge or get ousted, you turn one of your courtiers face up. Lose both and you're out. The last player with a hidden courtier wins.

| | |
|---|---|
| Players | 2–6 (best at 4–6) |
| Time | 10–15 min |
| Display | `peer` (each phone shows its own hand). Jackbox mode is out of scope until the platform has it. |
| Bots | Yes |
| Hidden info | Your own hidden cards. Server only: the deck, other hands, and exchange draws. |

**Why it fits Parlor:** the game is short and loud, and people know it from the box. The rules fit on one card, and players get knocked out quickly enough that "one more" works well with persistent lobbies. Hidden hands on your own phone are exactly what Parlor already does. The hard part is online-specific: the **response windows** (§3.5, §6.3), which replace "anyone can shout *I challenge!*" at a real table.

## 2. Naming & IP

LEGAL.md says to rename the game **and** the five characters, keep the mechanics identical, and use our own art and rules text.

- **Game name:** **Cloak & Coin** (id `cloak-and-coin`). Web search found no game by this name. The nearest titles are "King's Cloak" and "Card & Coin", both unrelated. Avoid "Court of Whispers" and "Palace Whispers/Palastgeflüster", which are existing titles.
- **Theme:** a royal court where everyone has two secret allies. Exposing an ally ("a courtier is exposed") replaces "losing influence". The vocabulary stays family-friendly: no "assassinate".

| Original (never shown) | Parlor courtier | id | Action (id) | Blocks |
|---|---|---|---|---|
| Duke | **Chancellor** | `chancellor` | **Levy** (`levy`): take 3 | Aid |
| Assassin | **Rogue** | `rogue` | **Ambush** (`ambush`): pay 3, target exposes 1 | — |
| Captain | **Smuggler** | `smuggler` | **Steal** (`steal`): take up to 2 from target | Steal |
| Ambassador | **Diplomat** | `diplomat` | **Swap** (`swap`): exchange with the deck | Steal |
| Contessa | **Bodyguard** | `bodyguard` | — | Ambush |

| Original general action | Parlor | id |
|---|---|---|
| Income | **Income** | `income` |
| Foreign Aid | **Aid** | `aid` |
| Coup | **Oust** | `oust` |

**Must not use:** "Coup", "The Resistance", the five original character names, the box or card art, the dystopian theme, or the reference-card layout or text. The rules in `RulesModal` must be written in our own words. No "inspired by Coup" wording in the UI.

## 3. Rules (verified)

Checked against the published rules as transcribed by rulespal and lehi-innovation, plus Dized's Q&A on ordering (§12). The original PDF couldn't be text-extracted here. Three FAQ answers were seen only as questions, not answers: Swap with one card, declining to prove, and Steal from 0. Our defaults for those follow the rulebook wording and common play; re-check them against the PDF. Where sources disagree or say nothing, the default we chose is marked **Default**.

### 3.1 Setup
- Deck: 15 cards, 3 of each courtier. Shuffle and deal 2 face down to each player. The rest is the **court deck** (always 15 − 2N: 11 cards at 2 players, 3 at 6).
- Each player gets **2 coins**. The treasury is effectively unlimited (the box has 50 coins). **Default:** unlimited; don't model the box's limit.
- **First player:** random for the first game. On Play again, the previous winner goes first (rulebook). Play goes clockwise, which is seat order.
- **2 players:** the first player starts with **1 coin** instead of 2 (rulebook). The alternate "draft" setup is a host option (§4).

### 3.2 Turn
The active player must take exactly one action. Passing is not allowed.

| Action | Cost | Claim | Target | Effect | Challengeable | Blockable by |
|---|---|---|---|---|---|---|
| Income | 0 | — | — | +1 | no | no |
| Aid | 0 | — | — | +2 | no | **anyone** claiming Chancellor |
| Oust | 7 | — | yes | target exposes 1 | no | no |
| Levy | 0 | Chancellor | — | +3 | yes | no |
| Ambush | 3 | Rogue | yes | target exposes 1 | yes | **target only**, claiming Bodyguard |
| Steal | 0 | Smuggler | yes | move min(2, target coins) to actor | yes | **target only**, claiming Smuggler or Diplomat |
| Swap | 0 | Diplomat | — | draw 2, keep as many as you have hidden, return the rest, shuffle | yes | no |

- **Forced oust:** if you **start** your turn with ≥10 coins, Oust is your only legal action.
- **Costs are paid when you declare.** Oust needs ≥7 and Ambush needs ≥3 coins when declared. Targets must be other players who are still in the game.
- A claim doesn't have to be true. The UI marks your bluffs for you, privately (§8).

### 3.3 Challenges
- **Any player still in the game** (not only the target) may challenge **any claim**: an action's courtier, or a block's courtier. A player who is out cannot.
- A challenge has to come right after the claim. In Parlor, that means inside the challenge window (§3.5).
- **Resolution:** the challenged claimant either **proves** it (shows a hidden card of the claimed courtier) or **concedes** (exposes a hidden card of their choice).
  - **Proved:** the challenger exposes 1 card. The claimant shuffles the shown card into the court deck and draws a replacement, which nobody else sees. The action or block then goes ahead.
  - **Conceded or can't prove:** the claimant exposes 1. The action or block **fails**. If it was an Ambush, the **3 coins are refunded** (rulebook).
- **FAQ, decline to prove:** the rulebook wording ("can't, or does not wish to") lets a truthful claimant concede. **Default:** allowed, so the prompt always offers both choices (this also keeps the timing from giving the answer away, §6.3).
- **FAQ, multiple challengers:** the rulebook doesn't decide who it is. **Default:** the first challenge the server receives wins, and the window closes for everyone else. See §11.

### 3.4 Blocks
- Blocks are claims, so they can be challenged by any player still in the game **including the actor**, but not by the blocker.
- **Order (Dized ruling):** challenges against the action are settled **first**. Only then may someone block, and then the block can be challenged.
- An unchallenged block, or one the blocker proves, cancels the action. **Coins paid stay spent:** an Ambush blocked by a Bodyguard does not refund.
- A block on **Aid** can come from any one other player who is still in. The first block wins.

### 3.5 Sequence for one turn (canonical)
```
declare ─► (claim?) CHALLENGE-ACTION window ─┬─ nobody ─────────────┐
                                             └─ challenge ─► claimant answers ─► reveal
                                                     proved: challenger exposes, claimant redraws ─┐
                                                     conceded: action fails (ambush refunded) ─► END
(blockable & target still in?) BLOCK window ◄────────────────────────────────────────────────────┘
   ├─ nobody blocks ─► RESOLVE
   └─ block ─► CHALLENGE-BLOCK window ─┬─ nobody ─► block stands ─► END
                                       └─ challenge ─► blocker answers ─► reveal
                                               proved: challenger exposes, blocker redraws, block stands ─► END
                                               conceded: block fails ─► RESOLVE
RESOLVE: levy/aid/steal coins · swap → actor chooses · ambush/oust → target exposes 1 (if still in)
END: eliminations, game-over check, next player still in (clockwise)
```
- Income goes straight to RESOLVE. Oust pays and goes straight to RESOLVE. Aid skips the action-challenge window because it makes no claim.
- **Two exposures in one turn are possible** (rulebook example). Ambush, target blocks with a bluffed Bodyguard, the block is challenged, the target concedes (exposes 1), and then the Ambush resolves (target exposes another).
- **Target out before RESOLVE** (e.g. the target challenged the Rogue, lost, and that was their last card): the effect fizzles, and the Ambush coins stay spent (the claim was proven).
- **Actor out before RESOLVE** (e.g. a Steal is blocked, the actor challenges the block, loses, and was on their last card): the block stood anyway, so END.

### 3.6 Exposing and elimination
- To expose, the player picks which hidden card turns face up. It stays public for the rest of the game. **Default:** if only one card is hidden it is exposed automatically, with no prompt.
- When both are face up, the player is **out**. Their coins go back to the treasury, and they can still watch (with their own hand visible).
- **Win:** the last player still in. There is no second place in the rulebook. **Default:** standings are ordered by when players went out, so the GameOver list has an order.

### 3.7 Swap details
- Draw 2 from the court deck. Pick `k` cards to keep from your hidden cards plus the 2 drawn, where `k` = your hidden count. Return the rest and shuffle.
- **FAQ, one hidden card left:** you still draw 2, keep 1 of the 3 and return 2. Exposed cards are never part of a swap.
- The deck never runs short. It always holds 15 − 2N ≥ 3 cards between turns, and exposed cards stay in front of their owner.
- If a Swap claim is challenged and proved, the Diplomat is shuffled back and replaced **before** the swap draws.

### 3.8 Other edge cases and FAQ defaults
| Case | Default |
|---|---|
| Steal from a player with 0 coins | **Legal** (claim and bluff value). Takes 0. The UI says "takes nothing". |
| Steal from a player with 1 coin | Takes 1 |
| Oust or Ambush someone with 1 hidden card | Legal. They're out. |
| Challenge a claim you know is impossible (all 3 of that courtier accounted for by your hand and exposed cards) | Legal, and you'll win it. The UI doesn't hint at this (house skill). |
| Reaching 10+ mid-turn (e.g. via Steal) | Forced oust only applies at the start of your next turn |
| Talking, deals, showing cards | Table talk is outside the game (voice chat). There is no "show card" action, and coins can't be given. |
| A player is removed (left the room) | §6.5 |

## 4. Host options

There is **no per-game host-options mechanism in the platform today**: no `createState` options and no lobby UI (checked `@parlor/multiplayer` `gameDefinition.ts` / `defineGame.ts`). The engine still takes `CloakOptions` so the defaults can be tested. `createState` passes `DEFAULT_OPTIONS` until lobby options exist (§11).

| Option | Values | Default | Notes |
|---|---|---|---|
| `windowSeconds` | 10 / 15 / 25 / `null` (no limit) | **15** | Applies to challenge and block windows. "No limit" waits for every eligible player, for slow or young tables. |
| `twoPlayerStartCoin` | on / off | **on** | The 2-player first player starts with 1 coin (rulebook) |
| `twoPlayerDraft` | on / off | off | Rulebook alternate 2p setup: the 15 cards form 3 sets of one of each courtier. Each player secretly picks 1 card from their own set (the rest of that set leaves the game), then gets 1 random card from the third set. The third set's remaining 3 cards are the deck. |
| `bluffHints` | on / off | on | Privately marks the actions and blocks you would be bluffing. A learning aid; doesn't change the rules. |
| Future, not v1 | The *Reformation* "Inquisitor" swapped in for the Diplomat; factions for 7–10 players | — | Note only |

## 5. State model

`games/cloak-and-coin/src/types.ts`:

```ts
export type Courtier = 'chancellor' | 'rogue' | 'smuggler' | 'diplomat' | 'bodyguard';
export type CourtAction = 'income' | 'aid' | 'oust' | 'levy' | 'ambush' | 'steal' | 'swap';
export const CLAIM: Partial<Record<CourtAction, Courtier>> =
  { levy: 'chancellor', ambush: 'rogue', steal: 'smuggler', swap: 'diplomat' };
export const BLOCKERS: Partial<Record<CourtAction, Courtier[]>> =
  { aid: ['chancellor'], ambush: ['bodyguard'], steal: ['smuggler', 'diplomat'] };
export const COST: Partial<Record<CourtAction, number>> = { oust: 7, ambush: 3 };
export const TARGETED: CourtAction[] = ['oust', 'ambush', 'steal'];

export type CourtPhase =
  | 'choose-action'     // actor picks an action
  | 'challenge-action'  // timed window: anyone still in, except the actor, may challenge the action claim
  | 'block'             // timed window: eligible blockers may block
  | 'challenge-block'   // timed window: anyone still in, except the blocker, may challenge the block
  | 'answer-challenge'  // the challenged claimant: prove or concede (untimed)
  | 'reveal'            // ~1.8s beat showing the challenge result (definition advances)
  | 'expose'            // a player chooses which card to expose (untimed; auto if only 1 hidden)
  | 'swap'              // actor chooses cards to keep (untimed)
  | 'game-over';

export type CloakActionMsg =
  | { type: 'declare'; action: CourtAction; targetId?: string }
  | { type: 'challenge'; windowId: number }
  | { type: 'pass'; windowId: number }
  | { type: 'block'; windowId: number; courtier: Courtier }
  | { type: 'prove' }                         // answer-challenge only
  | { type: 'expose'; index: number }         // answer-challenge (concede) or expose; index into my hand
  | { type: 'keep'; indices: number[] };      // swap: indices into me.swapOptions

export interface LogEntry { id: number; text: string; kind: 'action' | 'challenge' | 'block' | 'expose' | 'out' | 'turn' }

export interface CloakView {
  phase: CourtPhase;
  turnNumber: number;
  actorId: string | null;              // whose turn it is
  awaitingId: string | null;           // who must act in answer-challenge / expose / swap / choose-action
  players: {
    id: string; name: string; bot: boolean; connected: boolean; seat: number;
    coins: number;
    hiddenCount: number;               // 0..2
    exposed: Courtier[];               // face-up, public
    out: boolean;
  }[];
  deckCount: number;
  pending: null | {                    // the public story of the current turn
    action: CourtAction; targetId: string | null; claim: Courtier | null; paid: number;
    challenge: null | { challengerId: string; claimantId: string; about: 'action' | 'block' };
    block: null | { blockerId: string; courtier: Courtier };
  };
  window: null | {
    id: number;                        // echo in challenge/pass/block, rejects stale taps
    kind: 'challenge-action' | 'block' | 'challenge-block';
    claimantId: string | null;         // whose claim is on the line (null for an Aid block window)
    claim: Courtier | null;
    eligibleIds: string[];
    passedIds: string[];               // public: who has "let it go"
    endsInMs: number | null;           // ms left when this view was built (null = no limit)
  };
  reveal: null | {                     // during 'reveal'
    claimantId: string; claim: Courtier; proved: boolean;
    shown: Courtier | null;            // the proving card (public, then shuffled away), or null if conceded
  };
  log: LogEntry[];                     // last 40, public text only
  winnerId: string | null;
  outOrder: string[];                  // first out first
  me: null | {                         // null for spectators
    hand: { courtier: Courtier; exposed: boolean }[];
    actions: { action: CourtAction; targets: string[]; bluff: boolean; cost: number }[]; // [] unless choose-action and mine
    mustOust: boolean;
    respond: null | { challenge: boolean; blocks: { courtier: Courtier; bluff: boolean }[] }; // when I'm eligible and haven't passed
    canProve: boolean;                 // answer-challenge, I'm the claimant, I hold the claim
    swapOptions: Courtier[] | null;    // my hidden + 2 drawn (order shuffled)
    keepCount: number;
  };
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'cloak-and-coin': CloakView }
  interface GameActionMap { 'cloak-and-coin': CloakActionMsg }
}
```

**Server-only engine state** (`engine.ts`, private fields):

```ts
interface Seat { id; name; bot; connected; coins: number; hand: { courtier: Courtier; exposed: boolean }[]; out: boolean }
interface Turn {
  actorId: string; action: CourtAction; targetId: string | null; paid: number;
  block: { blockerId: string; courtier: Courtier } | null;
  challenge: { challengerId: string; claimantId: string; about: 'action' | 'block' } | null;
  after: 'block-or-resolve' | 'end' | 'resolve';   // continuation once a reveal/expose finishes
}
interface Window { id: number; kind; eligible: Set<string>; passed: Set<string>; deadlineAt: number | null }
// plus: deck: Courtier[]; phase; activeIndex; turn: Turn | null; window: Window | null;
// exposeQueue: { playerId: string; reason: string }[];  swapDraw: Courtier[];
// windowSeq: number; log: LogEntry[]; outOrder: string[]; winnerId; options: CloakOptions;
// randomInt: RandomInt; now: () => number   (injected; tests use a fake clock)
```

**Redaction rules:** never send other players' hidden courtiers, the deck order or contents, `swapDraw` (only to the actor, inside `me.swapOptions`), or which card a claimant drew after proving. Log text must not name hidden cards. "Ana swapped with the deck" has no details, and "Ben proved Chancellor and drew a new card" is fine. The spectator view is `me: null`. A player who is out keeps `me.hand` (all exposed) but gets empty `actions` and `respond`.

**`endsInMs` instead of a timestamp:** this avoids clock skew. The client starts a local countdown from when the frame arrives. The core broadcasts after every pass, so the number keeps getting corrected.

## 6. Actions

### 6.1 Validation (`validateAction`, untrusted input)
| type | exact keys | checks |
|---|---|---|
| `declare` | `type, action` (+`targetId` iff targeted) | `isOneOf(action, ACTIONS)`; `targetId` is a string of 1–64 characters |
| `challenge` / `pass` | `type, windowId` | `isIntInRange(windowId, 0, 1e9)` |
| `block` | `type, windowId, courtier` | as above + `isOneOf(courtier, COURTIERS)` |
| `prove` | `type` | `typeOnly` |
| `expose` | `type, index` | `isIntInRange(index, 0, 1)` |
| `keep` | `type, indices` | array of length 1–2, distinct ints 0–3 |

### 6.2 Engine methods (throw `GameRuleError` before mutating)
| Method | Legal when | Effect |
|---|---|---|
| `declare(id, action, target?)` | phase `choose-action`, `id` = actor; affordable; target other and still in; if coins ≥10 at turn start then only `oust` | pay `COST`; log; open the right window or resolve (§3.5) |
| `challenge(id, windowId)` | window open, `windowId` matches, kind ≠ `block`, `id` eligible and not passed | close window; set `turn.challenge`; phase `answer-challenge`, `awaitingId` = claimant |
| `pass(id, windowId)` | window open and matching, `id` eligible and not passed | add to `passed`. If everyone eligible has passed, close and continue. |
| `block(id, windowId, courtier)` | kind `block`; `id` eligible; `courtier ∈ BLOCKERS[action]` | close; set `turn.block`; open `challenge-block` (eligible: everyone still in except the blocker) |
| `expireWindow(windowId)` | called by the definition's timer; no-op if stale | treat everyone who hasn't passed as passing; continue |
| `prove(id)` | `answer-challenge`, `id` = claimant, holds the claim among hidden cards | phase `reveal` (proved). On `advanceReveal`: put the shown card in the deck, shuffle, draw a replacement for the claimant, queue an expose for the challenger, continue |
| `expose(id, index)` | (`answer-challenge` and `id` = claimant, i.e. conceding) or (`expose` and `id` = head of the queue); `hand[index]` hidden | flip it face up; on concede → phase `reveal` (failed) → ambush refund and fail or resolve; check out/game-over; continue |
| `keep(id, indices)` | `swap`, `id` = actor, `indices.length === keepCount`, distinct, `< swapOptions.length` | new hidden hand = kept; the rest go to the deck; shuffle; END |
| `advanceReveal()` | phase `reveal` | apply the continuation |
| `setConnected(id, c)` | any | record it. If `c` is false and the player is eligible in an open window → see §6.5 |
| `removePlayer(id)` | any | §6.5 |
| `automaticMove()` | — | §9 |
| `view(id?)` | — | §5 |

**Windows that are skipped (no prompt):** a window with no eligible players (e.g. every other player is out) closes at once. A block window opens only if someone is eligible: the target must still be in for Ambush and Steal, and for Aid anyone still in except the actor.

### 6.3 Response windows: who, order, timeouts (the hard part)

| Window | Opens after | Eligible (all must be still in) | Buttons | Closes when |
|---|---|---|---|---|
| `challenge-action` | Levy / Ambush / Steal / Swap declared | everyone except the actor | **Challenge**, Let it go | first `challenge` · all passed · deadline |
| `block` (Aid) | Aid declared | everyone except the actor | **Block as Chancellor**, Let it go | first `block` · all passed · deadline |
| `block` (Ambush/Steal) | `challenge-action` closed with no challenge, or the claim was proved, and the target is still in | **target only** | Block as Bodyguard / Smuggler / Diplomat, Let it go | `block` · pass · deadline |
| `challenge-block` | any block | everyone except the blocker (actor included) | **Challenge**, Let it go | first `challenge` · all passed · deadline |

Timing rules (implementation-critical):
1. **The windows run one after another, never together** (§3.4 ordering). A Steal or Ambush can need up to three windows. Each one closes early as soon as everyone has answered, so in practice the extra windows cost seconds.
2. **Everyone answers at once inside a window.** All eligible players can tap at any time. **The first decisive response the server processes** (`challenge` or `block`) closes the window. Socket.io handles a room's events in order, so "first" is well defined.
3. **`windowId` on every response.** `windowSeq` increments for each new window. A stale id gets `GameRuleError('Too late, that moment has passed.')`. This stops a double-tapped "Challenge" from landing in the next window.
4. **Deadline.** `deadlineAt = now() + windowSeconds*1000 + GRACE_MS (600)`. The client is sent `endsInMs` *without* the grace period, so the bar runs out before the server closes. This absorbs phone latency, and nobody sees "I tapped at 0.3s and it said too late". On timeout, anyone who hasn't answered counts as having passed. With `windowSeconds: null` there's no deadline and the window waits for every eligible human.
5. **Early close** happens only when *every* eligible seat has passed, so the window waits for everyone. There is no minimum open time. When the actor is human, a window of bots only closes after the bots' reaction delay (rule 7), so the actor still sees the window.
6. **Who has passed is public** (`passedIds`; seats show a small "let it go" tick). This copies the table's nods. It also tells the actor who to wait on.
7. **Bots and stand-ins answer once per window**, after `BOT_REACTION_MS` = 900–1600ms (jittered by the injected RNG), all in one scheduled step. They never answer instantly, which would look mechanical and give away a pre-computed choice. If several automated seats want to challenge, the first one clockwise from the claimant takes it. **A disconnected human's stand-in always passes in windows** (§9).
8. **Untimed private choices** (`answer-challenge`, `expose`, `swap`, `choose-action`) have no timer in v1, matching other Parlor games (turn timers are a platform feature, not here yet). A disconnected player's stand-in acts after 400ms. In `answer-challenge` the claimant is **always** offered the same choices (Prove if held, plus expose either hidden card), so nobody can read a bluff from the prompt. Response speed is the only tell, just like at a table.
9. **Reveal beat:** after a challenge is answered, phase `reveal` lasts **1800ms**, showing either "Ben shows a Chancellor" (the card face up, then flipping back into the deck) or "Ben concedes, exposing a Rogue". Exposures outside a challenge don't get a timed phase; the card flip animation and log line cover them.

### 6.4 Definition timing (`drive`)
Like `games/hearts/src/definition.ts`, but with **two scheduler slots**:
- `STEP` (`'cloak-step'`): the reveal (1800ms) or the next automatic move. That's 400ms for a private choice or turn, and `BOT_REACTION_MS` for a window, where one step applies every automated seat's response.
- `WINDOW` (`'cloak-window'`): if `engine.windowDeadline` isn't null, schedule `expireWindow(id)` at `deadline - now()`. Cancel it whenever no window is open, or a different one is.
Recompute both inside every `drive` call and after every action or connection change. As in Hearts, stand-ins pause when no connected human remains (`automaticMove()` returns undefined). **Also don't schedule `WINDOW` while no human is connected**, so the table doesn't run itself.

### 6.5 Disconnects and removal
- **Disconnect (grace period, ~60s):** the seat becomes a stand-in (`setConnected(false)`). If it's eligible in the open window, the stand-in passes on the next bot step. Its turns and private choices use the honest stand-in policy (§9). On reconnect, the player picks up the current view, including `endsInMs`.
- **`onPlayerRemoved` → `removePlayer(id)`:** **Default:** the player is eliminated. All their hidden cards are exposed (public, which keeps card-counting fair), their coins go to the treasury, and they're added to `outOrder`. Then the turn is repaired:
  - They're the **actor**: the turn ends. If a swap was in progress, the 2 drawn cards go back to the deck and it's shuffled.
  - They're **eligible** in a window: they're removed from `eligible`. If everyone left has passed, the window closes.
  - They're the **challenged claimant**: the claim fails (as if conceded), then continue.
  - They're the **challenger** with a pending expose, or in the expose queue: their queue entries are dropped.
  - They're the **target**: the effect fizzles when it resolves.
  - Then run the game-over check. If one player is left, they win.

## 7. Mapping to this codebase

- **Package:** `games/cloak-and-coin` → `@parlor/cloak-and-coin`. Follow `docs/ADDING_GAMES.md` §1 exactly. Copy `tsconfig.json`/`turbo.json` from `games/hearts`. No `@parlor/cards` dependency (these aren't playing cards).
- **Files:**
  - `src/types.ts`: §5.
  - `src/rules.ts`: `CLAIM`, `BLOCKERS`, `COST`, `TARGETED`, `legalActions(seat, others)`, `stealAmount`, `keepCount`. Pure and importable by the client (for the bluff tags and action-card copy).
  - `src/engine.ts`: the `CloakEngine` class. Constructor `(players, randomInt = secureRandomInt, options = DEFAULT_OPTIONS, now = Date.now)`. Model it on `games/hearts/src/engine.ts` (seats, `setConnected`, `automaticMove`, `advanceReveal`, `view`). Shuffle with `fisherYatesShuffle` from `@parlor/multiplayer/random`.
  - `src/bot.ts`: §9 heuristics, written as pure functions of `(engine-internal snapshot, seatId, rng)`.
  - `src/definition.ts`: copy `games/hearts/src/definition.ts`. Use `validateByType`, `hasExactKeys`, `isIntInRange`, `isOneOf` and `typeOnly` from `@parlor/multiplayer`. Use the two-slot `drive` from §6.4. `createState` sets the first player at random (or to the previous winner on restart, if the core exposes it; otherwise random, §11). `onPlayerRemoved` calls `removePlayer`.
  - `src/meta.ts`: `{ id: 'cloak-and-coin', name: 'Cloak & Coin', description: 'Claim any courtier, call out bluffs, and be the last with a secret left.', minPlayers: 2, maxPlayers: 6, estimatedMinutes: '10-15', tags: ['cards', 'bluffing', 'party'], displayModes: ['peer'], supportsBots: true }`.
  - `src/GameView.svelte` and local components: `CourtCard.svelte`, `ActionPicker.svelte`, `ClaimStage.svelte`.
- **App wiring** (ADDING_GAMES §7): `apps/parlor/package.json`; `apps/parlor/src/lib/server/games/index.ts` (`registerGame(cloakAndCoinDefinition)`); `GameRenderer.svelte` branch; **`apps/parlor/src/lib/games/catalog.ts`** (the home shelf and lobby picker now read from here, not from the page files) with `{ ...cloakAndCoinMeta, shelf: 'linen', tagline: 'Claim courtiers and call out bluffs' }`; the id → name map in `routes/game/[roomCode]/+page.svelte`; a `RulesModal.svelte` section; `docs/GAMES.md` row; the shelf list in `design-full.md`.
- **Reuse from `@parlor/ui`:** `TurnBanner` (always first), `SeatChip` (`wide`, `children` for coins and the two card slots, `out`, `targetable` + `onclick` for target picking), `Button` (`shout` for the single primary), `GameOver` (standings), `Felt` (the stage surface), `seatTone`, `Modal` (full log on phone).
- **Board-kit additions (flagged):**
  1. **`CountdownBar`** (new, `@parlor/ui`): a thin outlined bar that drains from `endsInMs`. It turns mustard under 5s, shows a text fallback ("12s"), stays static under reduced motion, and isn't a live region per second. Turn timers and future Jackbox windows will need it too, so it's shared from the start.
  2. **Promote `GameLog`** from `games/booty-dice/src/lib/components/game/GameLog.svelte` into `@parlor/ui`, with a game-provided title. Coup can't be played without a readable history. Booty Dice should switch to the shared one (Collection Rule).
  3. `CourtCard` stays **game-local**. It's a character card, not a `PlayingCard`. It follows the PlayingCard print language: paper stock, ink outline, Nunito title, back in the game colour via `--card-back`.
- **Patterns to copy:** stand-in pausing and `automaticMove` (`games/hearts/src/engine.ts:124`); a reveal phase with `advanceReveal` (`hearts`, `trick-won`); "out" seats (`SeatChip out`, as Booty Dice and Liar's Dice do); seeded tests (`apps/parlor/src/lib/server/hearts.test.ts`, `seededPlaythroughs.test.ts`).

## 8. Board UI

**Shelf colour: `linen`.** All five spine colours are already taken, and linen is the least used (only Kings Corner). It also isn't next to KC on the shelf. Card backs are linen with an espresso crest (`--card-back`). Coins are drawn as mustard discs with an ink outline. The stage sits on `Felt` (green) so the game doesn't read as linen-on-linen. If the human prefers it, `ink` (espresso, night felt) is a fine alternative, but Liar's Dice already uses it for a bluffing game.

Each courtier has its own drawn stroke-SVG emblem and an ink hue on the card band (not seat colours), with the name always printed. Colour is never the only signal.

### Phone (390px)
```
┌ lid: PARLOR · ? · Leave ───────────────┐
│ TurnBanner: "Ana claims Chancellor"     │  (felt + "Your call" when you can respond)
│  "Levy: take 3 coins. Challenge or let  │
│   it go."                               │
├─────────────────────────────────────────┤
│ Felt stage (ClaimStage)                 │
│  [Ana] ──Levy──▶  claims [Chancellor]   │
│  ▓▓▓▓▓▓▓▓▓░░░░ 9s     ✓Ben ✓Cy  …Dee    │  CountdownBar + passed ticks
│  [ CHALLENGE ]        (Let it go)       │  shout = Challenge, outline = Let it go
├─────────────────────────────────────────┤
│ Seats (SeatChip wide, one per row)      │
│  ● Ana   ◉3  [▒][▒]          (acting)   │  ◉ coins; ▒ hidden back; exposed = mini face
│  ● Ben   ◉5  [▒][Rogue]                 │
│  ● Dee   ◉0  [Smug][Dipl]   out         │
├─────────────────────────────────────────┤
│ Your courtiers: [Chancellor][Bodyguard] │  two large CourtCards with the ability printed
├─────────────────────────────────────────┤
│ Log: last 2 lines · "History" opens all │
└─────────────────────────────────────────┘
```
- **Your turn:** the stage area becomes `ActionPicker`, a 2-column grid of action tiles (name, cost, the courtier it claims, a private **"Bluff"** tag if you don't hold it, disabled with the reason if you can't afford it). With 10+ coins, only Oust is enabled and the banner says why.
  - **Untargeted action:** tap a tile to lift it (butter). The shout button becomes "LEVY +3". Tap it to confirm. This follows the second-tap convention: no accidental claims.
  - **Targeted action:** tap the tile, the legal opponents' seats get the mustard ring, tap one, and the shout becomes "STEAL FROM BEN". Tap it to confirm. Tap the tile again to cancel.
- **Block window (you're eligible):** one pill per legal blocking courtier ("Block as Smuggler", with a Bluff tag if needed). "Let it go" is the outline. No shout, because blocking isn't safer than letting it go.
- **Challenged (answer-challenge):** a Modal-less inline panel: "Ben challenges your Chancellor." Buttons: **Show Chancellor** (only if held) and "Expose [card]" on each hidden card (tap the card, then confirm). The same layout appears either way.
- **Expose:** your hidden cards get the mustard ring. Tap one to lift it, then "EXPOSE ROGUE" confirms.
- **Swap:** shows your hidden cards plus 2 drawn cards in a row (3–4 CourtCards, ~84px wide on a phone). Tap to keep exactly `k` of them (butter); "KEEP THESE" confirms.
- **Waiting:** the banner is paper ("Waiting for Ben to answer"). The stage shows the claim and who still has to respond.

### Desktop (≥900px)
Two columns. On the left, the seats arranged as a 2×3 grid around a central felt stage. On the right (320px), your courtiers, the action picker, and the log, which is always open. The same components as on phone.

### Animations (moderate)
CourtCard flip when exposed (rotateY, 300ms). On a proved challenge: the card flips up, holds, then slides into the deck. Coins tick up or down on seats and a coin chip slides from target to actor on Steal. CountdownBar drains linearly. A "Challenge!" stamp pops on the stage. `prefers-reduced-motion` removes all movement and keeps the text and state.

### Accessibility and copy
Announce once (via `TurnBanner` live region) when a window opens that you can respond to ("Ana claims Chancellor. Challenge or let it go, 15 seconds"), and once at 5s left. Use "Tap" or "Click" depending on pointer, like the lobby. No uppercase except the single shout.

## 9. Bot AI

Pure heuristics with an injected RNG, like the existing games, with weights collected in one `BotWeights` object so they can later be tuned with the AI_STRATEGIES GA. A bot uses only public info plus its own hand: exposed cards, coins, and a per-player record of **public claims** (taken from the turn history in the engine) and their outcomes.

| Decision | Rule |
|---|---|
| Turn, ≥10 coins | Oust the **most dangerous** opponent (score = hidden×10 + coins + 3 if they've claimed Rogue) |
| Turn, ≥7 coins | Oust the most dangerous (90%), else continue |
| Holds Rogue, ≥3 coins | Ambush the most dangerous opponent who hasn't recently proved a Bodyguard |
| Holds Chancellor | Levy |
| Holds Smuggler and an opponent has ≥2 coins | Steal from the richest opponent not known to block Steal |
| Holds Diplomat and the hand has a duplicate or a low-value card | Swap |
| Otherwise | Bluff Levy with p=`bluff` (0.3; lower if a Chancellor is already exposed twice), else Aid if no opponent has claimed Chancellor in the last round, else Income |
| Challenge a claim | **Always** if impossible (own hand + exposed already hold all 3). Else challenge if **the claim exposes me and I'm on my last card and I can't block** (p 0.7). Else p = `skeptic` (0.12) + 0.15 if this claimant has already used a *different* courtier's ability (more distinct claims than 2 is suspicious) |
| Block | Always if holding a valid blocker. If ambushed on my last card without a Bodyguard: bluff Bodyguard (p 0.6). Steal of 2 coins: bluff block p 0.2 |
| Challenge a block | Impossible-count rule; otherwise p 0.15 (0.4 if the block saves the target's last card from my Ambush) |
| Answer a challenge | Prove whenever holding the claim (bots never sandbag) |
| Expose / swap keep | Card value: Chancellor 5, Rogue 4, Bodyguard 4, Smuggler 3, Diplomat 2. Duplicates get −2. Expose the lowest value and keep the highest |

**Stand-in for a disconnected human (honest policy):** never bluff, never challenge, block only when holding the blocker, always prove when holding the claim. Turn: Oust if ≥7, else Levy if holding Chancellor, else Income. In windows it always passes (rule 7 of §6.3), so a dropped phone never makes a risky call for its owner.

## 10. Test plan

Engine: `apps/parlor/src/lib/server/cloak-and-coin.test.ts`, with seeded `randomInt`, a fake `now`, and the deck set directly through a test-only `CloakEngine.forTest({ hands, deck, coins, active })`.

**Setup:** 2–6 players are dealt 2 each, with 15 − 2N cards in the deck. Everyone has 2 coins, but at 2 players the first player has 1 (option on). The draft variant deals from the right sets. Fewer than 2 or more than 6 players throws.

**Turn legality:**
- Every action is rejected when it isn't the player's turn or the phase is wrong.
- Oust with 6 coins is rejected. Ambush with 2 is rejected.
- At 10 coins at turn start, only Oust is legal. A player who reaches 10 mid-turn isn't forced that turn.
- Targeting yourself, a player who is out, or an unknown id is rejected.
- **Every rejection leaves the state deep-equal to before** (snapshot the private state).

**Income, Oust, Aid:** Income resolves with no window. Oust pays 7 and the target is prompted to expose, or with one hidden card is auto-exposed and out. An Aid block window lets every other player still in respond. The first block wins, and a second block gets "too late".

**Challenge on the action:**
- Levy proved: the challenger exposes 1, the claimant's Chancellor goes back to the deck and a new card is drawn (deck size unchanged), and the actor gets +3.
- Levy conceded: the claimant exposes and gets no coins.
- Ambush conceded: the 3 coins are refunded.
- Ambush blocked by a Bodyguard and unchallenged: no refund.
- A truthful claimant can concede.

**Block and challenge-block:**
- Steal blocked by a Diplomat, and the actor challenges and loses: the actor exposes and the steal is cancelled.
- A Smuggler block is bluffed and challenged: the steal goes through.
- **Double exposure:** ambush, the target bluffs Bodyguard, gets challenged, concedes, and the ambush resolves. The target ends with 0 hidden cards and is out, and the log has two expose lines.
- The target challenges the Rogue and loses on their last card: the ambush fizzles with no refund.
- The actor challenges a block, loses, and is out: the turn ends.

**Windows:**
- A stale `windowId` is rejected.
- Once everyone has passed, the window closes early.
- `expireWindow` with an old id does nothing. At the deadline, anyone who hasn't answered counts as passing.
- A `null` deadline never expires.
- A window with no eligible players is skipped.
- The block window for Steal accepts only the target.
- Challenge-block eligibility includes the actor and excludes the blocker.
- A player who is out can't respond.

**Swap:**
- With 2 hidden, the player keeps 2 of 4. With 1 hidden, they keep 1 of 3 and return 2.
- A wrong count or duplicate indices are rejected.
- The deck count is unchanged afterwards.
- `swapOptions` appears only in the actor's view.

**Steal amounts:** 0, 1 and 2+ coins.

**Turn order and end:**
- Players who are out are skipped.
- Coins go back to the treasury when a player is out.
- The game is over with exactly one player left. `outOrder` and `winnerId` are right, and the standings are ordered.

**Hidden info:** check the views of the actor, another player, a player who is out, and a spectator.
- No view contains another player's hidden courtiers or the deck.
- The redrawn card after a proof isn't in any other view or in the log.
- A spectator has `me === null`.

**Automation:**
- Bots respond within one step, and a bot never acts while a human-only choice is pending.
- A disconnected human always passes in windows and is never pushed into a bluff.
- Automation pauses when no human is connected, and the window timer isn't scheduled then.
- `removePlayer` covers each role in §6.5: actor mid-swap (the deck is restored), challenged claimant, eligible responder, and target.

**Playthrough:** 200 seeded all-bot games at 2, 4 and 6 players end within a cap on turns, never throw a non-`GameRuleError`, and keep the 15 cards conserved (hands + exposed + deck).

**Socket:** add `cloak-and-coin` to `seededPlaythroughs.test.ts`. Check that each frame carries only that player's `me.hand`, and that a challenge sent with an old `windowId` is acked `ok: false`. Add malformed payloads to `actionBoundary.test.ts`: `keep` with non-int indices, `block` with an unknown courtier, and `declare` steal without `targetId`.

**Playwright smoke** (`apps/parlor/e2e/cloak-and-coin.test.ts`, 390×844):
1. Open "How to play Cloak & Coin" from the shelf and close it.
2. Create a room, vote, add 2 bots, and start.
3. On your turn, tap Income, confirm, and check your coin count is 3.
4. Wait for your next turn. The bots act in a few seconds, and on every bot claim the window shows a CountdownBar and "Let it go". Tap "Let it go".
5. Declare Levy and confirm. Then either your coins go to 6, or the "challenges your Chancellor" panel appears; answer it and check the log shows a result line.

Use `allTextContents()` for optional elements (MEMORY: avoids 30s waits).

## 11. Open questions for the human
1. **Name:** is "Cloak & Coin" and the courtier names (Chancellor, Rogue, Smuggler, Diplomat, Bodyguard; actions Levy, Ambush, Steal, Swap, Oust) OK?
2. **Host options don't exist in the platform yet.** Ship with hard-coded defaults (15s windows) and add lobby options later, or build the per-game options mechanism first? The challenge timer matters most for mixed-age tables.
3. **Simultaneous challenges:** we use first-received wins. Would you rather collect challenges for ~300ms and give it to the first clockwise from the claimant (closer to "table priority", slightly slower)?
4. **A player who leaves mid-game:** we eliminate them and expose their cards. Would you rather keep a stand-in, as Hearts does?
5. **Previous winner starts on Play again:** is there core support for passing the last result into `createState`? If not, it's random every game.
6. **Shelf colour:** linen (recommended) or espresso?

## 12. Sources
- Rules (rulebook transcription): https://rulespal.com/coup/rulebook
- Rules summary incl. 2-player rule and draft setup: https://lehi-innovation.github.io/boardgame-rules/rules/coup/
- Dized ruling, challenges come before counteractions: https://rules.dized.com/game/xzsTtI3VTV-2wvos3otxIg/Ef5QFFYwStWs7O5N9sK0bQ/which-comes-first-challenges-or-counter-actions
- Dized Coup FAQ index: https://rules.dized.com/coup/faq
- RulesPal FAQ (question list: Ambassador with one influence, declining to reveal, steal from 0): https://rulespal.com/coup/faq
- Library-hosted rulebook PDF (IBC, 2015 printing): https://www.buffalolib.org/sites/default/files/gaming-unplugged/inst/Coup%20Instructions.pdf
- Background: https://en.wikipedia.org/wiki/Coup_(card_game); BGA implementation: https://en.boardgamearena.com/gamepanel?game=coupcitystate
- Name check (no conflict found for "Cloak & Coin"): web search, 2026-11-27
