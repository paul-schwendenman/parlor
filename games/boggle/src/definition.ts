import {
  defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { BoggleEngine } from './engine.js';
import { boggleMeta } from './meta.js';
import type { BoggleAction } from './types.js';

const STEP = 'boggle-step';

function drive(game: GameContext<BoggleEngine>) {
  const { state, instance } = game;
  instance.cancel(STEP);
  if (state.gameOver) return;
  instance.schedule(() => {
    state.advance();
    game.broadcast();
    drive(game);
  }, Math.max(1, state.deadline - Date.now()), STEP);
}

function act(game: PlayerContext<BoggleEngine>, action: BoggleAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

const round = (value: unknown): value is number => isIntInRange(value, 1, 20);
const word = (value: unknown): value is string => typeof value === 'string' && /^[a-z]{1,16}$/i.test(value.trim());

const game: TypedGameDefinition<'boggle', BoggleEngine> = {
  meta: boggleMeta,
  createState: (_room, players) => new BoggleEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<BoggleAction>(action, {
    submit: (input) => hasExactKeys(input, ['type', 'round', 'word']) && round(input.round) && word(input.word)
      ? valid({ type: 'submit', round: input.round, word: input.word }) : invalid('Type a word using letters only.'),
    remove: (input) => hasExactKeys(input, ['type', 'round', 'word']) && round(input.round) && word(input.word)
      ? valid({ type: 'remove', round: input.round, word: input.word }) : invalid('Choose a word.'),
    done: (input) => hasExactKeys(input, ['type', 'round', 'done']) && round(input.round) && typeof input.done === 'boolean'
      ? valid({ type: 'done', round: input.round, done: input.done }) : invalid('Invalid action.'),
  }),
  actions: { submit: act, remove: act, done: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => game.state.setConnected(game.playerId, false),
  onPlayerReconnect: (game) => game.state.setConnected(game.playerId, true),
  onPlayerRemoved: (game) => {
    game.state.remove(game.playerId);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

export const boggleDefinition = defineGame(game);
