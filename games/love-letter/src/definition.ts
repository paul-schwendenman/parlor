import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { LoveLetterEngine } from './engine.js';
import { loveLetterMeta } from './meta.js';
import { isCardValue } from './rules.js';
import type { LoveLetterAction } from './types.js';

const drive = createTurnDriver<LoveLetterEngine>('love-letter-step', 1100, (state) => state.revealing ? 5500 : undefined);

function act(game: PlayerContext<LoveLetterEngine>, action: LoveLetterAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<LoveLetterEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'love-letter', LoveLetterEngine> = {
  meta: loveLetterMeta,
  createState: (_room, players) => new LoveLetterEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<LoveLetterAction>(action, {
    play: (input) => {
      const keys = Object.keys(input);
      const { card, target, guess } = input;
      if (!keys.every((key) => ['type', 'card', 'target', 'guess'].includes(key)) || !isCardValue(card) ||
        (target !== undefined && (typeof target !== 'string' || target.length > 64)) || (guess !== undefined && !isCardValue(guess))) {
        return invalid('Choose a card to play.');
      }
      return valid({
        type: 'play', card, ...(target === undefined ? {} : { target }), ...(guess === undefined ? {} : { guess }),
      });
    },
    chancellor: (input) => {
      const { keep, bottom } = input;
      return hasExactKeys(input, ['type', 'keep', 'bottom']) && isCardValue(keep) && Array.isArray(bottom) &&
        bottom.length >= 1 && bottom.length <= 2 && bottom.every(isCardValue)
        ? valid({ type: 'chancellor', keep, bottom: [...bottom] }) : invalid('Keep one card and return the rest.');
    },
  }),
  actions: { play: act, chancellor: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onPlayerRemoved: (game) => {
    game.state.remove(game.playerId);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

export const loveLetterDefinition = defineGame(game);
