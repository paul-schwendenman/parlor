# Quiet Count (The Mind): implementation brief

> Internal reference name: *The Mind* (Wolfgang Warsch; NSV 2018, Pandasaurus in English). Player-facing name: **Quiet Count**. Package/id: `quiet-count`.

## 1. Overview

A cooperative real-time card game. A deck of 100 cards numbered 1–100; each level, every player gets as many cards as the level number, and the team must lay all of them onto one shared pile in ascending order with no turns and no communication. A misplay costs a shared life; the team clears 8–12 levels (by player count) or runs out of lives. **2–4 players, ~20 min, peer mode** (each phone shows your own hand, the pile and the table). Fits Parlor well: one tap per card, no rules to read, works for mixed-age tables, and a video call is the natural place to "feel the moment". It is the platform's first **real-time** game: no turns, plays can collide, and timing over the network has to be fair (see §6.3).

## 2. Naming & IP

| Item | Decision |
|---|---|
| Name | **Quiet Count** (id `quiet-count`). Alternatives: *Hush*, *Low to High*. Avoid *Wavelength* (CMYK), *Hive Mind* (Calliope), *Telepathy*, *Sync* (Rabble 2023/24) and *In Sync* (too close to *Sync*). |
| Theme | None needed: plain numbers. "Lives" and "throwing stars" become **lives** (heart-free: a drawn candle/flame icon) and **skips** (a drawn feather icon; "use a skip"). Avoid "throwing star"/shuriken art, which is the original's look. |
| Must not use | "The Mind" in any player-facing text, NSV/Pandasaurus logos, the level-card art, rulebook wording, or the rulebook's hidden "secret" note. Internal docs may name the original (docs/LEGAL.md). |

## 3. Rules (verified)

Sources: rulespal.com transcription of the NSV rulebook, the Geeky Hobbies and Gamerules summaries, Wikipedia (see §12). Paraphrased.

### Setup by player count

| Players | Levels | Lives | Skips (stars) |
|---|---|---|---|
| 2 | 1–12 | 2 | 1 |
| 3 | 1–10 | 3 | 1 |
| 4 | 1–8 | 4 | 1 |

Supply caps: **5 lives, 3 skips** (the box holds 5 life cards and 3 star cards; rewards come from what is not in play, so a reward at the cap is lost).

### A level
1. Shuffle all 100 cards. Deal **N cards to each player** for level N. Hands are secret.
2. **Focus**: everyone puts a hand on the table; when all are ready they lift together and play starts.
3. **Play**: no turns. Anyone may at any moment play their **lowest** card face up onto the single pile. Cards must go down in ascending order across the whole team.
4. No talking about cards, no signals, no showing cards.
5. **Stop**: anyone may call stop at any time; everyone refocuses (step 2) and play resumes.
6. **Mistake**: if a card is played while any player still holds a lower card, play halts immediately. The team loses **one life**. Every player discards, face up, all cards they hold lower than the played card. Refocus and continue the **same** level (it is not redealt).
7. **Skip (throwing star)**: any player may propose one (raised hand). If **all** players agree, one skip is spent and every player discards their lowest card face up. Refocus and continue.
8. The level is complete when every hand is empty. Take the level's reward (below), then go to level N+1.

### Rewards (on completing the level)
| Level | 2 | 3 | 5 | 6 | 8 | 9 |
|---|---|---|---|---|---|---|
| Reward | skip | life | skip | life | skip | life |

Capped at 5 lives / 3 skips. A 4-player game's level-8 reward only matters in Blind encore.

