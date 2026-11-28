import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { RidgeRunEngine } from './engine.js';
import { ridgeRunMeta } from './meta.js';
import { routes } from './rules.js';
import type { RidgeAction } from './types.js';

const drive = createTurnDriver<RidgeRunEngine>('ridge-run-step', 650, (state) => state.revealing ? 1450 : undefined);

function act(game: PlayerContext<RidgeRunEngine>, action: RidgeAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<RidgeRunEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'ridge-run', RidgeRunEngine> = {
  meta: ridgeRunMeta,
  createState: (_room, players) => new RidgeRunEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<RidgeAction>(action, {
    roll: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'roll' }) : invalid('Invalid roll.'),
    camp: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'camp' }) : invalid('Invalid camp.'),
    climb: (input) => {
      const route = routes.find(({ sum }) => sum === input.route)?.sum;
      return route && hasExactKeys(input, ['type', 'route']) ? valid({ type: 'climb', route }) : invalid('Choose a route.');
    },
  }),
  actions: { roll: act, climb: act, camp: act },
  getPlayerView: (state) => state.view(),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const ridgeRunDefinition = defineGame(game);
