import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { SushiGoEngine } from './engine.js';
import { sushiGoMeta } from './meta.js';
import { DECK_SIZE } from './rules.js';
import type { SushiGoAction } from './types.js';

const drive = createTurnDriver<SushiGoEngine>('sushi-go-step', 600, (state) => state.revealing ? state.revealDelay : undefined);

function act(game: PlayerContext<SushiGoEngine>, action: SushiGoAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<SushiGoEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'sushi-go', SushiGoEngine> = {
  meta: sushiGoMeta,
  createState: (_room, players) => new SushiGoEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<SushiGoAction>(action, {
    pick: (input) => {
      const { cardIds } = input;
      return hasExactKeys(input, ['type', 'cardIds']) && Array.isArray(cardIds) && cardIds.length >= 1 && cardIds.length <= 2 &&
        cardIds.every((id) => isIntInRange(id, 0, DECK_SIZE - 1)) && new Set(cardIds).size === cardIds.length
        ? valid({ type: 'pick', cardIds: [...cardIds] as number[] }) : invalid('Choose one card, or two with chopsticks.');
    },
    unpick: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'unpick' }) : invalid('Invalid change.'),
  }),
  actions: { pick: act, unpick: act },
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

export const sushiGoDefinition = defineGame(game);
