import {
  defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { TheMindEngine } from './engine.js';
import { theMindMeta } from './meta.js';
import type { MindAction } from './types.js';

const TICK = 'the-mind-tick';

/** Real-time play: one timer for whatever the engine says is due next. */
function drive(game: GameContext<TheMindEngine>) {
  const { state, instance } = game;
  instance.cancel(TICK);
  const at = state.nextDeadline();
  if (at === null) return;
  instance.schedule(() => {
    state.tick();
    game.broadcast();
    drive(game);
  }, Math.max(0, at - Date.now()), TICK);
}

function act(game: PlayerContext<TheMindEngine>, action: MindAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<TheMindEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const bare = (type: 'stop' | 'propose-star') => (input: Record<string, unknown>) =>
  hasExactKeys(input, ['type']) ? valid<MindAction>({ type }) : invalid('Invalid action.');

const game: TypedGameDefinition<'the-mind', TheMindEngine> = {
  meta: theMindMeta,
  createState: (_room, players) => new TheMindEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<MindAction>(action, {
    play: (input) => hasExactKeys(input, ['type', 'card']) && isIntInRange(input.card, 1, 100)
      ? valid({ type: 'play', card: input.card }) : invalid('Choose a card.'),
    ready: (input) => hasExactKeys(input, ['type', 'ready']) && typeof input.ready === 'boolean'
      ? valid({ type: 'ready', ready: input.ready }) : invalid('Invalid ready.'),
    'vote-star': (input) => hasExactKeys(input, ['type', 'agree']) && typeof input.agree === 'boolean'
      ? valid({ type: 'vote-star', agree: input.agree }) : invalid('Invalid vote.'),
    stop: bare('stop'),
    'propose-star': bare('propose-star'),
  }),
  actions: { play: act, ready: act, stop: act, 'propose-star': act, 'vote-star': act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onPlayerRemoved: (game) => {
    game.state.remove(game.playerId);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

export const theMindDefinition = defineGame(game);