### End
- **Win**: complete the last level (12/10/8). Team result, no individual scores.
- **Lose**: lives reach 0 (checked immediately after a mistake's life loss).

### Ambiguities and chosen defaults

| Question | Default | Note |
|---|---|---|
| One life per mistake, or one per player holding a lower card? | **One life per misplayed card**, however many players held lower cards. | Sources say "the team loses a life". Host toggle for the stricter house rule. |
| Mistake discards empty every hand | **Level completes** (reward granted) unless that life loss reached 0. | Life loss is applied first. |
| Skip discards empty every hand | Level completes. | |
| May you play a card other than your lowest? | **No (digital forces your lowest).** | Playing a non-lowest is always a mistake on yourself; we remove the fat-finger. |
| Does a skip proposal pause play? | **Yes.** Play pauses during the vote; any "no" (or 20 s silence) cancels and the team refocuses. | Physical rules don't say; pausing avoids plays during a vote. |
| Do empty-handed players vote on a skip? | **Yes**: skips are a team resource. | Bots/stand-ins vote automatically. |
| Can a skip be proposed during focus? | Yes (it's still "during a level"). | |
| Near-simultaneous plays | See §6.3: valid plays land instantly; a would-be mistake waits a short settle window for the lower card. | Digital-only fairness rule, host-tunable, 0 = strict arrival order. |
| Blind mode mistakes | Counted at level end as **descents** (each card lower than the card under it = 1 life). | Rulebook says "each mistake costs a life" without defining it. |
| 5+ players / solo | Not supported (no official rule). | 1 human + bots is allowed (§9). |

### Official variant: Blind (rulebook's only variant)
After winning, the team may start again at level 1 keeping its lives and skips. Cards are played **face down**; at the end of each level the pile is flipped and checked; each mistake costs a life. Goal: as many levels as possible. Everything else unchanged.

## 4. Host options

Platform note: **the core has no per-game host settings yet** (no settings in `@parlor/game-types` lobby events or `RoomManager`). Ship v1 with the defaults below as engine constructor options; the toggles need a shared lobby-settings addition (flagged in §7/§11).

| Option | Values | Default |
|---|---|---|
| Settle window (near-simultaneous plays) | 0 / 150 / 300 ms | **150 ms** |
| Mistake penalty | 1 life per misplay / 1 per player holding a lower card | 1 per misplay |
| Length | Standard (12/10/8) / Short (half, rounded up) | Standard |
| Blind encore after a win | off / on | off |
| Shared pulse (a slow ambient beat everyone sees) | off / on | off (it turns intuition into counting) |

## 5. State model

### Server (engine-private)
```ts
// types.ts
export type QuietPhase =
  | 'focus'          // hands down: waiting for every present seat to be ready
  | 'breath'         // everyone ready: 1200 ms synchronized "lift" before plays are accepted
  | 'playing'
  | 'skip-vote'      // play paused, collecting votes
  | 'mistake'        // reveal ~3000 ms
  | 'skip-reveal'    // reveal ~2500 ms
  | 'level-complete' // reveal ~3500 ms (reward shown)
  | 'blind-check'    // blind mode: pile flipped, descents counted, reveal ~4000 ms
  | 'game-over';

export type Reward = 'life' | 'skip';

export interface QuietSettings {
  settleMs: number;                 // 0 | 150 | 300
  lifePerHolder: boolean;
  short: boolean;
  blindEncore: boolean;
  pulse: boolean;
}

// engine.ts
interface Seat {
  id: string; name: string; bot: boolean;
  connected: boolean;
  standIn: boolean;                 // removed human, now driven by bot logic
  hand: number[];                   // ascending; excludes in-flight cards
  ready: boolean;
  vote: boolean | null;
}

interface PendingPlay { playerId: string; card: number; at: number } // at = engine clock on arrival

interface EngineState {
  seats: Seat[];
  settings: QuietSettings;
  phase: QuietPhase;
  phaseEndsAt: number | null;       // for timed phases
  level: number; totalLevels: number;
  blind: boolean;                   // current pass is the blind encore
  lives: number; skips: number;
  pile: number[];                   // committed, in order (face down if blind)
  pending: PendingPlay[];           // in the settle window, hidden from others
  stopQueued: { kind: 'stop' | 'skip'; by: string } | null; // applied once pending resolves
  clockStartedAt: number;           // last commit or resume; bots time from here
  skipVote: { proposerId: string; endsAt: number } | null;
  lastEvent: QuietEvent | null;
  outcome: 'won' | 'lost' | null;
  levelsCleared: number;            // incl. blind levels
}
```
Engine constructor: `(players, settings, randomInt = secureRandomInt, now = () => performance.now())`. **The injected clock is the whole real-time story**: the engine never sets timers; it reads `now()` and exposes `nextDeadline(): number | null` + `tick()` (§7).

### Public events (shown to everyone, face-up by the rules)
```ts
export type QuietEvent =
  | { kind: 'mistake'; playerId: string; card: number; livesLost: number;
      discarded: { playerId: string; cards: number[] }[] }
  | { kind: 'skip'; discarded: { playerId: string; card: number | null }[] }
  | { kind: 'skip-declined'; byId: string | null }        // null = timed out
  | { kind: 'stop'; byId: string }
  | { kind: 'level-complete'; level: number; reward: Reward | null; wasted: boolean }
  | { kind: 'blind-check'; pile: number[]; descents: number; livesLost: number }
  | { kind: 'paused'; waitingForId: string };              // a human dropped
```

### Per-player view
```ts
export interface QuietView {
  phase: QuietPhase;
  phaseEndsInMs: number | null;     // relative; client counts down from receipt
  level: number; totalLevels: number; blind: boolean;
  cardsPerPlayer: number;           // = level
  lives: number; skips: number; maxLives: 5; maxSkips: 3;
  nextReward: { level: number; reward: Reward } | null;
  pile: { top: number | null; count: number; recent: number[] }; // top/recent null/[] while blind
  players: {
    id: string; name: string; bot: boolean; connected: boolean; standIn: boolean;
    cardCount: number;              // hand + in-flight (never reveals an in-flight play)
    ready: boolean;
    vote: 'yes' | 'no' | null;      // only during skip-vote
  }[];
  skipVote: { proposerId: string; endsInMs: number } | null;
  lastEvent: QuietEvent | null;
  outcome: 'won' | 'lost' | null; levelsCleared: number;
  settings: QuietSettings;
  // private (empty for spectators)
  myHand: number[];
  myInFlight: number[];             // my cards waiting in the settle window
  myReturned: number[];             // in-flight cards handed back by a stop (§6.3)
  nextCard: number | null;          // the card PLAY will send
  canPlay: boolean;                 // phase === 'playing' && !stopQueued && nextCard !== null
  canReady: boolean; canStop: boolean; canProposeSkip: boolean; canVote: boolean;
}
```
Spectator view (`view()`): no hands, no in-flight, `nextCard: null`, all `can*` false. Spectators **do not** see hands (they are likely on the same video call).

### State machine
```
deal(level) ──> focus ──(all present seats ready)──> breath ──1200ms──> playing
playing ──stop──> focus
playing ──propose-skip──> skip-vote ──all yes──> skip-reveal ──> (hands empty ? level-complete : focus)
                                   └─any no / 20s──> focus
playing ──commit, lower card held, window expired──> mistake ──> lives 0 ? game-over(lost)
                                                             : hands empty ? level-complete : focus
playing ──commit, hands empty──> (blind ? blind-check : level-complete)
blind-check ──> lives 0 ? game-over(lost) : level-complete
level-complete ──> last level ? (blindEncore && !blind ? deal(1, blind) : game-over(won)) : deal(level+1)
any phase except reveals/game-over ──present human disconnects──> focus (paused, their ready=false)
```

## 6. Actions

```ts
export type QuietAction =
  | { type: 'play'; card: number }        // must equal my lowest not-in-flight card
  | { type: 'ready'; ready: boolean }
  | { type: 'stop' }
  | { type: 'propose-skip' }
  | { type: 'vote-skip'; agree: boolean };
```

### 6.1 Validation (`validateAction`, untrusted)
`hasExactKeys` per type; `card` an integer 1–100; `ready`/`agree` booleans. Anything else `invalid(...)`.

### 6.2 Engine rules
| Action | Allowed when | Effect | Rejection (GameRuleError, nothing changes) |
|---|---|---|---|
| `play` | phase `playing`, no `stopQueued`, `card === hand[0]` | move card to `pending` at `now()`; `resolve()` | "Play has stopped." / "That card isn't your lowest any more." (stale tap after a discard) |
| `ready` | phase `focus` | set flag; if every present seat ready → `breath` (`phaseEndsAt = now+1200`) | wrong phase |
| `stop` | phase `playing` or `breath` | if `pending` non-empty: `stopQueued = {stop}` (applied when the window resolves); else → `focus`, all `ready=false`, `lastEvent=stop` | wrong phase / already queued |
| `propose-skip` | phase `focus`/`playing`/`breath`, `skips > 0` | (queued like stop if pending) → `skip-vote`, proposer votes yes, others `null`, `endsAt = now+20000` | no skips / wrong phase |
| `vote-skip` | phase `skip-vote`, my vote null | record; any `false` → `focus` + `skip-declined`; all `true` → spend skip, each non-empty hand discards `hand[0]`, → `skip-reveal` | wrong phase / already voted |

Bots, stand-ins: auto-ready immediately; vote per §9. A disconnected (in-grace) human blocks `focus` and skip votes, which is the point: the team waits for them.

### 6.3 Timing and latency fairness

**Why it matters.** The server is single-threaded and handles each `game:action` in arrival order, so "who played first" is "whose packet arrived first". Two players who tap 30 and 31 within ~100 ms can arrive in either order depending on Wi-Fi jitter; a strict reading turns network noise into lost lives.

**Options considered.**
| Approach | Verdict |
|---|---|
| Strict arrival order | Simple and faithful, but punishes the player with the worse connection. Kept as `settleMs = 0`. |
| Client timestamps + clock sync | Needs NTP-style offset estimation per socket, still jittery on phones, and lets a client rewrite history. Rejected. |
| Batch every play in a fixed window | Delays every correct play by the window and makes the pile feel laggy. Rejected. |
| **Settle only would-be mistakes (chosen)** | A play that is valid lands instantly. A play that *would* be a mistake is held `settleMs` (default 150 ms) to give the lower card a chance to arrive; whatever arrives in that window is applied lowest-first. Co-op, so there is no adversary to exploit the generosity. |

**`resolve(now)` algorithm** (run after every play and from `tick()`):
```
loop:
  p = lowest card in pending
  if none: break
  if no hand holds a card < p.card:
      commit p to pile; clockStartedAt = now; continue
  if now - p.at >= settleMs:
      MISTAKE: commit p; every hand discards cards < p.card; lives -= (lifePerHolder ? holders : 1)
      return all other pending cards to their owners' hands (play stopped before they landed; owner sees myReturned)
      stopQueued = null; phase = mistake; break
  else: break   // wait; nextDeadline() = p.at + settleMs
after loop: if pending empty and stopQueued: apply the queued stop/skip
            if pending empty and all hands empty: level end
```
Invariants (test these): every card in every hand is > pile top (non-blind); a committed card is never above a card still held unless it was the mistake card; pending cards are invisible to other seats (counted in `cardCount` only).

Other timing rules:
- **Breath**: plays are rejected during the 1200 ms after the last ready, so the "lift" is synchronized and nobody's slow ready-tap hands someone else a head start.
- **Stop during a window** waits for the window (≤300 ms) so a lower card still arriving can rescue the play; a stop never retroactively un-plays a card that has already committed.
- **Reveal phases** (`mistake`, `skip-reveal`, `level-complete`, `blind-check`) are timed by the definition, like Hearts' `trick-won`.
- The view sends durations (`phaseEndsInMs`), never server clock values, so client clock skew doesn't matter.
- **Blind**: `play` commits immediately face down, no mistake checks and no settle window; at level end, `blind-check` counts descents.

## 7. Mapping to this codebase

**Package** `games/quiet-count` (`@parlor/quiet-count`), layout per `docs/ADDING_GAMES.md` §1; no `@parlor/cards` dependency (numbers, not suits).

| File | Contents / copy from |
|---|---|
| `src/types.ts` | §5/§6 types + `declare module '@parlor/game-types'` (`'quiet-count': QuietView / QuietAction`). Pattern: `games/hearts/src/types.ts`. |
| `src/meta.ts` | `{ id: 'quiet-count', name: 'Quiet Count', description: 'Play your numbers low to high together, without a word.', minPlayers: 2, maxPlayers: 4, estimatedMinutes: '15-25', tags: ['cards', 'cooperative', 'party'], displayModes: ['peer'], supportsBots: true }` |
| `src/rules.ts` | `LEVELS_BY_PLAYERS`, `START_LIVES`, `REWARDS`, `MAX_LIVES=5`, `MAX_SKIPS=3`, `countDescents(pile)`, `rewardFor(level)` (client-safe). |
| `src/engine.ts` | `QuietCountEngine`: constructor `(players, settings, randomInt, now)`; methods `play/ready/stop/proposeSkip/voteSkip`, `setConnected(id, c)`, `remove(id)` (→ `standIn = true`), `nextDeadline()`, `tick()`, `view(id?)`, `currentPhase`. Deal with `fisherYatesShuffle` from `@parlor/multiplayer/random`. Shape: `games/hearts/src/engine.ts`. |
| `src/definition.ts` | Copy `games/hearts/src/definition.ts`; replace its `drive` with the deadline loop below. |
| `src/GameView.svelte` | §8. |

**The real-time `drive`** (the one structural difference from turn-based games). Bots, settle windows, the breath, reveals and the skip-vote timeout are all "something is due at time T", so the engine reports the earliest deadline and the definition schedules a single slot:
```ts
const TICK = 'quiet-count-tick';
function drive(game: GameContext<QuietCountEngine>): void {
  const { state, instance } = game;
  instance.cancel(TICK);
  const at = state.nextDeadline();          // min(pending settle, phaseEndsAt, skipVote.endsAt, next bot play)
  if (at === null) return;
  instance.schedule(() => {
    state.tick();                            // applies everything due at now(); idempotent
    game.broadcast();
    drive(game);
  }, Math.max(0, at - performance.now()), TICK);
}
```
Every action handler and every hook calls `drive(game)` after mutating (a play changes the bots' timing, so the bot deadline is recomputed). Hooks: `onPlayerDisconnect` → `setConnected(false)` (pauses to `focus` if mid-level); `onPlayerReconnect` → `setConnected(true)`; `onPlayerRemoved` → `remove(id)` (seat becomes a bot-driven stand-in so the team can finish); `onRoomDestroyed: () => undefined`. `nextDeadline()` returns no bot deadline when no connected human remains (stand-ins pause, as `scheduleAbsentTurn`'s `anyonePresent` does).

**Does `@parlor/multiplayer` have what real-time play needs?** Checked `packages/multiplayer/src/{defineGame,gameInstance,actionBoundary,rateLimit,server,clientRuntime}.ts`:

| Need | Status |
|---|---|
| Arrival ordering | OK. `dispatchGameAction` runs the handler synchronously on arrival; the engine's `now()` read inside the handler *is* the server timestamp. No core change. |
| Cancellable timers | OK. `instance.schedule(fn, ms, slot)` with slot replacement is exactly the single-deadline pattern. |
| Rate limit | OK. 80 burst / 20 per s per socket (`rateLimit.ts`) is far above a human's play rate. |
| Broadcast cost | OK. Full view per seat per event; ≤4 seats and a few events per second. |
| Per-game host options | **Missing.** No lobby settings channel. Needed for §4 toggles (shared need; v1 ships defaults). |
| Dead-connection detection | **Weak for real time.** `server.ts` heartbeat is 25 s interval + 20 s timeout, so a phone that loses Wi-Fi can look connected for ~45 s and block `focus`. Mitigation in-game: Stop/focus already makes the table wait visibly. Suggested core change: let a game request a tighter heartbeat, or drop the app default to ~10 s/10 s. |
| Latency measurement | **Missing, optional.** No RTT per socket. Only needed for an adaptive settle window (`settleMs = clamp(p95 one-way of the slower seat, 100, 300)`) or for showing a "slow connection" mark on a seat. Not needed for v1. |
| Quiet race rejections | OK with care. A `GameRuleError` also emits `error`, which `clientRuntime` only logs. The GameView should show "Play has stopped" races softly (not as a red error). |

**Shared UI to reuse** (`packages/ui/src/lib`): `TurnBanner`, `SeatChip` (stat: "3 cards"; `ready` shown via stat "Ready"/"Focusing"), `Felt tone="night"`, `Button` (`shout` for PLAY), `GameOver`, `Modal`, `seatTone`. Not used: `CardHand` (suit cards), `TrickTable`, `PipDie`.

**Board-kit additions (flag):**
1. **`PlayingCard` number face**: a `value?: number` prop on `PlayingCard` (or a sibling `NumberCard` in `cards/`) printing a big centred Nunito 900 numeral with the small top-left index, same stock/outline/back as suit cards. Shared so later number-card games (e.g. a 6 nimmt!-style game) reuse it.
2. **`ReadyCheck`** (optional, could stay local): "hands on the table" row of seats with a drawn palm per seat that fills when ready. Local first; promote if a second game needs synchronized starts.

**App wiring**: the six places in `docs/ADDING_GAMES.md` §7, plus `apps/parlor/src/lib/games/catalog.ts` (`shelf: 'linen'`, tagline "Play low to high, without a word").

## 8. Board UI

**Shelf colour: Linen** (only Kings Corner uses it today; every other shelf colour already appears twice). Pieces: number cards on paper with a **linen card back** (`--card-back`). Surface: `Felt tone="night"` (espresso): calm and low-stimulus for concentration; distinct from Kings Corner's felt table.

Phone (390 px):
```
[lid: PARLOR            ? Leave]
┌ TurnBanner ───────────────────┐
│ Play when it feels right       │   (felt when you hold cards & playing)
│ Level 5 · 5 cards each         │
└────────────────────────────────┘
 ♡♡♡○○  lives     ⟋⟋○  skips        (drawn icons, filled = held)
┌ Felt night ───────────────────┐
│        ┌────┐                  │
│        │ 47 │  12 played       │   pile top, big; last 3 fanned behind
│        └────┘                  │
│ (A) Ann 3 · (B) Bot 4 · (C) Cy 2│  SeatChips, wrap
└────────────────────────────────┘
 Your cards  [52] 61 77 90         (lowest lifted on butter = next play)
 [        PLAY 52        ]         shout, full width, thumb zone
 [ Stop ]          [ Use a skip ]  outline pills
```
Desktop: same column capped at 480 px (lobby/game chrome rule); the pile card grows to ~140 px.

Phase screens (same layout, banner + felt content change):
- **focus**: banner "Hands on the table" / "Tap Ready when you're focused"; felt shows each seat's palm (empty/filled). Main button becomes READY (toggle, `aria-pressed`). Paused for a dropped player: "Waiting for Cy to come back" (dashed SeatChip).
- **breath**: a single 1.2 s ring that fills then releases; PLAY appears enabled at the end.
- **skip-vote**: banner "Ann wants to use a skip"; buttons "Use it" (shout) / "Not now"; seat chips show yes/pending; 20 s ring.
- **mistake**: felt shows the played card with a Spilled Wine outline and, per seat, the discarded lower cards face up; "One life lost". Your discarded cards fade out of your hand.
- **level-complete**: "Level 5 cleared", reward icon pops in (or "Already at 5 lives").
- **game-over**: `GameOver` with headline "You cleared all 8 levels!" / "Out of lives on level 6", detail with levels cleared and lives left; standings list the team (everyone `winner` on a win), detail "cards played".

Interactions and decisions:
- **One tap plays** (deviation from the Collection Rule's second-tap play): there is only ever one legal card and timing *is* the move, so a lift step adds latency for no choice. Guard against accidents instead: PLAY is a single large shout button (not the hand), disabled during `breath`, and ignores taps within 400 ms of `nextCard` changing. The payload carries `card`, so a stale tap after a discard is rejected rather than playing the next card. (Open question §11.)
- Optimistic: after tapping, show the card "in flight" (lifted, 60% opacity) until the broadcast lands; if `myReturned` is non-empty, it slides back with "Play stopped before your 47 landed."
- Stop is always reachable but not a shout; Stop and skip are disabled while one is queued.
- Animations: card flies from hand to pile (150 ms, `transform` only); mistake shake (reduced-motion: none); reward icon pop; breath ring. Optional pulse: a slow 0.5 Hz glow on the felt, shared start time = `breath` end.
- Seat colours via `seatTone(index)`. No chat during a level (rules forbid talk; Parlor has none on boards anyway).

## 9. Bot AI

Do bots make sense? **Yes, with limits.** A Quiet Count bot is just a clock: it knows only its own hand, the pile, card counts and elapsed time, which is exactly what a human knows, so it never cheats. A steady bot is easy to "sync" with, which makes 1 human + 1–3 bots a good way to learn the game, and lets a 3-person group play the 4-player level set. It cannot read a video call, so a mostly-bot table feels mechanical; meta stays `supportsBots: true` with no extra claims.

Heuristic (`bot.ts`, pure, unit-tested):
```
gap      = lowest - (pileTop ?? 0)
remaining= total cards in all hands
spacing  = (100 - (pileTop ?? 0)) / (remaining + 1)        // expected gap between cards
msPerPt  = clamp(4000 / spacing, 250, 700)                 // denser deck → slower count per point
delay    = clamp(gap * msPerPt, 300, 30000) * jitter(0.9–1.1, seeded randomInt)
playAt   = clockStartedAt + delay                          // clock restarts on every commit/resume
```
- Ready: immediately in `focus`. Never calls stop. Never proposes a skip.
- Skip vote: agree iff `lives <= 1` or `level >= ceil(totalLevels / 2)`; otherwise "Not now". (Doesn't look at its own cards, so a bot's vote leaks nothing.)
- Stand-ins (removed humans) use the same logic; disconnected-in-grace humans are **not** stood in: the table pauses.
- Tunable via the genetic-algorithm approach in `docs/AI_STRATEGIES.md` (`msPerPt` bounds, jitter) using bot-only simulated levels with a fake clock.

## 10. Test plan

Engine (`apps/parlor/src/lib/server/quiet-count.test.ts`; engine built with a seeded `randomInt` and a fake `now`):
- Setup: 2/3/4 players → levels 12/10/8, lives 2/3/4, skips 1; level N deals N each, 100-card uniqueness; redeal per level.
- Rewards: skip on 2/5/8, life on 3/6/9; caps at 5/3 with `wasted: true`; level-8 reward with 4p only when blind encore.
- Play: valid play commits instantly (no pending left) even with `settleMs = 150`.
- Settle window: A plays 31 while B holds 30 → pending; B plays 30 at +100 ms → both commit 30,31, no life lost. Same with B at +200 ms → mistake on 31, B's 30 discarded, one life lost.
- `settleMs = 0` → immediate mistake.
- Mistake: discards all held cards < played card across seats (incl. the player's own? impossible by forced-lowest; assert); `lifePerHolder` true loses one per holder; other pending cards returned to owners (`myReturned`).
- Mistake reaching 0 lives → `game-over/lost` even if hands are empty; mistake emptying all hands with lives left → `level-complete` with reward.
- Stale play: `card !== hand[0]` → GameRuleError, state unchanged.
- Play in `focus`/`breath`/`skip-vote`/reveals → rejected, unchanged.
- Stop with pending: queued; lower card arriving in window rescues; then `focus`, everyone unready.
- Ready: all present ready → `breath` → `playing` after 1200 ms via `tick()`; bots auto-ready; disconnected human blocks.
- Skip: proposer auto-yes; all yes → spend, each non-empty hand discards lowest (public in event), empty hands discard null; one no → `focus`, skip unchanged; 20 s timeout → declined; propose with 0 skips → rejected; skip discards emptying hands → level complete.
- Disconnect mid-`playing` → `focus` paused; reconnect → can ready; removal → `standIn`, auto-ready, level finishes.
- Bots: `nextDeadline()` equals computed `playAt`; a human commit reschedules it; no bot deadlines when no human connected.
- Blind encore: after the final level, restart at 1 with lives/skips kept; plays commit face down, view hides top/recent; `countDescents([3,9,5,12,7])===2`; lives lost at `blind-check`.
- Views: player sees own hand + own in-flight only; others' `cardCount` includes in-flight; spectator view has empty hand, all `can*` false; mistake/skip events reveal discards to all.
- Win at final level → `outcome: 'won'`, `isGameOver` true.

Socket: add to `seededPlaythroughs.test.ts` with `vi.useFakeTimers` (pattern in `lifecycleRaces.test.ts`), 2 humans + 1 bot, playing every `nextCard` in ascending order across seats, asserting each socket only ever receives its own `myHand`. Add `play` with non-integer / 0 / 101 / extra keys to `actionBoundary.test.ts`.

Playwright (`apps/parlor/e2e/quiet-count.test.ts`, 390 px): open rules → create room → vote Quiet Count → add a bot → start → tap READY → wait for PLAY to enable → tap PLAY → assert the pile shows your card (or a mistake panel) and level 1 completes into level 2 focus.

## 11. Open questions for the human

1. Name: **Quiet Count** OK? (alternatives *Hush*, *Low to High*).
2. One-tap PLAY (proposed) vs the platform's tap-twice convention?
3. Settle window default 150 ms: generous enough, or 300 ms? Show it in the rules sheet as "near-ties go to the lower card"?
4. Tighten the app-wide Socket.io heartbeat (25 s/20 s) for real-time games, and add the shared per-game host-settings channel the §4 toggles need?
5. Should a skip vote ever be decidable without a dropped player (currently it waits for them, like `focus`)?

## 12. Sources

- Rulebook transcription (NSV *The Mind*): https://rulespal.com/the-mind/rulebook
- Rulebook PDFs: https://world-of-board-games.com.sg/docs/The-Mind.pdf · https://www.buffalolib.org/sites/default/files/gaming-unplugged/inst/The%20Mind%20Instructions.pdf
- Reward schedule summary: https://tabletoptemple.com/how-to-play-the-mind-card-game/
- Rules summaries: https://www.geekyhobbies.com/the-mind-2018-card-game-rules-and-instructions-for-how-to-play/ · https://gamerules.com/rules/the-mind/ · https://en.wikipedia.org/wiki/The_Mind_(card_game)
- *The Mind Extreme* rules (two piles, blind from level 3; not used here): https://cdn.shopify.com/s/files/1/0009/5698/9500/files/the-mind-extreme-nsv-english-rules.pdf
- BoardGameGeek entry (forums/FAQ): https://boardgamegeek.com/boardgame/244992/the-mind
- Name checks: Sync (Rabble) https://www.boardgameoracle.com/boardgame/price/yZtnLnX9vf/sync · Sync or Swim (Bézier) https://www.boardgameoracle.com/boardgame/price/XsVfZKWSkC/sync-or-swim
