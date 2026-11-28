# Adding a Game to Parlor

This is the path from "we want to play X" to a game on the Parlor shelf. Copy the Hearts package (`games/hearts`) as the model: it is small, uses the current layout, and has bots, hidden hands, stand-ins for dropped players and the shared board kit.

> The older games (Quixx, Crazy Eights, Kings Corner, Booty Dice, Liar's Dice) are standalone SvelteKit apps. New games are workspace packages that the Parlor app composes and serves.

## 0. Before you write code

1. **Write a spec** in `docs/games/<GAME>.md`: players, rules, phases, what each player can see, and how a round and the game end. See `docs/games/HEARTS.md`.
2. **Add a row** to the catalog in `docs/GAMES.md` (type, players, display mode, hidden info, IP concern).
3. **Check the name.** Trademarked games get renamed and re-themed (the "IP Concern" column). Don't recreate a commercial game's name, art or text.
4. **Decide the seat rules:** min/max players, whether bots can fill seats, and what happens when someone leaves mid-game (stand-in, skip their seat, or end the game).

## 1. Package layout

```
games/<id>/
  package.json
  tsconfig.json
  turbo.json
  src/
    types.ts         view + action types, registered with @parlor/game-types
    meta.ts          name, player counts, tags (read by the home and lobby pages)
    rules.ts         optional pure rule helpers, safe to import on the client
    engine.ts        the game state machine (server only)
    definition.ts    wires the engine into the multiplayer core (server only)
    GameView.svelte  the board
```

`<id>` is kebab-case and is the game's id everywhere: the folder, `meta.id`, the type maps and the socket envelope (`oh-hell`, `kings-corner`).

### package.json

```json
{
  "name": "@parlor/<id>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./meta": "./src/meta.ts",
    "./server-definition": "./src/definition.ts",
    "./game-view": "./src/GameView.svelte"
  },
  "dependencies": {
    "@parlor/cards": "workspace:*",
    "@parlor/game-types": "workspace:*",
    "@parlor/multiplayer": "workspace:*",
    "@parlor/ui": "workspace:*"
  },
  "peerDependencies": { "svelte": "^5.0.0" },
  "scripts": { "check": "svelte-check --tsconfig ./tsconfig.json" },
  "devDependencies": { "svelte-check": "^4.1.4", "typescript": "^5.7.3" }
}
```

Leave out `@parlor/cards` if the game has no playing cards. Copy `tsconfig.json` and `turbo.json` from `games/hearts` unchanged.

## 2. Types (`types.ts`)

Define three things:

- **Actions**: a discriminated union on `type`, one member per thing a player can do: `{ type: 'bid'; amount: number } | { type: 'play-card'; card: Card }`.
- **The view**: what one player is allowed to see. Their own hand, everyone's public state, `activePlayerId`, the phase, and anything the board needs precomputed (`playableCards`, `legalBids`) so the client never re-implements the rules.
- **The registration**, which makes the id a `GameId` and gives the socket envelope its types:

```ts
declare module '@parlor/game-types' {
  interface GameViewMap { '<id>': MyView }
  interface GameActionMap { '<id>': MyAction }
}
```

Every player in the view carries `id`, `name`, `bot` and `connected`, so the board can draw bot avatars and dropped seats.

## 3. Meta (`meta.ts`)

```ts
import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js'; // pulls in the type registration

export const myGameMeta: GameMeta & { id: '<id>' } = {
  id: '<id>',
  name: 'My Game',
  description: 'One sentence for the shelf card.',
  minPlayers: 3,
  maxPlayers: 6,
  minutes: { min: 15, max: 30 },   // typical full game, shortest to longest
  kind: 'cards',                   // GAME_KINDS: cards, dice, board, word, drawing, trivia, party
  weight: 'medium',                // light (explain in a minute), medium, heavy
  format: 'individual',            // individual, teams, coop
  tags: ['trick-taking', 'bidding'], // search keywords: mechanisms and themes only
  displayModes: ['peer'],
  supportsBots: true,
};
```

`kind`, `weight`, `format` and `minutes` drive the shelf filters and the browse page (`apps/parlor/src/lib/games/discovery.ts`), so pick them for how a family would describe the game, not how a rulebook would. `tags` are only for search: don't repeat the kind ("cards"), the weight ("strategy", "quick") or the format ("teams"); the catalogue test rejects those.

## 4. Engine (`engine.ts`)

A plain TypeScript class with no sockets and no timers, so it can be unit tested directly.

- **Constructor** takes the seated players (`{ id, name, bot }[]`) and an injectable random source (`secureRandomInt` from `@parlor/multiplayer/random` by default), so tests can seed it.
- **One method per action** (`bid(id, amount)`, `playCard(id, card)`). Check everything first: is it this player's turn, is this the right phase, is the move legal. Reject with `throw new GameRuleError('That card cannot be played on this trick.')` **before changing any state**. The core treats a `GameRuleError` as "nothing happened" and sends its message to the player. Any other exception counts as a server bug.
- **`view(playerId?)`** builds the view for one player. With no id it is the spectator view and contains only public information. Keep legal bids, playable cards, and pending selections private when they depend on a player's hand. Test the view as the acting player, another player, and a spectator.
- **Reveal phases.** If players need a moment to see a result (a won trick, a round's scores), give it a phase of its own (`trick-won`, `round-scoring`) and an `advanceReveal()` method. The definition times it.
- **Automation.** `automaticMove()` returns the next move for a bot, or for a disconnected human's stand-in, or `null` when a human has to act. Pause stand-ins when no connected humans remain. `setConnected(id, connected)` records drops and returns.
- **Pure rules** (legal cards, trick winner, scoring) go in `rules.ts`, so the board can import them too (Euchre's view uses `effectiveSuit`).

## 5. Definition (`definition.ts`)

This connects the engine to the room. Copy `games/hearts/src/definition.ts` and adapt it.

```ts
export const myGame: TypedGameDefinition<'<id>', MyEngine> = {
  meta: myGameMeta,
  createState: (_room, players) => new MyEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<MyAction>(action, { ... }),
  actions: { 'play-card': (game, { card }) => { game.state.playCard(game.playerId, card); drive(game); } },
  getPlayerView: (engine, id) => engine.view(id),
  getSpectatorView: (engine) => engine.view(),
  isGameOver: (engine) => engine.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => { game.state.setConnected(game.playerId, false); drive(game); },
  onPlayerReconnect: (game) => { game.state.setConnected(game.playerId, true); drive(game); },
  onPlayerRemoved: (game) => { game.state.setConnected(game.playerId, false); drive(game); },
  onRoomDestroyed: () => undefined,
};

export const myGameDefinition = defineGame(myGame);
```

The rules that matter:

- **`validateAction` gets untrusted input.** Check exact keys (`hasExactKeys`), parse cards with `parseCard`, check ranges, and return `invalid('message')` for anything malformed. Handlers only ever see a typed, well-formed action.
- **Every timer goes through `game.instance.schedule(fn, ms, key)`**, never `setTimeout`. The instance cancels its timers when the game resets or the room closes. After any `await`, check `game.instance.isCurrent()` before touching state.
- **`drive(game)`** is the loop that keeps the game moving. After every action or connection change it cancels the pending step, then schedules either the reveal (`advanceReveal`, about 1.2–1.4s for a trick and 5.5s for round scores) or the next automatic move (about 400ms). Recompute the automatic move inside the scheduled callback so it reflects the current seat and phase. It calls `game.broadcast()` after each step and then calls itself again.
- **The core broadcasts after every action and hook.** Call `game.broadcast()` yourself only for the in-between states inside `drive`.
- **`onPlayerRemoved` is required.** The game has to stay playable without that player: hand the seat to a stand-in, skip it, or end the game.

## 6. Board (`GameView.svelte`)

Props:

```ts
let { view, socket, playerId, isHost }: {
  view: MyView; socket: GameSocket<'<id>'>; playerId: string; isHost: boolean;
} = $props();
```

Send actions with an acknowledgement and show a rejection inline:

```ts
const result = await socket.timeout(5000).emitWithAck('game:action', action);
if (!result.ok) error = result.message;
```

PLAY AGAIN emits `lobby:restartGame`, and Back to lobby emits `lobby:resetGame` (host only).

**Build the board from the shared kit in `@parlor/ui`, not your own versions.** The Collection Rule (`apps/parlor/DESIGN.md`, and in full in `apps/parlor/.impeccable/design-full.md` under "Game boards"): if two games show the same kind of thing, they show it with the same component.

| Need | Component |
|---|---|
| Whose turn it is, and what you can do | `TurnBanner` (always first on the board) |
| The players at the table | `SeatChip` with `seat`, `bot`, `connected`, `active`, `you`, `stat` |
| Page wrapper for a card game | `CardBoard` |
| The playing surface | `Felt` (or `Felt tone="night"`) |
| Cards, a hand, a draw pile | `PlayingCard`, `CardHand`, `DrawPile` |
| The current trick | `TrickTable` |
| Team scores | `TeamScore` |
| Dice | `PipDie` |
| Buttons and toggles | `Button` (`shout` for the one main move; `pressed` for on/off options) |
| The end of the game | `GameOver` with standings |
| Seat colours | `seatTone(index)` |

Interaction conventions players already know from the other games:

- A card plays on the **second tap**. The first tap lifts it, and the banner says "Tap the King of Clubs again to play it."
- For a move that selects several cards, pass the selected array to `CardHand` and use one **Confirm** button to submit the set. Hearts shows the selection on the felt and uses `isMarked` to highlight received cards. Check that a lifted card leaves its neighbors selectable in a full mobile hand.
- A **mustard ring** means "you can act here". **Butter** means picked up.
- The **rules live in the "?" on the lid** (see step 7). Boards don't add their own rules buttons.
- The game's own colour goes on its pieces (card backs via `--card-back`, dice, sheet headers), never on the surrounding chrome.
- It has to work on a 390px phone and on desktop. Check 13-card hands and the game's maximum seat count.

## 7. Wire it into the Parlor app

These are the six places to edit:

1. **`apps/parlor/package.json`**: add `"@parlor/<id>": "workspace:*"` to dependencies. Run `pnpm install` from the repository root of the worktree you're testing and include the updated `pnpm-lock.yaml` in the change.
2. **`apps/parlor/src/lib/server/games/index.ts`**: import `myGameDefinition` from `@parlor/<id>/server-definition` and call `registerGame(...)`.
3. **`apps/parlor/src/lib/components/games/GameRenderer.svelte`**: import from `@parlor/<id>/game-view` and add an `{:else if state.gameId === '<id>'}` branch that passes `view`, `socket`, `playerId` and `isHost`.
4. **`apps/parlor/src/routes/+page.svelte`** (home shelf) and **`apps/parlor/src/routes/lobby/[roomCode]/+page.svelte`** (game picker): import `myGameMeta` and add it to the `games` list.
5. **`apps/parlor/src/routes/game/[roomCode]/+page.svelte`**: add the display name to the id → name map.
6. **`apps/parlor/src/lib/components/lobby/RulesModal.svelte`**: add an `{:else if gameId === '<id>'}` section with the rules in short, plain sections. The home shelf's "How to play" and the in-game "?" both read from it.

If the shelf colours need a new entry, update the shelf list in `design-full.md` ("Its colour") as well.

## 8. Tests

- **Engine and rules**: `apps/parlor/src/lib/server/<id>.test.ts`. Import the engine directly and cover legal moves, rejections (the move throws and the state is unchanged), scoring, game end, hidden information, and stand-ins for a disconnected seat. For variable player counts, play through at both limits and check how ties are reported. See `hearts.test.ts` and `oh-hell.test.ts`.
- **Over the socket**: add the game to `seededPlaythroughs.test.ts` so a seeded game is played end to end through the real server, checking that each player receives only their own private state.
- **Action boundary**: if `validateAction` has unusual input shapes, add malformed payloads to `actionBoundary.test.ts`.
- **Browser**: add `apps/parlor/e2e/<id>.test.ts`. On a phone-sized viewport, open the rules, create a room, vote for the game, fill seats with bots, start, and make one real move. See `e2e/spades.test.ts`.

Run before calling it done:

```sh
pnpm turbo run check --filter=@parlor/<id> --filter=@parlor/app
pnpm eslint games/<id>
pnpm -C apps/parlor exec vitest run
pnpm -C apps/parlor exec playwright test
```

## 9. Play it

From the repository root, `pnpm dev` builds the shared packages and starts Parlor. Open the URL Vite prints in the terminal. If the default port (3010) is occupied, Vite can choose another port. To select a port explicitly, build the shared packages with `pnpm exec turbo build --filter='./packages/*'`, then run `pnpm --filter @parlor/app dev --port 3020 --strictPort`.

Restart the server after changing server-side game code or switching branches. If the browser still shows an old game list or a 500, check the Vite terminal and confirm the port belongs to the worktree you intend to test. Playwright defaults to port 3010 and can reuse a running server; stop an unrelated server on that port or use a test config that sets both the server URL and the browser base URL to the test port.

Play a full game with bots on a phone-sized window and on desktop. Check setup, your turn, waiting, reveals, round scoring, game over, and a player dropping and returning mid-game.

## Checklist

- [ ] Spec in `docs/games/`, row in `docs/GAMES.md`, name cleared
- [ ] `games/<id>` package and updated workspace lockfile
- [ ] View types registered via `declare module '@parlor/game-types'`
- [ ] Engine rejects bad moves with `GameRuleError` before changing state
- [ ] Views hide other players' secrets, including the spectator view
- [ ] Players in the view carry `bot` and `connected`
- [ ] Bots and stand-ins move via `automaticMove`; every timer goes through `instance.schedule`
- [ ] `onPlayerRemoved` leaves the game playable
- [ ] Board uses the shared kit and card interactions work at 390px
- [ ] Wired into all six app locations, rules in `RulesModal`
- [ ] Engine tests, seeded playthrough, e2e test; check, lint and tests green
- [ ] Played through on a fresh server, phone and desktop
