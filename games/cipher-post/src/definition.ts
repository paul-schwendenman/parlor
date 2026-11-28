import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CipherPostEngine } from './engine.js';
import { cipherPostMeta } from './meta.js';
import { faces, rounds } from './rules.js';
import type { CipherAction } from './types.js';

const drive = createTurnDriver<CipherPostEngine>('cipher-post-step', 550, (state) => state.revealing ? 4200 : undefined);

function act(game: PlayerContext<CipherPostEngine>, action: CipherAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<CipherPostEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

function sealAction<T extends 'pass' | 'expose'>(type: T) {
  return (input: Record<string, unknown>) => {
    const { round, sealId } = input;
    return hasExactKeys(input, ['type', 'round', 'sealId']) && isIntInRange(round, 1, rounds) && isIntInRange(sealId, 0, 23)
      ? valid({ type, round, sealId }) : invalid('Choose a seal.');
  };
}

const game: TypedGameDefinition<'cipher-post', CipherPostEngine> = {
  meta: cipherPostMeta,
  createState: (_room, players) => new CipherPostEngine(players.map(({ id, name }) => ({ id, name, bot: RoomManager.isBotPlayer(id) }))),
  validateAction: (action) => validateByType<CipherAction>(action, {
    pass: sealAction('pass'),
    expose: sealAction('expose'),
    guess: (input) => {
      const { target, round } = input;
      const face = faces.find((value) => value === input.face);
      return hasExactKeys(input, ['type', 'round', 'target', 'face']) && isIntInRange(round, 1, rounds) &&
        typeof target === 'string' && face !== undefined
        ? valid({ type: 'guess', round, target, face }) : invalid('Choose a rival and a seal value.');
    },
  }),
  actions: { pass: act, expose: act, guess: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const cipherPostDefinition = defineGame(game);
