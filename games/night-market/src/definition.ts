import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { NightMarketEngine } from './engine.js';
import { nightMarketMeta } from './meta.js';
import { picksPerSeason, seasons } from './rules.js';
import type { MarketAction } from './types.js';

const drive = createTurnDriver<NightMarketEngine>('night-market-step', 550, (state) =>
  state.seasonEnd ? 4500 : state.revealing ? 1700 : undefined);

function connected(game: PlayerContext<NightMarketEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'night-market', NightMarketEngine> = {
  meta: nightMarketMeta,
  createState: (_room, players) => new NightMarketEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<MarketAction>(action, {
    pick: (input) => {
      const { tileId, use, season, pickNumber } = input;
      return hasExactKeys(input, ['type', 'tileId', 'use', 'season', 'pickNumber']) && isIntInRange(tileId, 0, 34) &&
        isIntInRange(season, 1, seasons) && isIntInRange(pickNumber, 1, picksPerSeason) &&
        (use === 'sell' || use === 'display') ? valid({ type: 'pick', tileId, use, season, pickNumber }) : invalid('Choose a good and how to use it.');
    },
  }),
  actions: {
    pick(game, action) {
      game.state.act(game.playerId, action);
      drive(game);
    },
  },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const nightMarketDefinition = defineGame(game);
