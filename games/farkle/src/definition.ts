import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { FarkleEngine } from './engine.js';
import { farkleMeta } from './meta.js';
import type { FarkleAction } from './types.js';

const drive = createTurnDriver<FarkleEngine>('farkle-step', 700, (state) => state.revealing ? 1800 : undefined);

function act(game: PlayerContext<FarkleEngine>, action: FarkleAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

const game: TypedGameDefinition<'farkle', FarkleEngine> = {
  meta: farkleMeta,
  createState: (_room, players) => new FarkleEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<FarkleAction>(action, {
    roll: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'roll' }) : invalid('Invalid roll.'),
    bank: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'bank' }) : invalid('Invalid bank.'),
    keep: (input) => {
      const indices = input.indices;
      if (!hasExactKeys(input, ['type', 'indices']) || !Array.isArray(indices) ||
        indices.length < 1 || indices.length > 6 ||
        !indices.every((index: unknown) => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 6)) {
        return invalid('Choose dice from this roll.');
      }
      return valid({ type: 'keep', indices });
    },
  }),
  actions: { roll: act, bank: act, keep: act },
  getPlayerView: (engine) => engine.view(),
  getSpectatorView: (engine) => engine.view(),
  isGameOver: (engine) => engine.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => { game.state.setConnected(game.playerId, false); drive(game); },
  onPlayerReconnect: (game) => { game.state.setConnected(game.playerId, true); drive(game); },
  onPlayerRemoved: (game) => { game.state.remove(game.playerId); drive(game); },
  onRoomDestroyed: () => undefined,
};

export const farkleDefinition = defineGame(game);
