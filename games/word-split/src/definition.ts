import {
  defineGame, hasExactKeys, invalid, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { ROUNDS, WordSplitEngine } from './engine.js';
import { wordSplitMeta } from './meta.js';
import type { WordSplitAction } from './types.js';

const STEP = 'word-split-step';

function drive(game: GameContext<WordSplitEngine>) {
  const { state, instance } = game;
  instance.cancel(STEP);
  if (state.gameOver) return;
  instance.schedule(() => {
    state.advance();
    game.broadcast();
    drive(game);
  }, Math.max(1, state.deadline - Date.now()), STEP);
}

function parseRound(round: unknown): number | null {
  return typeof round === 'number' && Number.isInteger(round) && round >= 1 && round <= ROUNDS ? round : null;
}

function act(game: PlayerContext<WordSplitEngine>, action: WordSplitAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

const game: TypedGameDefinition<'word-split', WordSplitEngine> = {
  meta: wordSplitMeta,
  createState: (_room, players) => new WordSplitEngine(players.map(({ id, name }) => ({ id, name }))),
  validateAction: (action) => validateByType<WordSplitAction>(action, {
    submit: (input) => {
      const round = parseRound(input.round);
      return round && hasExactKeys(input, ['type', 'round', 'word']) && typeof input.word === 'string' &&
        /^[a-z]{3,8}$/i.test(input.word) ? valid({ type: 'submit', round, word: input.word })
        : invalid('Enter a word with 3 to 8 letters.');
    },
    finish: (input) => {
      const round = parseRound(input.round);
      return round && hasExactKeys(input, ['type', 'round']) ? valid({ type: 'finish', round }) : invalid('Invalid round.');
    },
  }),
  actions: { submit: act, finish: act },
  getPlayerView: (engine, id) => engine.view(id),
  getSpectatorView: (engine) => engine.view(),
  isGameOver: (engine) => engine.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => game.state.setConnected(game.playerId, false),
  onPlayerReconnect: (game) => game.state.setConnected(game.playerId, true),
  onPlayerRemoved: (game) => { game.state.remove(game.playerId); drive(game); },
  onRoomDestroyed: () => undefined,
};

export const wordSplitDefinition = defineGame(game);
