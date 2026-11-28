import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { HarborDiceEngine } from './engine.js';
import { harborDiceMeta } from './meta.js';
import { categories, DICE_COUNT } from './rules.js';
import type { HarborAction } from './types.js';

const drive = createTurnDriver<HarborDiceEngine>('harbor-dice-step', 650, (state) => state.revealing ? 1200 : undefined);

function act(game: PlayerContext<HarborDiceEngine>, action: HarborAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<HarborDiceEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'harbor-dice', HarborDiceEngine> = {
  meta: harborDiceMeta,
  createState: (_room, players) => new HarborDiceEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<HarborAction>(action, {
    roll: (input) => {
      const held = input.held;
      return hasExactKeys(input, ['type', 'held']) && Array.isArray(held) && held.length < DICE_COUNT &&
        new Set(held).size === held.length && Array.from(held).every((index: unknown) =>
          typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < DICE_COUNT)
        ? valid({ type: 'roll', held }) : invalid('Choose up to four different dice to hold.');
    },
    score: (input) => {
      const category = categories.find(({ id }) => id === input.category)?.id;
      return category && hasExactKeys(input, ['type', 'category'])
        ? valid({ type: 'score', category }) : invalid('Choose a scorecard category.');
    },
  }),
  actions: { roll: act, score: act },
  getPlayerView: (state) => state.view(),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const harborDiceDefinition = defineGame(game);
