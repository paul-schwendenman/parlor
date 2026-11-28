# Farkle: implementation brief

Parlor ships the standard scoring table below in peer mode for 2–6 players, with bot seats and stand-ins. The board confirms the kept dice before the player banks or rolls again. The host options and shared dice animation described below are future work.

---

## 1. Overview

Farkle is a folk push-your-luck game for six ordinary dice. On your turn you keep rolling. After each roll you set aside at least one scoring die and choose whether to roll the rest or bank the points from this turn. A roll that scores nothing is a **farkle**: it loses everything from the turn. Hot dice (scoring all six) lets you pick up all six and keep going. The first player to reach 10,000 triggers a final round. The game takes **2–6 players** (the folk game has no upper limit, but 6 matches the lobby's largest table) and about **15–30 minutes** to 10,000 with 3–4 players. **Display mode: peer** (Jackbox later: all information is public, so a shared screen works with no redaction).

Why it fits Parlor: everyone already half-knows it, it has a single decision you can teach in a minute ("roll again or bank?"), it plays well across ages, and every player can enjoy watching the other turns. It's the push-your-luck slot on the dice shelf, next to Quixx (roll-and-write), Booty Dice (combat) and Liar's Dice (bluffing).

## 2. Naming & IP

| | |
|---|---|
| Proposed name | **Farkle** (id `farkle`, the id the draft package already uses) |
| Fallback name | **Ten Thousand** (the folk name *Dix Mille*), if the human wants no risk at all (see §11) |
| Theme | None needed. Plain dice on a felt table. |

Why "Farkle" is acceptable:
- Farkle is a folk game with centuries of history and many names: Farkle, Ten Thousand, Dix Mille, Greed, Zilch, Zonk. The rules are not protectable (docs/LEGAL.md).
- The plain word mark FARKLE (Reg. 1561159) shows as **cancelled**. Patch Products' 2007 box says only that its tagline "The Classic Dice-Rolling, Risk-Taking Game" is its trademark. BGA, cardgames.io and many apps all use the name "Farkle".
- Live or recent marks are all composites: THE ORIGINAL POCKET FARKEL…, FARKEL and FARKEL PARTY (Legendary Games), FARKLE BLITZ / FLIP / NANO, FREAKY FARKLE, TWISTED FARKEL, SPICY! FARKEL.

Must not use: any of the composite marks above, the Patch tagline, the "Farkel" spelling, box art or logos, or rulebook text. Write the rules in our own words. The Pocket Farkel scoring system is described as proprietary to Legendary Games. Don't copy its special-combo table; nothing in this brief comes from it.

## 3. Rules (verified)

### Components and setup
- 6 standard d6. Every player's score starts at 0.
- Choose the first player at random (the box rolls one die each; same effect). Play goes clockwise in seat order.

### Turn
1. **Roll** all 6 dice (the player taps ROLL; the server rolls).
2. If no die or combination in this roll scores, that's a **farkle**. The turn's points are lost and the turn ends.
3. Otherwise the player **must set aside at least one scoring die/combination** from this roll. Every die they set aside must belong to a scoring combination. They may leave scoring dice behind (for example, keep one 1 and re-roll a 5).
4. Then they choose:
   - **Roll** the remaining dice. If all 6 have been set aside (**hot dice**), they pick up all six and roll them, keeping their turn points. This can happen any number of times.
   - **Bank**: the turn's points go onto their score, which is safe from then on. The turn ends.
5. **Combinations count only within one roll.** A 5 kept from roll 1 and two 5s from roll 2 are 50 + 100, not three 5s. (This is the most common misplay. The box rules call it out explicitly.)

### Scoring table (default = "Parlor standard")

| Combination (all in one roll) | Points | Notes / host option |
|---|---|---|
| Single 1 | 100 | |
| Single 5 | 50 | |
| Three 1s | **1,000** | option: 300 (Patch box rule) |
| Three 2s / 3s / 4s / 5s / 6s | 200 / 300 / 400 / 500 / 600 | face × 100 |
| Four of a kind | 1,000 | option: doubling / adding (see §4) |
| Five of a kind | 2,000 | |
| Six of a kind | 3,000 | |
| Straight 1-2-3-4-5-6 | 1,500 | option: 1,000 / 2,500 |
| Three pairs (three different faces) | 1,500 | option: 1,000 / 750 / off |
| Four of a kind + a pair | 1,500 | option: off |
| Two triplets (two different faces) | 2,500 | option: off |
| Six dice that score nothing | (off) | option: 500 (common in apps) |

This is the Patch Products box table (2007), except that three 1s score 1,000 instead of 300 (see the FAQ). The six-dice combinations need all six dice of a single roll, so they only appear on a 6-die roll.

**Scoring a selection:** the points for a set of kept dice are the **best complete partition** of those dice into combinations. Every die must be used, and if several partitions work the player gets the highest. Examples (fixed multiples):
- 1-1-1-1: four of a kind (1,000) or three 1s + a 1 (1,100), so **1,100**.
- 5-5-5-5: 1,000 vs 550, so **1,000**.
- 1-1-1-5-5-5: two triplets (2,500) vs 1,000 + 500, so **2,500**.
- 2-2-3-3-1-5: not a combination, so the 2s and 3s cannot be kept. Only the 1 and 5 can be kept (150).
- 1-1-5-5-6-6: three pairs **1,500** (with three pairs off: only 1-1-5-5 can be kept, 300).

### Opening threshold
- Default **500**: a player who has never banked can't bank a turn worth less than 500. Below that they must keep rolling (and risk a farkle). Once they have banked, any amount is allowed.
- Ambiguity: some sites phrase it as "every turn must reach 500". Default ruling: **first bank only**, as on the Patch box. A "per-turn minimum" variant is not offered (see §11).
- A player who isn't on the board loses nothing when they farkle except the turn's points.

### Farkle odds (for the rules sheet and the bot)
For a roll of n dice under the default table, the chance of a farkle is: 6 dice ≈ 2.3%, 5: 7.7%, 4: 15.7%, 3: 27.8%, 2: 44.4%, 1: 66.7%. The 6-die figure depends on which six-dice combinations are on.

### Game end
- When a player **banks** and their score reaches the target (default 10,000), the **final round** starts. Each other seat still in the game gets **exactly one more turn**, in seat order. The triggering player does not play again.
- During the final round nothing re-triggers it. A player who passes the leader just sets the score everyone else has to beat.
- After the last of those turns: the **highest score wins**. **Ties share the win** (`winnerIds` has several entries, as in Hearts). There's no tie-break turn.
- Misplay to prevent: the trigger player thinks the game ends at once. The banner says "Final round: everyone else gets one more turn to beat 10,250."

### FAQ rulings / chosen defaults

| Question | Ruling |
|---|---|
| Can I keep dice from an earlier roll to complete a set? | No. Each roll is scored on its own. |
| Must I keep all scoring dice? | No. At least one scoring die; the rest are optional. |
| Can I keep a non-scoring die? | No. The whole selection must partition into combinations. |
| Can I bank straight after hot dice? | Yes (default). Host option `hotDice: 'must-roll'` forces at least one more roll. |
| Three 1s: 1,000 or 300? | 1,000 by default (BGA, cardgames.io, Wikipedia's standard table and common play). 300 is the Patch box's value and a host option. |
| Four 1s with fixed values | Best partition, so 1,100 (see above). |
| Can six of a kind count as three pairs or two triplets? | No. Three pairs needs three different faces (or 4+2 when that option is on), and two triplets needs two different faces. Six of a kind scores as six of a kind. |
| Opening threshold: once, or every turn? | Once (first bank). |
| Farkle while not on the board | Only the turn's points are lost. |
| Three-farkle penalty | Off by default. When it's on, a player whose third turn in a row ends in a farkle loses 500 (or 1,000). Their counter then resets, and any bank also resets it. The score **cannot go below 0**. |
| Do I need to bank to win, or does passing 10,000 mid-turn win? | You have to bank. The final round starts only when the bank is made. |
| Final round: does the opening threshold still apply? | Yes. Nothing changes except that it's the last turn. |
| A player leaves mid-game | Their seat leaves the turn order. Their score stays visible but struck through, and they can't win (see §6). |

### Variants deliberately not offered (v1)
Piggybacking (rolling on from the previous player's leftover dice), stealing a farkled total, the "welfare" exact-10,000 ending, the 2s "disaster" roll, an instant win on six of a kind, the 5-dice game, short straights and the full-house bonus. They're rare, or they complicate the turn model. Revisit if anyone asks.

## 4. Host options

Platform gap: **Parlor has no per-lobby game options yet.** `GameRoom` has no options field and `createState(room, players)` only gets players. Build the engine to take `rules: FarkleRules` with a `DEFAULT_RULES` constant now, and have the definition pass `DEFAULT_RULES` until a shared "game options" feature lands (which would need `GameMeta.options` schema + lobby UI + `createState` receiving the chosen values). That feature is a core addition, not part of this game. Flag it for the human.

```ts
export interface FarkleRules {
  target: 5000 | 10000 | 15000;                     // default 10000
  opening: 0 | 350 | 500 | 1000;                    // default 500 (first bank only)
  threeOnes: 1000 | 300;                            // default 1000
  multiples: 'fixed' | 'doubling' | 'adding';       // default 'fixed'
  threePairs: 1500 | 1000 | 750 | 0;                // 0 = not a combination; default 1500
  fourAndPair: 1500 | 0;                            // default 1500
  straight: 1500 | 1000 | 2500;                     // default 1500
  twoTriplets: 2500 | 0;                            // 0 = scored as two separate triples; default 2500
  sixDiceNothing: 0 | 500;                          // default 0 (off)
  hotDice: 'may-bank' | 'must-roll';                // default 'may-bank'
  threeFarkles: 0 | 500 | 1000;                     // default 0 (off)
  ending: 'final-round' | 'first-to-target';        // default 'final-round'
}
```

`multiples` (N of a kind, where T = the three-of-a-kind value for that face):

| mode | 4 of a kind | 5 | 6 |
|---|---|---|---|
| `fixed` (default, box) | 1,000 | 2,000 | 3,000 |
| `doubling` | 2T | 4T | 8T |
| `adding` | 2T | 3T | 4T |

Presets for the host UI (one picker, then individual toggles under "More rules"):

| Preset | Differences from default |
|---|---|
| **Parlor standard** (default) | as above |
| **Box rules** | `threeOnes: 300` |
| **Doubling** (the common app/online table) | `multiples: 'doubling'`, `threePairs: 1000`, `fourAndPair: 0`, `twoTriplets: 0`, `sixDiceNothing: 500`, `opening: 0` |
| **Quick game** | `target: 5000`, `opening: 0` |

Turn timer / spectators: platform-level, not game options.

## 5. State model

No hidden information. **Every seat and every spectator gets the same view.** The board decides what "you" can do by comparing `activePlayerId` with its own `playerId`.

```ts
// types.ts
export type FarklePhase =
  | 'ready'       // start of the active player's turn, waiting for the first ROLL
  | 'selecting'   // a scoring roll is on the table; active player picks dice
  | 'bust'        // reveal: the roll farkled (~2.0s), then next turn
  | 'banked'      // reveal: the turn was banked (~1.4s), then next turn / game over
  | 'game-over';

export interface KeptGroup {
  dice: number[];    // face values, sorted
  points: number;
  label: string;     // "Three 4s + a 5", from rules.describe()
}

export type FarkleEvent =
  | { kind: 'bust'; playerId: string; lost: number; penalty: number }   // penalty>0 when 3-farkle hit
  | { kind: 'banked'; playerId: string; points: number; triggeredFinal: boolean }
  | { kind: 'hot-dice'; playerId: string }
  | { kind: 'left'; playerId: string };

export interface FarklePlayerView {
  id: string; name: string; bot: boolean; connected: boolean;
  score: number;
  onBoard: boolean;          // has banked at least once (opening met)
  farkles: number;           // consecutive farkle turns (shown only if threeFarkles on)
  out: boolean;              // left the game; skipped, cannot win
  finalTurnDone: boolean;    // in final round: has had their last turn (or is the trigger)
}

export interface FarkleView {
  phase: FarklePhase;
  rules: FarkleRules;
  players: FarklePlayerView[];
  activePlayerId: string | null;   // null at game-over
  roll: number[];                  // current roll's faces (length = dice rolled); [] in 'ready'
  rollId: number;                  // increments on every roll; the board animates on change
  scorable: number[];              // indices into roll that belong to at least one valid selection
  diceInHand: number;              // how many dice the next ROLL throws (1–6)
  kept: KeptGroup[];               // this turn, in order
  turnPoints: number;
  finalRound: { triggeredBy: string; toBeat: number } | null;  // toBeat = current leader's score
  lastEvent: FarkleEvent | null;
  winnerIds: string[];             // filled at game-over
}

export type FarkleAction =
  | { type: 'roll' }
  | { type: 'keep'; indices: number[]; then: 'roll' | 'bank' };

declare module '@parlor/game-types' {
  interface GameViewMap { farkle: FarkleView }
  interface GameActionMap { farkle: FarkleAction }
}
```

Server state (engine private fields): the same as the view plus `active: number` (seat index), `seats: Seat[]` (`Seat = FarklePlayerView`), `finalQueue: string[] | null` (ids still owed a final turn) and `randomInt`. Keep `onBoard` as an explicit flag; don't derive it from `score > 0`, because a 3-farkle penalty can return a score to 0.

### Phase machine

```
start ─(random first seat)─▶ ready
ready ──roll──▶ (roll scores? or sixDiceNothing on a 6-die roll) ─yes─▶ selecting
                                                                  └─no──▶ bust
selecting ──keep{then:'roll'}──▶ (kept all dice → diceInHand=6, event hot-dice) ─▶ roll immediately ─▶ selecting | bust
selecting ──keep{then:'bank'}──▶ banked
bust   ─(timer, advanceReveal)─▶ nextTurn()
banked ─(timer, advanceReveal)─▶ nextTurn()
nextTurn: if ending==='first-to-target' and someone ≥ target → game-over
          if finalQueue is empty → game-over
          else active = next seat not out (and still in finalQueue during the final round) → ready
```

`keep{then:'roll'}` rolls immediately (atomic), so ROLL is a separate tap only at the start of a turn.

## 6. Actions

Turn-based. Only the active seat may act, and only in `ready` / `selecting`. Every rejection is a `GameRuleError` raised before any state changes.

| Action | Payload validation (`validateAction`, untrusted) | Engine checks | Result |
|---|---|---|---|
| `roll` | `hasExactKeys(['type'])` | phase `ready`; active seat | Roll `diceInHand` dice with `randomInt(6)+1`, `rollId++`. If no valid selection exists (and it isn't a 6-die roll with `sixDiceNothing` on): `turnPoints` lost, `farkles++`, apply the penalty if `farkles===3` (clamp ≥ 0, reset to 0), `lastEvent=bust`, phase `bust`. Otherwise `selecting`. |
| `keep` | `hasExactKeys(['type','indices','then'])`; `indices` an array of 1–6 distinct integers 0–5; `then` ∈ `roll`/`bank` | phase `selecting`; every index < `roll.length`; `scoreSelection(dice, rules)` not null. If `then==='bank'`: (`onBoard` or `turnPoints+points ≥ opening`) and not (`hotDice==='must-roll'` and the selection uses every die of the roll) | Push a `KeptGroup`, `turnPoints += points`, `diceInHand = roll.length - indices.length \|\| 6`. **bank**: `score += turnPoints`, `onBoard=true`, `farkles=0`; if no final round yet and `score ≥ target`: start the final round (`finalQueue` = other seats not out, or game-over at the next advance for `first-to-target`); if in the final round, mark `finalTurnDone`; phase `banked`. **roll**: perform `roll` as above (event `hot-dice` if `diceInHand` became 6). |

Error copy (short, plain): "It's not your turn." / "Roll first." / "Every die you keep has to score." / "Keep at least one scoring die." / "Your first bank needs 500 points. Keep rolling." / "Hot dice: roll again before you bank."

The 6-die `sixDiceNothing` roll: the only valid selection is all six (500 points). `scorable` = all indices.

Engine API (mirrors Hearts):
```ts
class FarkleEngine {
  constructor(players: {id;name;bot}[], randomInt = secureRandomInt, rules = DEFAULT_RULES)
  get currentPhase(): FarklePhase
  roll(id: string): void
  keep(id: string, indices: number[], then: 'roll' | 'bank'): void
  advanceReveal(): void                       // bust/banked → next turn or game-over
  automaticMove(): (() => void) | undefined   // bots + disconnected stand-ins; undefined if no connected human
  setConnected(id: string, connected: boolean): void
  removePlayer(id: string): void              // out = true; see below
  view(): FarkleView
}
```

**Timing (definition `drive`)**, copied from `games/hearts/src/definition.ts`: `bust` reveal 2000ms, `banked` reveal 1400ms (2500ms when it triggered the final round), bot/stand-in step 900ms (long enough to watch the dice land and see the kept group appear). All timers go through `instance.schedule(..., 'farkle-step')`.

**Leaving (`onPlayerRemoved`)** calls `removePlayer`: `out=true`, removed from `finalQueue`. If they were active, the turn ends with no points (no bust event; `lastEvent = left`) and the next turn starts. If fewer than 2 seats remain not-out, it's game over and the remaining seat wins. Disconnects (not removals) keep the seat. The stand-in plays the turn with the bot strategy (§9), exactly as Hearts does.

## 7. Mapping to this codebase

**Package:** `@parlor/farkle`, id `farkle`, folder `games/farkle/` (a draft already exists, untracked). Layout per docs/ADDING_GAMES.md §1: `package.json` (no `@parlor/cards`), `tsconfig.json`, `turbo.json`, `src/{types,meta,rules,engine,definition}.ts`, `src/GameView.svelte`.

**Meta:** as in the draft (`minPlayers 2`, `maxPlayers 6`, `estimatedMinutes '15-30'`, `tags ['dice','classic']`, `displayModes ['peer']`, `supportsBots true`). Description: "Roll six dice, keep the scorers, and bank before a bust wipes your turn." Catalog tagline: "Push your luck to 10,000 points".

**rules.ts (pure, imported by the board for the live preview):**
```ts
export const DEFAULT_RULES: FarkleRules;
export function tripleValue(face: number, r: FarkleRules): number;            // 1 → r.threeOnes, else face*100
export function nKindValue(face: number, n: 3|4|5|6, r: FarkleRules): number;
/** Best complete partition of `dice` into combinations, or null if some die can't score. */
export function scoreSelection(dice: readonly number[], r: FarkleRules, wholeRoll = dice.length): number | null;
export function describe(dice: readonly number[], r: FarkleRules): string;    // "Three 4s + a 5"
export function validSelections(roll: readonly number[], r): { indices: number[]; points: number }[]; // ≤63 subsets
export function scorableIndices(roll, r): number[];
export function isFarkle(roll, r): boolean;
export function canBankAfter(turnPointsAfter: number, onBoard: boolean, usesAllDice: boolean, r): boolean;
```
`scoreSelection` sketch (memoise on the counts key; at most 6 dice, so it's trivial):
```
best(counts, n, sixDieSelection):
  if n == 0 → 0
  cands = []
  if sixDieSelection (n == 6, the whole selection is one full 6-die roll):
     straight (all counts 1)                       → r.straight
     three pairs: exactly three faces with count 2 → r.threePairs (if ≠0)
     four+pair: one face 4 and another face 2      → r.fourAndPair (if ≠0)
     two triplets: two faces with count 3          → r.twoTriplets (if ≠0)
     (each of these consumes all 6 dice → cands.push(value))
  for face 1..6, for k in 6..3 with counts[face] ≥ k: cands.push(nKindValue(face,k) + best(counts−k@face, n−k, false))
  if counts[1] ≥ 1: cands.push(100 + best(counts−1@1, n−1, false))
  if counts[5] ≥ 1: cands.push(50  + best(counts−1@5, n−1, false))
  return max of non-null cands, else null
```
The six-dice combinations apply only to a selection that is all six dice of a 6-die roll. `sixDiceNothing` is handled in the engine, not here.

**Draft vs brief (what to change in `games/farkle/src`):**

| Draft | Brief |
|---|---|
| `scoreDice` hard-codes doubling multiples and no best-partition (four 1s = 2,000 under doubling, fine; under fixed it would need partitioning) | `scoreSelection` with `FarkleRules`, best partition |
| actions `roll` / `keep` / `bank` (keep and roll are separate taps; `ready` after every keep) | `roll` + atomic `keep{indices, then}` |
| `finalTrigger` seat index; game ends when the turn wraps to it | `finalQueue` of ids (survives removals) |
| no winner/standings, no `out`, `onPlayerRemoved` = stand-in forever | `winnerIds`, `removePlayer`, ties shared |
| view lacks `rules`, `scorable`, `rollId`, `lastEvent`, `onBoard` | add them |
| single `act()` + `automaticAction()` | Hearts-style `automaticMove()` closure (fine either way; keep the `GameRuleError` before mutation) |

**Copy patterns from:**
- `games/hearts/src/definition.ts`: `drive`, reveal vs automatic step, `validateByType` + `hasExactKeys`.
- `games/hearts/src/engine.ts`: seats, `setConnected`, `automaticMove` pausing when no connected human, `view()`.
- `games/liars-dice/src/lib/server/definition.ts`: `onPlayerRemoved` → `forfeit` (the seat leaves the turn order).
- `games/liars-dice/src/lib/components/game/GameView.svelte`: `PipDie` sizing (`--die-size` per breakpoint), dice rows on `Felt tone="night"`, `picked`/`dimmed`.
- `games/quixx/src/lib/components/game/Die.svelte`: tinting `PipDie` via `--die-face` / `--die-pip`.

**Booty Dice overlap check:** Booty Dice also rolls 6 dice and keeps some (`Die.locked`, `lockDice`, `DiceRoller` in `games/booty-dice/src/lib/server/game/DiceRoller.ts`). It's an old standalone app with pirate faces (`BootyDie.svelte` + `FaceIcon`), not pips, and its locked dice can be re-rolled later. Nothing there can be imported. Farkle uses `PipDie` from `@parlor/ui` like Liar's Dice and Quixx do. The only shared need is a roll animation (below).

**Reuse from `@parlor/ui`:** `TurnBanner`, `SeatChip` (stat = score, e.g. "4,250"; add "needs 500" in Faded Ink while not on board), `Felt`, `PipDie`, `Button` (`shout` for ROLL / KEEP & ROLL), `GameOver` (standings measure = score), `seatTone`.

**Board-kit additions (flag):**
1. **`PipDie` `rolling` prop**: a 450–600ms tumble (rotate + cycling faces, settling on `value`), with a fade under `prefers-reduced-motion`. Quixx, Liar's Dice and Farkle all roll pip dice, so per the Collection Rule it belongs in the kit, not in this game. Trigger it from the board when `rollId` changes.
2. (Optional) **`DiceRack`**: a row of small `PipDie`s with a points label, for the kept groups. Make it shared only if Yahtzee / Can't Stop briefs want the same thing; otherwise keep it local.

**Wiring:** the six places in ADDING_GAMES.md §7, plus `apps/parlor/src/lib/games/catalog.ts` (the shelf list the home and lobby pages read; `shelf: 'linen'`). `apps/parlor/package.json` already lists `@parlor/farkle` in the uncommitted working tree. RulesModal sections: "Your turn", "What scores" (the compact table, reflecting `rules`), "Hot dice", "Getting on the board", "Winning".

## 8. Board UI

**Shelf colour: Linen.** Kings Corner is the only linen game so far, and it's a card game. Dice games are Quixx felt, Booty clay and Liar's ink. Mustard is ruled out because the dice would blur with the butter "kept" state and the mustard "you can act" ring. Pieces: **paper dice with espresso pips** (`--die-face: var(--color-paper)`, the `PipDie` default), on a `Felt` (forest) surface so they pop. The kept rack sits on a linen strip inside the felt (the game's colour on its surface, not on the chrome). If the shelf order puts Farkle next to Kings Corner, use Espresso instead (`shelf: 'ink'`, cream pips on espresso dice).

Phone (390px):
```
┌ TurnBanner ─────────────────────────────────┐
│ Your turn                                    │
│ Tap scoring dice, then roll on or bank.      │
└──────────────────────────────────────────────┘
 (A)4,250  (B)3,900  (C)·needs 500  (D)8,100     ← SeatChips, wrap; active = felt
 Playing to 10,000          [Final round: beat 10,250]
┌ Felt ────────────────────────────────────────┐
│  This turn  650                 3 dice left  │
│                                              │
│   [1] [4] [4] [4] [6] [2]                    │ ← roll; scorable dice wear the mustard ring,
│    ^butter = selected                        │   non-scorable dimmed
│  Keep: three 4s + a 1 = 500                  │ ← live preview from rules.scoreSelection
│ ┄┄ kept (linen strip) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│   [5] 50     [1][1] 200                      │
└──────────────────────────────────────────────┘
 [ Bank 1,150 ]        [ KEEP & ROLL 2 ]          ← outline + shout; disabled with a hint above
```
- `ready` phase (turn start only): one shout, **ROLL 6 DICE**. The shout in selecting reads **KEEP & ROLL n** (**KEEP & ROLL 6** with a "Hot dice!" chip when the selection uses every die).
- Selecting: tap a die to toggle it (`PipDie onclick`, `aria-pressed`, 44px+ targets; `--die-size` 48px phone, 56px desktop). Non-scorable dice are disabled (`dimmed`). Both buttons stay disabled until the selection scores, with the hint "Every die you keep has to score." Bank is disabled below the opening threshold, with the hint "Your first bank needs 500. You have 350." A double-tap on a die is not a confirm. Confirming is always the button.
- Not your turn: the same felt, read-only. The banner says "Margaret's turn" and "Margaret has 650 riding on 2 dice." Others see the kept groups appear as the bot or player confirms.
- `bust`: the roll stays visible, dimmed. A "Farkle!" stamp (Nunito 900, Deep Clay on paper, ink outline) shows "Lost 650". With the three-farkle penalty it reads "Third farkle in a row: −500".
- `banked`: "+1,150" floats onto the active SeatChip, and the score counts up.
- Final round: a tag under the seats, and the TurnBanner detail "Last turn: beat 10,250."
- `game-over`: `GameOver` with standings (score). Left players are listed last and struck through.

Desktop (≥ 900px): the same column, capped at ~720px. Seats move into a column on the left (SeatChip `wide`) beside the felt, and the dice grow to 64px.

Animations (moderate, reduced-motion safe): dice tumble on `rollId` change (kit addition), kept dice slide from the roll into the rack (Svelte `crossfade`), the bust stamp scales in with a slight overshoot, the bank count-up, and a short shimmer on the kept rack for hot dice.

## 9. Bot AI

Deterministic heuristic in `automaticMove()`. It's used for bot seats and for a disconnected human's stand-in. It pauses when no connected human remains (as in Hearts). Roughly, it banks once the farkle risk outweighs the likely gain.

```
BANK_AT = { 1: 250, 2: 300, 3: 400, 4: 750, 5: 2000, 6: 5000 }   // by dice that would be left to roll

ready     → roll
selecting →
  sels = validSelections(roll); max = highest points (tie: fewer dice used)
  1. if max uses every die → keep(max, then: hotDice must-roll ? 'roll' : decide(turn+max, 6))
  2. decide on max: after = turn + max.points, left = roll.length − |max|
     if canBankAfter(after) and (
          (no final round and my score + after ≥ target)              // banking wins/triggers
       or (final round and my score + after > toBeat)                  // beat the leader, stop
       or (final round == false and after ≥ BANK_AT[left]))
       → keep(max, 'bank')
  3. else keep(lean, 'roll'), where lean = all multi-die combos in max (triples+, six-dice combos);
     if max has no combo: a single 1 if present, else a single 5   // keep more dice to re-roll
     (final round and still behind: never bank, always lean+roll)
```
That's enough to fill seats. It banks around 300–400 on few dice and rarely farkles big turns. Tune `BANK_AT` later with the seeded simulator (docs/AI_STRATEGIES.md: a GA over these 6 numbers is a weekend project).

## 10. Test plan

**Engine/rules unit tests**: `apps/parlor/src/lib/server/farkle.test.ts`, with a scripted `randomInt` that returns queued faces.

Scoring (`scoreSelection`, default rules unless noted):
- singles 1 → 100, 5 → 50; [2] → null; [1,2] → null; [] → null/0 handling.
- triples for every face; three 1s = 1,000; with `threeOnes:300` = 300.
- four/five/six of a kind: fixed 1,000/2,000/3,000; doubling (four 2s = 400, six 1s = 8,000); adding (five 3s = 900).
- best partition: [1,1,1,1] fixed = 1,100; [5,5,5,5] = 1,000; [1,1,1,1,1] fixed = 2,000 (vs 1,200).
- straight 1,500 (and the option values); three pairs [2,2,3,3,4,4] = 1,500; with `threePairs:0` → null; [1,1,5,5,6,6] with threePairs 0 → null as a whole but [1,1,5,5] = 300.
- four + pair [3,3,3,3,6,6] = 1,500; with option 0 → null (the 6s can't score).
- two triplets [2,2,2,6,6,6] = 2,500; with option 0 = 800.
- six of a kind isn't three pairs / two triplets ([4×6] fixed = 3,000; doubling 3,200).
- six-dice combos never score from a roll of fewer than 6 dice (e.g. [1,1,5,5,6] has no three pairs).
- `isFarkle` true for [2,3,4,6,6,3]-like rolls; false for any roll containing a 1 or 5; `sixDiceNothing` turns that 6-die roll into a forced 500 keep.

Engine flow:
- roll → selecting; keep then roll accumulates; per-roll isolation (5 then 5,5 = 150).
- farkle loses turn points, phase `bust`, then the next seat goes on `advanceReveal`.
- hot dice: keep all → `diceInHand` 6 and an immediate 6-die roll, turn points kept; `must-roll` rejects `then:'bank'` on an all-dice keep.
- opening: bank with 450 rejected for a seat not on board (state unchanged); 500 accepted; after that a 50 bank is accepted.
- rejections leave state unchanged (snapshot `view()` before/after): wrong player, wrong phase, out-of-range index, duplicate index, non-scoring die in the selection, keep with empty indices (validator).
- three-farkle penalty: the third consecutive bust deducts, clamps at 0 and resets the counter; a bank resets the counter.
- final round: a bank to ≥ target gives each other seat one turn, the trigger doesn't play again, someone overtaking wins, ties share `winnerIds`; `first-to-target` ends at once.
- removal: an active seat removed mid-turn → next seat, no points; removed seat skipped and excluded from `winnerIds`; removal during the final round doesn't hang; 1 seat left → game over.
- stand-ins: a disconnected active human gets an `automaticMove`; none when every human is disconnected; a bot plays a whole game to game-over with a seeded RNG for 2 and 6 seats.
- view: identical for every seat and the spectator; `scorable` correct; `rollId` increments per roll.

**Over the socket:** add `farkle` to `apps/parlor/src/lib/server/seededPlaythroughs.test.ts` (dice faces appear in `numericArrays`, so check that the helper doesn't mistake faces for hidden info). **Action boundary:** malformed `keep` payloads (missing `then`, `then:'stop'`, indices `[1.5]`, `[-1]`, `[0,0]`, 7 entries, extra keys) in `actionBoundary.test.ts`.

**Playwright smoke** (`apps/parlor/e2e/farkle.test.ts`, 390×844): open "How to play Farkle" from the shelf, create a room, vote Farkle, add a bot, START, tap **ROLL 6 DICE**. Then branch on the result (the dice are random): if "Farkle!" shows, wait for the bot's turn and the banner "Your turn" to come back. Otherwise tap the first die with `data-scorable` and press **KEEP & ROLL**. Assert that the kept rack shows a points label or the bust stamp appears. Use `allTextContents()` for the optional stamp (see the harness notes).

## 11. Open questions for the human

1. **Name:** keep "Farkle" (low risk: the plain word mark is cancelled and the game is folk), or play it safe with "Ten Thousand"?
2. **Host options:** OK to build the engine with `FarkleRules` but ship with defaults only until a shared lobby "game options" feature exists? Should that feature be scheduled (it serves Farkle, Hearts' goal, Oh Hell, etc.)?
3. **Three 1s default:** 1,000 (common play) vs 300 (the Patch box)? This brief picks 1,000, which bends "faithful first", because no single canonical rulebook exists.
4. Max players 6 (the lobby cap) or allow 8 if the lobby grows?

## 12. Sources

- Patch Products, *Farkle* rules sheet #6910 (2007), hosted by Buffalo & Erie County Public Library: https://www.buffalolib.org/sites/default/files/gaming-unplugged/inst/18%20Farkle%20Instructions.pdf (scoring table, opening 500, hot dice, per-roll rule, final turn)
- Wikipedia, "Farkle": https://en.wikipedia.org/wiki/Farkle (standard table, scoring variants for 4/5/6 of a kind, three pairs, straight, two triplets, three-farkle penalty, opening variants, alternate names, history)
- Board Game Arena, Farkle game panel and help: https://en.boardgamearena.com/gamepanel?game=farkle, https://en.doc.boardgamearena.com/Gamehelpfarkle (doubling table, three pairs 1,000, six-dice-nothing 500, one last turn each)
- cardgames.io, "How to play Farkle": https://cardgames.io/blog/how-to-play-farkle/ (three 1s 1,000, fixed 1,000/2,000/3,000, straight 2,500, hot dice unlimited)
- Official Game Rules, Farkle: https://officialgamerules.org/game-rules/farkle/ (opening wording ambiguity, final round)
- Justia trademark records: FARKLE Reg. 1561159 (cancelled) https://trademark.justia.com/737/81/farkle-73781083.html; FARKLE THE CLASSIC DICE-ROLLING, RISK-TAKING GAME https://trademarks.justia.com/852/64/farkle-the-classic-dice-rolling-risk-taking-85264185.html; Legendary Games marks https://trademarks.justia.com/owners/legendary-games-inc-837166
- Farkle odds per number of dice: the standard figures, consistent with Neller & Presser's optimal-play analysis cited on Wikipedia.
