# Sushi Go - Implementation Brief

Brief for *Sushi Go!* (Phil Walker-Harding, Gamewright, 2013): the original base game, not *Sushi Go Party!*. Parlor ships it under its real name with the sushi theme and the original card names (§2).

---

## 1. Overview

Players draft sushi from hands that move around the table. Every turn, everyone picks one card from their hand in secret. All picks are then revealed together, and everyone passes the rest of their hand to the left. Cards score by set: pairs, sets of three, escalating piles, a majority race and multipliers. Pudding is a long-term dessert race scored only at the end of the game. The game lasts 3 rounds.

- **Players:** 2–5 (`minPlayers: 2`, `maxPlayers: 5`). Bots can fill seats.
- **Play time:** 15–20 minutes (`estimatedMinutes: '15-20'`).
- **Display mode:** `['peer']`. Each player needs a private hand, and there is no turn order to follow.
- **Why it fits Parlor:**
  - Everyone acts at once, so nobody waits for a slow turn.
  - A child can learn it in one round.
  - It is a light opener or closer for the evening.
  - Hidden information is minimal (only the hand), so it is safe to play over a video call.

## 2. Naming & IP

Current policy (Parlor already ships Quixx under its real name; the rename rule in docs/LEGAL.md is now a pre-public-launch step):

- **Real name:** "Sushi Go". id `sushi-go`, package `@parlor/sushi-go`.
- **Real theme and card names:** Maki Roll, Tempura, Sashimi, Dumpling, Nigiri (Egg, Salmon, Squid), Wasabi, Chopsticks, Pudding.
- **Original art and layout:** our own stroke-SVG card faces and board layout in the Parlor printed style. Never Gamewright's illustrations, logo, card frames or "smiling food" character style.
- **Original rules wording:** the RulesModal text and every rules line in this doc are paraphrased. Never copy rulebook text.

| Card (`kind`) | Count | Mechanic |
|---|---|---|
| Tempura (`tempura`) | 14 | 5 per pair |
| Sashimi (`sashimi`) | 14 | 10 per set of 3 |
| Dumpling (`dumpling`) | 14 | 1/3/6/10/15 for 1/2/3/4/5+ |
| Maki Roll ×1 / ×2 / ×3 (`maki`, `count`) | 6 / 12 / 8 | most icons 6, second 3 |
| Egg / Salmon / Squid Nigiri (`nigiri`, `value` 1/2/3) | 5 / 10 / 5 | face value |
| Wasabi (`wasabi`) | 6 | the next nigiri goes on it and scores ×3 |
| Pudding (`pudding`) | 10 | kept across rounds, scored at game end |
| Chopsticks (`chopsticks`) | 4 | on a later turn, take 2 cards and return the chopsticks to the hand |

Total: 108 cards. When a player uses Chopsticks, the banner flashes "Sushi go!" (the in-game call).

## 3. Rules (verified)

### Setup
| Players | Hand size (cards per round) | Cards used over 3 rounds |
|---|---|---|
| 2 | 10 | 60 |
| 3 | 9 | 81 |
| 4 | 8 | 96 |
| 5 | 7 | 105 |

1. Shuffle all 108 cards once at the start of the game.
2. Deal each player a hand of the size in the table above. The rest is the draw pile.
3. Rounds 2 and 3 deal from the same draw pile. Do not reshuffle, and do not add discards back. The pile is always large enough (105 of 108 cards at 5 players). Leftover cards after round 3 are ignored.

