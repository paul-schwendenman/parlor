import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { YahtzeeEngine } from './engine.js';
import { yahtzeeMeta } from './meta.js';
import { DICE_COUNT, isCategory } from './rules.js';
import type { YahtzeeAction } from './types.js';

const drive = createTurnDriver<YahtzeeEngine>('yahtzee-step', 700, (state) => state.revealing ? state.revealDelay : undefined);

function act(game: PlayerContext<YahtzeeEngine>, action: YahtzeeAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<YahtzeeEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'yahtzee', YahtzeeEngine> = {
  meta: yahtzeeMeta,
  createState: (_room, players) => new YahtzeeEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<YahtzeeAction>(action, {
    roll: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'roll' }) : invalid('Invalid roll.'),
    hold: (input) => {
      const { held } = input;
      return hasExactKeys(input, ['type', 'held']) && Array.isArray(held) && held.length === DICE_COUNT &&
        held.every((value) => typeof value === 'boolean')
        ? valid({ type: 'hold', held: [...held] as boolean[] }) : invalid('Choose which dice to hold.');
    },
    score: (input) => hasExactKeys(input, ['type', 'category']) && isCategory(input.category)
      ? valid({ type: 'score', category: input.category }) : invalid('Choose a box on your scorecard.'),
  }),
  actions: { roll: act, hold: act, score: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const yahtzeeDefinition = defineGame(game);