### A turn (simultaneous)
1. **Pick.** Each player secretly chooses 1 card from their hand. With Chopsticks on their plate from an earlier turn, a player may choose 2 cards instead (see Chopsticks).
2. **Reveal.** When every seat has locked a pick, all picks are revealed at once and placed face up on each player's plate (their tableau). Resolve each player's Wasabi and Chopsticks as described below.
3. **Pass.** Each player passes their remaining hand to the player on their **left** (seat index +1, the same as Hearts' `PASS_OFFSET.left = 1`). The direction is left in every round; the original game never alternates.
4. Repeat until the hands are empty. On the last turn each hand has 1 card, which its holder must take. Then score the round.

### Wasabi
- When a nigiri is added to a plate that has an empty Wasabi, it goes on the **oldest** empty Wasabi and scores triple. This is mandatory and automatic.
- Each Wasabi holds one nigiri. A nigiri played when no Wasabi is empty scores face value.
- A nigiri already on the plate is never moved onto a Wasabi that arrives later.
- An empty Wasabi at the end of the round scores 0.

### Chopsticks
- Chopsticks can be used only on a turn **after** the turn they were revealed. They cannot be used on the turn they are taken.
- Using them, a player picks 2 different cards from their hand in the same locked pick. At reveal, both cards go to the plate, and one Chopsticks card (the oldest) moves from the plate into the hand that player is about to pass. Every hand stays the same size.
- **Only one Chopsticks per turn**, even if the player has several.
- They need at least 2 cards in hand, so Chopsticks cannot be used on the last turn of a round. With exactly 2 cards in hand, the player takes both and passes a hand made of just the Chopsticks.
- **Chopsticks may take a Chopsticks card.** Nothing in the rules forbids it.
- **Chopsticks may take a Wasabi and a nigiri together.** The nigiri goes on that new Wasabi. *Default:* the engine resolves the pair Wasabi-first whatever order it was submitted in. This is never worse for the player, and it saves a confusing ordering step on a phone. (BGG answers agree that Wasabi plus nigiri works with chopsticks.)
- Unused Chopsticks score 0 and are discarded at the end of the round.

### Round scoring
| Card | Scoring |
|---|---|
| Tempura | `floor(n/2) * 5` |
| Sashimi | `floor(n/3) * 10` |
| Dumpling | `[0,1,3,6,10,15][min(n,5)]` |
| Nigiri | its value (1/2/3), or ×3 when it sits on Wasabi |
| Maki Roll | Total the maki icons on the plate. **Most:** 6, split evenly among tied players, rounded down. **Second:** 3, split evenly and rounded down, awarded only when exactly one player is first. A player with **0 icons never places**. If nobody else has any icons, second place is not awarded. |
| Wasabi, Chopsticks | 0 |
| Pudding | not scored in the round. Puddings stay on the plate across rounds, and everything else is discarded. |

Split examples: two players tied for first get 3 each. Four or five tied for first get 1 each. A four-way tie for second gives 0 each.

### End of game (after round 3)
1. Score round 3.
2. Score Puddings:
   - **Most** Puddings: +6, split evenly among the tied players (rounded down).
   - **Fewest** Puddings: −6, split evenly among the tied players (rounded down). Zero Puddings counts as fewest.
   - In a **2-player game**, the fewest-Puddings penalty is not applied.
   - **All players tied** (including all at 0): *Default:* no one scores Puddings. Applying both rules literally nets to 0 at 3+ players anyway. At 2 players it gives each player +3, which changes nothing, so the default avoids a confusing "+3 / −3" line.
3. The highest total wins.
   - Tie-break: the most Puddings.
   - If still tied, the tied players share the win (`winnerIds` holds several ids, as in Hearts).

### FAQ and common misplays (defaults chosen)
| Question | Ruling / default | Source basis |
|---|---|---|
| Is placing a nigiri on empty Wasabi optional? | Mandatory, automatic | Rulebook (paraphrased): a nigiri played with wasabi waiting is placed on it |
| Which Wasabi gets the nigiri if there are several? | The oldest empty one. The result is the same either way. | Old spec. The rules are silent and scoring doesn't depend on it. |
| Do maki ties for first leave a second place? | No | Rulebook |
| Does 0 maki score second place? | No, you need at least one icon | Party rulebook states this. Applied here as clarification. |
| Party rule "tied players get full points"? | **Not used.** The original game splits points. | Original vs Party rulebooks |
| Can several Chopsticks be used in one turn? | No, one per turn | Rulebook |
| Does the 2-player game need a dummy hand? | No. The original game deals 10 each with no dummy. (The old spec's dummy-hand note was wrong.) | Rulebook |
| Can a pick be changed after locking? | Yes, until the reveal fires (see §6 `unpick`). A physical card face down is committed. Digitally we allow a change because the reveal is atomic. | Parlor choice |

## 4. Host options

Parlor has **no per-game host options plumbing yet**: `GameMeta` has no options field, and there is no lobby UI for them. Build the engine with an options object and the defaults below, and ship v1 with the defaults only.

| Option | Values | Default | Notes |
|---|---|---|---|
| `rounds` | 3 | 3 | Fixed by the rules. Exposed only for tests (a 1-round game makes playthrough tests shorter). |
| `pickTimer` | off / 20s / 40s | off | When the timer runs out, the stand-in picks for that seat (§7 stand-in logic). This needs the platform's lobby turn-timer feature (PRODUCT.md "optional turn timers"). |
| `tiedFullPoints` | bool | false | The Party scoring rule (tied players each get the full points). A house rule for families who dislike splits. |
| `seenHandsAid` | bool | false | Shows "cards you've seen in the hand coming to you". This is memory aid only, with no hidden information added: you have already held those cards. A later option. |

## 5. State model

`games/sushi-go/src/types.ts`:

```ts
export type SushiGoPhase = 'picking' | 'reveal' | 'round-scoring' | 'game-over';

export type SushiCard =
  | { id: number; kind: 'tempura' }
  | { id: number; kind: 'sashimi' }
  | { id: number; kind: 'dumpling' }
  | { id: number; kind: 'maki'; count: 1 | 2 | 3 }
  | { id: number; kind: 'nigiri'; value: 1 | 2 | 3 }
  | { id: number; kind: 'wasabi' }
  | { id: number; kind: 'pudding' }
  | { id: number; kind: 'chopsticks' };
// id 0..107, unique per physical card, fixed by buildDeck() before shuffling.
// Duplicates are common, so the client always refers to cards by id.

export interface PlateCard {
  card: SushiCard;
  /** wasabi -> id of the nigiri on it; nigiri -> id of the wasabi under it; else null. */
  pairedWith: number | null;
  /** Pick number (1-based) on which it arrived. Chopsticks usable iff turn < current. */
  turn: number;
}

export interface RoundScore {
  tempura: number; sashimi: number; dumpling: number; maki: number; nigiri: number;
  makiIcons: number; total: number;
}

export interface SushiGoPlayerView {
  id: string; name: string; bot: boolean; connected: boolean;
  handCount: number;
  /** Has a pick locked for this turn. The contents are never shown before reveal. */
  locked: boolean;
  plate: PlateCard[];            // public
  puddings: number;                  // banked puddings from earlier rounds plus puddings on the plate
  roundScores: RoundScore[];     // one per finished round
  puddingScore: number | null;       // set at game over
  total: number;
  /** In 'reveal' only: ids just added to this plate (1 or 2), for the flip animation. */
  revealed: number[];
  usedChopsticks: boolean;            // in 'reveal': this seat used Chopsticks this turn
}

export interface SushiGoView {
  phase: SushiGoPhase;
  round: number;                 // 1..3
  rounds: number;                // 3
  pick: number;                  // 1..handSize
  handSize: number;
  players: SushiGoPlayerView[];  // in seat order; the pass target is index+1
  winnerIds: string[];
  // Private to the viewer (empty/false/null for spectators):
  myHand: SushiCard[];
  myPick: number[] | null;       // locked ids, so a reconnecting player sees what is locked
  pickedForMe: boolean;          // the stand-in locked this pick while the player was away
  canPick: boolean;              // phase picking && seated && !locked
  canUseChopsticks: boolean;          // usable Chopsticks on plate && myHand.length >= 2 && canPick
}

export type SushiGoAction =
  | { type: 'pick'; cardIds: number[] }   // length 1, or 2 with Chopsticks
  | { type: 'unpick' };

declare module '@parlor/game-types' {
  interface GameViewMap { 'sushi-go': SushiGoView }
  interface GameActionMap { 'sushi-go': SushiGoAction }
}
```

Server-only state inside `SushiGoEngine`:

```ts
interface Seat {
  id: string; name: string; bot: boolean;
  connected: boolean;
  removed: boolean;              // left the room for good: permanent stand-in
  hand: SushiCard[];
  plate: PlateCard[];
  bankedPuddings: number;            // puddings from finished rounds
  pick: { ids: number[]; byStandIn: boolean } | null;
  roundScores: RoundScore[];
  puddingScore: number | null;
  revealed: number[]; usedChopsticks: boolean;
}
class SushiGoEngine {
  private seats: Seat[]; private deck: SushiCard[]; // undealt pile, top = end
  private phase: SushiGoPhase; private round = 0; private pickNo = 1;
  private readonly handSize: number;  // 12 - players  (2→10 … 5→7)
  private winnerIds: string[] = [];
}
```

**Visibility**

| Data | Owner | Other seats | Spectator |
|---|---|---|---|
| Own hand, `myPick` | yes | no | no |
| `handCount`, `locked` | yes | yes | yes |
| Plates, puddings, scores | yes | yes | yes |
| Pick contents before reveal | own only | **never** | **never** |
| Draw pile | count only, not sent (it is implied) | | |

**Phase machine**

```
deal(round) ──► picking ──(last seat locks)──► reveal ──advanceReveal()──┐
                   ▲                                                      │
                   └──── hands non-empty: pass left, pick++ ◄─────────────┤
                                                                          │ hands empty
                                       round < 3: round-scoring ◄─────────┤ scoreRound()
       deal(round+1) ◄── advanceReveal() ───┘                             │
                                       round = 3: score puddings ──► game-over
```

- When the last seat locks, the pick handler resolves the reveal synchronously. No timer races with `unpick`.
- `advanceReveal()` passes the hands, then either reopens `picking` or calls `scoreRound()`.
- After round 3, the engine skips `round-scoring` and goes straight to `game-over`. The game-over screen carries the round 3 breakdown and the Pudding scores.

## 6. Actions

| Action | Payload validation (`validateAction`) | Engine checks (throw `GameRuleError` before mutating) | Effect |
|---|---|---|---|
| `pick` | `hasExactKeys(['type','cardIds'])`. `cardIds` is an array of length 1–2 of distinct integers in `[0,107]`. Anything else: `invalid('Choose one card, or two with chopsticks.')` | `phase==='picking'`; seated and not removed; `pick===null` ("You've already picked. Change it first."); every id in the hand ("That card isn't in your hand."); for length 2, the seat has Chopsticks with `turn < pickNo` ("You need chopsticks from an earlier turn to take two.") and `hand.length >= 2` | Sets `pick`. If every seat is now locked, run `reveal()` |
| `unpick` | `hasExactKeys(['type'])` | `phase==='picking'` ("The cards are already on the table."); the seat has a pick | `pick = null` (this also clears a stand-in's pick) |

**reveal()** runs atomically for each seat in turn:
1. Order the picked cards: put a Wasabi before a nigiri, otherwise keep the submitted order.
2. Remove the picked cards from the hand and push them to the plate with `turn = pickNo`.
3. When a nigiri is pushed, pair it with the oldest empty Wasabi (one picked in the same turn counts if it was placed first).
4. If two cards were picked, take the oldest Chopsticks off the plate and append it to the hand.
5. Set `revealed` and `usedChopsticks`, then `phase = 'reveal'`.

**advanceReveal()**
- From `reveal`: if every hand is empty, call `scoreRound()`. Otherwise:
  - rotate the hands: `newHand[(i+1)%n] = hand[i]`
  - `pickNo++`
  - clear each seat's `pick`, `revealed` and `usedChopsticks`
  - set `phase = 'picking'`
- From `round-scoring`: call `deal()`.

**Timing**
- Picking is simultaneous. Nobody has an active turn, so `TurnBanner` keys off `canPick`.
- Two reveal moments: the per-turn `reveal` (held for 1.6s, 2.2s if anyone used Chopsticks) and `round-scoring` (held for 6s).

## 7. Mapping to this codebase

- **Package:** `@parlor/sushi-go`. **id:** `sushi-go`, used everywhere.
- **Meta:** `tags: ['cards','drafting','family']`, `supportsBots: true`.
- **Dependencies:** follow ADDING_GAMES.md but **drop `@parlor/cards`**. These are not standard playing cards.

**Files:** follow `docs/ADDING_GAMES.md` §1, copying `games/hearts/` (layout, tsconfig, turbo.json).

| File | Contents |
|---|---|
| `src/types.ts` | §5 |
| `src/meta.ts` | `sushiGoMeta` |
| `src/rules.ts` | Pure functions the client may import: `buildDeck()`, `HAND_SIZE`, `scorePlate(plate)`, `scoreMaki(icons[])`, `scorePuddings(counts[], twoPlayer)`, `pairWasabi`, `usableChopsticks(plate, pickNo)`, `cardName(c)`. The board uses `scorePlate` for running tallies. |
| `src/bot.ts` | `choosePick(hand, plate, others, ctx) → number[]` (§9) |
| `src/engine.ts` | `SushiGoEngine(players, randomInt = secureRandomInt, options)`. Methods: `pick`, `unpick`, `advanceReveal`, `automaticMove`, `setConnected`, `remove`, `view`, `currentPhase`. Shuffle with `fisherYatesShuffle` from `@parlor/multiplayer/random`. |
| `src/definition.ts` | Copy `games/hearts/src/definition.ts`, with `drive` changed as below |
| `src/GameView.svelte` | §8 |
| `src/SushiCardFace.svelte` | Face art per `kind`, rendered inside the new kit `CardFrame` |

**`drive(game)`** follows Hearts' pattern, with one schedule slot `'sushi-go-step'`:
- In `reveal`: schedule `advanceReveal` after 1600/2200ms.
- In `round-scoring`: schedule `advanceReveal` after 6000ms.
- Otherwise, if `automaticMove()` returns a move: schedule it after 500ms, then `broadcast` and call `drive` again. Bots lock one seat per step, which staggers them naturally.

**Disconnects mid-pick.** These rules decide what a seat does when its player drops during picking.

- `automated(seat)` is `seat.bot || !seat.connected`, the same rule as Hearts' `automaticMove`.
- **Bots** pick as soon as their step comes up.
- **Absent humans (disconnected or removed) pick last.** Their stand-in pick runs only when **every present seat has already locked**. Then it runs after a 1.5s step (the delay comes from the schedule).
- **Why absent humans wait:** a dropped player never delays anyone beyond 1.5s, and they get the longest possible window to come back and pick for themselves. This keeps the platform rule "the table never waits on someone who isn't there" (`packages/multiplayer/src/absentTurns.ts`). `scheduleAbsentTurn` itself does not fit, because it assumes one active seat, so implement the rule in `automaticMove`.
- **Already locked before the drop:** the pick stands. Nothing changes.
- **Stand-in pick:** uses `bot.ts` and sets `byStandIn: true`. When the player reconnects before the reveal, they see "Picked for you" (`pickedForMe`) and can `unpick` to choose again.
- **No connected human left:** `automaticMove` returns `undefined`, so bots and stand-ins pause (Hearts convention).
- **`onPlayerRemoved`:** `remove(id)` marks the seat `removed` and keeps it as a permanent stand-in. The seat count must stay fixed for hands to rotate. On the board it reads "away" on `SeatChip`. Removed seats keep scoring and can win, as Hearts does.
- **Reconnect:** `setConnected(id, true)` (the `removed` flag is never cleared, because a removed player rejoins as a new player).

**App wiring:** the six places in ADDING_GAMES.md §7, plus the shelf entry in `apps/parlor/src/lib/games/catalog.ts`:

```ts
{ ...sushiGoMeta, shelf: 'linen', tagline: 'Pick a sushi, pass the rest' }
```

Add "Sushi Go linen" to the "Its colour" list in `design-full.md`.

**Reuse from `@parlor/ui`:**
- `TurnBanner`
- `SeatChip` with `stat`: "Picked" or "Choosing", then the score
- `CardBoard`, `Felt`
- `Button` (`shout` for the confirm, `pressed` for the Chopsticks toggle)
- `GameOver` with standings and a `more` snippet for the score breakdown
- `seatTone`

**NEW board-kit additions** (flag these: Love Letter, Coup and Skull will need them too):
1. **`CardFrame.svelte`** (`@parlor/ui/cards`)
   - The shell of `PlayingCard`, without rank or suit: paper stock, ink outline, `--card-w`, the `--card-back` face-down state.
   - The `playable` / `selected` / `marked` / `dimmed` states and the second-tap button semantics.
   - A `face` snippet for the art, an `index` snippet for the top-left corner (readable when cards overlap), and an `aria-label` prop.
   - Refactor `PlayingCard` to render through it, so both stay identical.
2. **Generic `CardHand`.**
   - Today `CardHand` is typed to `@parlor/cards` `Card` and keys its items on `suit+rank`.
   - Make it generic: `CardHand<T>` with `key(t)`, `label(t)` and a `card` snippet.
   - Alternatively, add a sibling `ItemHand`. Avoid duplicating the overlap and lift CSS.

## 8. Board UI

**Shelf colour:** **linen**. Of the existing shelf colours, only Kings Corner uses linen, while felt, mustard, clay and ink are each used twice.
- Card backs are linen with an espresso pattern (`--card-back`).
- Card faces are paper with a thin coloured band per category, so sets read at a glance: tempura/sashimi mustard; dumpling/maki clay; nigiri/wasabi forest; pudding espresso; chopsticks ink-muted.
- Each band has an icon and number, not colour alone (for colour-blind players).
- If a sibling new game also takes linen next to Sushi Go on the shelf, fall back to clay.

**Phone (390px)**

```
┌ lid: PARLOR · ? · Leave ─────────────┐
│ TurnBanner  "Pick a card"            │  felt when canPick
│  "Round 2 · pick 3 of 8 · pass to Joe"│
├──────────────────────────────────────┤
│ (Mia ✓ 23)(Joe … 18)(Bot ✓ 20)        │  SeatChips, scrollable row;
│                                      │  tap = show that plate
├ Felt ────────────────────────────────┤
│ Your plate          running 14       │
│ [Tempura ×2 =5] [Sashimi 2/3] [Dumpling ×3 =6]  grouped stacks with tallies
│ [Wasabi+Squid 9] [Maki 4] [Chopsticks]  │
│ Puddings (banked + this round) ●●         │
│ ── Joe's plate (collapsed summary) ── │
│ Maki 5 · Puddings 1 · 12 pts          │
├──────────────────────────────────────┤
│ [Use chopsticks] (pressed toggle)          │  only when canUseChopsticks
│ ▁▁▁ hand: up to 10 overlapping cards ▁│  CardHand, --card-w 64px
└──────────────────────────────────────┘
```

**Desktop (≥900px):** the hand sits at the bottom across the full width. Above it, every plate shows at once in a grid (2–3 columns), with your own plate first and highlighted. Seat chips sit above the grid.

**Interactions**
- **One card:** the first tap lifts it, and the banner reads "Tap the Squid Nigiri again to take it." The second tap locks the pick. This is the shared second-tap convention.
- **Chopsticks:** pressing `Use chopsticks` switches to multi-select. Pick 2 cards, and a shouted **TAKE BOTH** button locks the pick. Pressing the toggle off clears the selection.
- **After locking:** the hand dims, and the chosen card(s) show face up at the plate edge with a dashed "on its way" outline (visible only to you). The banner shows "Picked. Waiting for Joe and Mia." with an outline **Change** button (`unpick`). If the stand-in picked for you: "Picked for you while you were away." with Change.
- **Spectators:** see plates and locked status only.
- **Mustard ring:** on hand cards while you can act. Butter shows a lifted card.

**Animations** (moderate, all with a reduced-motion crossfade)
1. **Reveal:** every plate's new card(s) flip face up at the same moment (rotateY, 300ms). For players who used Chopsticks, the Chopsticks slide from the plate into their hand, and the banner flashes "Sushi go! Mia used chopsticks."
2. **Pass:** your hand slides out to the left and the next hand slides in from the right (250ms). The banner names who passed it to you.
3. **Wasabi:** a nigiri lands onto the Wasabi with a small settle, and its tally bumps.
4. **Round scoring:** a category table (rows Maki Rolls / Tempura / Sashimi / Dumplings / Nigiri / Round / Total), with players as columns and phone-scrollable. It is held 6s with a countdown hint. Puddings get a "carried over" pill.

## 9. Bot AI

The bot is a greedy marginal-value heuristic in `bot.ts`.
- It is deterministic given the hand, with ties broken by the lowest card id, so seeded tests are stable.
- It only reads what a seated player could see: its own hand, all plates, and the pick and round numbers.

`left` = cards still to be picked this round, counting this one (= hand.length).

| Card | Value |
|---|---|
| Tempura | odd count on plate → 5. Else `left >= 3 ? 2.5 : 0` |
| Sashimi | count%3==2 → 10. count%3==1 → `left >= 3 ? 4 : 0`. Else `left >= 5 ? 3 : 0` |
| Dumpling | next increment: `[1,2,3,4,5,0][min(n,5)]` |
| Nigiri | value × (empty Wasabi ? 3 : 1) |
| Wasabi | `left >= 3 ? 3.5 : 0`, and 0 if the bot already has an empty Wasabi |
| Maki Roll | `icons × 1.2` when this could reach or keep 1st or 2nd place (compare against the top two other totals), else `icons × 0.4` |
| Pudding | `1 + round` (2/3/4). +2 in round 3 if this would lift the bot off the fewest-Puddings spot or onto the most-Puddings spot |
| Chopsticks | `left >= 4 ? 2.5 : 0` |

**Using Chopsticks:** if `canUseChopsticks`, compute the best pair.
- A pair's value is the sum of the two singles, scored sequentially: the first card is applied to a simulated plate before valuing the second, so Wasabi+nigiri and tempura+tempura are scored correctly.
- Use the pair when it beats the best single by at least 3. Otherwise take the single.

The stand-in reuses the same function. Make it pure, so it is easy to swap in GA-tuned weights later (docs/AI_STRATEGIES.md).

## 10. Test plan

**Engine and rules** (`apps/parlor/src/lib/server/sushi-go.test.ts`, seeded `randomInt`):

1. `buildDeck()` makes 108 cards with exact counts per kind/value/count and unique ids.
2. Hand size is 10/9/8/7 for 2–5 players. The constructor rejects 1 and 6 players.
3. No reshuffle: round-2 hands come from the remaining pile, and no card id is ever dealt twice in a game.
4. Locking alone doesn't reveal. The last lock reveals at once. All plates grow by one, and hands rotate to seat+1 only after `advanceReveal`.
5. Picking a card not in the hand, picking twice, picking during `reveal`, or a 2-card pick without Chopsticks each throws, and the state is unchanged (deep-equal snapshot).
6. `unpick` then `pick` a different card works. `unpick` after the reveal throws.
7. Chopsticks taken this turn are not usable until next turn (`turn < pickNo`). With them, a 2-card pick works: both cards land on the plate and the Chopsticks return to the passed hand, so hand sizes stay equal. One Chopsticks per turn even with 2 on the plate. A 2-card pick with 1 card in hand throws.
8. Chopsticks with exactly 2 cards in hand: the passed hand is `[chopsticks]`. Chopsticks taking Chopsticks is allowed.
9. Wasabi: a later nigiri goes on the oldest empty Wasabi (×3). An earlier nigiri never moves. Wasabi+nigiri taken together with Chopsticks pairs whichever order was submitted. An empty Wasabi scores 0.
10. Scoring tables:
    - tempura 1→0, 2→5, 3→5, 4→10
    - sashimi 2→0, 3→10, 6→20
    - dumplings 0..6 → 0/1/3/6/10/15/15
11. Maki:
    - a single leader and a single second
    - 2-way tie for first (3 each, no second)
    - 4-way tie for first (1 each)
    - a single first and a 2-way second (1 each)
    - a single first and a 4-way second (0 each)
    - a 0-icon player never places
    - only one player has icons (no second place awarded)
12. Puddings:
    - most/fewest with ties (floors)
    - 2-player has no penalty
    - everyone tied scores no one
    - zero puddings counts as fewest
    - puddings persist across rounds while the other cards are discarded
13. Game end: three rounds, then `game-over`, with no `round-scoring` after round 3. Tie on total broken by puddings. A full tie gives multiple `winnerIds`.
14. Views:
    - the owner sees their hand and `myPick`
    - other seats and spectators see `locked: true` but no card ids for a pending pick
    - the spectator hand is empty
    - `revealed` is populated only in `reveal`
15. Stand-ins:
    - a disconnected unlocked seat is **not** auto-picked while a present seat is still unlocked
    - it is auto-picked once all present seats are locked
    - a seat that locked before disconnecting keeps its pick
    - reconnect, then `unpick`, clears a stand-in pick
    - no connected humans means `automaticMove()` is undefined
    - a removed seat keeps playing to game end
16. Full seeded playthroughs with all bots plus one scripted human, at 2 and 5 players: the game finishes and the totals equal the sum of the breakdowns.

**Socket and boundary**
- Add `sushi-go` to `seededPlaythroughs.test.ts` and check private-hand isolation per frame.
- Add malformed `pick` payloads to `actionBoundary.test.ts`: a non-array, length 0 and 3, duplicate ids, a float, a negative id, 108, extra keys.

**Playwright** (`apps/parlor/e2e/sushi-go.test.ts`, 390×844), modelled on `e2e/spades.test.ts`:
1. Open "How to play Sushi Go" from the shelf.
2. Create a room, vote Sushi Go, add 2 bots, and start.
3. The banner says "Pick a card". Tap a hand card twice, and "Picked" appears.
4. Wait for the reveal: your plate has 1 card, the hand count drops by 1, and the hand's card ids changed (a pass happened).
5. Use `allTextContents()` for optional elements.

## 11. Open questions for the human

1. **Card art:** draw sushi faces in the Parlor stroke-icon style, or commission illustrations later?
2. **Host-options plumbing** doesn't exist yet. Ship v1 with defaults and no pick timer?
3. **Board-kit change:** OK to add `CardFrame` and make `CardHand` generic (touching the shared kit and `PlayingCard`) rather than a game-local card?
4. **Changing a pick:** is `unpick` (change a pick until the reveal) wanted, or should a lock be final like the physical game?

## 12. Sources

- Gamewright *Sushi Go!* rulebook (original). PDF copy: https://www.world-of-board-games.com.sg/docs/Sushi-Go.pdf
- Rules summary used to verify counts, hand sizes, chopsticks, wasabi, maki and pudding scoring: https://ultraboardgames.com/sushi-go/game-rules.php
- *Sushi Go Party!* rules (used to contrast the Party full-points tie rule, to support the "at least one maki to score" clarification, and for "no penalty at 2 players"): https://officialgamerules.org/game-rules/sushi-go-party-rules/
- BGG rules threads on wasabi and chopsticks ordering: https://boardgamegeek.com/thread/1021603/question-on-wasabi and https://boardgamegeek.com/thread/1314017/alternate-chopsticks-rules
- Game overview: https://en.wikipedia.org/wiki/Sushi_Go!
- Parlor: `docs/ADDING_GAMES.md`, `docs/LEGAL.md`, `games/hearts/src/{engine,definition,rules}.ts`, `packages/multiplayer/src/absentTurns.ts`, `apps/parlor/src/lib/games/catalog.ts`, `apps/parlor/.impeccable/design-full.md` (Game boards)
