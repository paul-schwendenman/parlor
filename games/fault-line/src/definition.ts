import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { FaultLineEngine } from './engine.js';
import { cacheSupply, maxBounty } from './rules.js';
import { faultLineMeta } from './meta.js';
import type { FaultAction } from './types.js';

const drive = createTurnDriver<FaultLineEngine>('fault-line-step', 550, (state) => state.revealing ? 3300 : undefined);

function act(game: PlayerContext<FaultLineEngine>, action: FaultAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<FaultLineEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'fault-line', FaultLineEngine> = {
  meta: faultLineMeta,
  createState: (_room, players) => new FaultLineEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<FaultAction>(action, {
    plant: (input) => {
      const { cache, bounty, round } = input;
      return hasExactKeys(input, ['type', 'round', 'cache', 'bounty']) &&
        isIntInRange(round, 1, cacheSupply.length) && isIntInRange(bounty, 0, maxBounty) &&
        (cache === 0 || cache === 1 || cache === 2)
        ? valid<FaultAction>({ type: 'plant', cache, bounty, round }) : invalid('Choose a cache and bounty.');
    },
    open: (input) => {
      const { target, round } = input;
      return hasExactKeys(input, ['type', 'round', 'target']) && isIntInRange(round, 1, cacheSupply.length) &&
        (target === null || typeof target === 'string')
        ? valid({ type: 'open', target, round }) : invalid('Choose a rival cache or pass.');
    },
  }),
  actions: { plant: act, open: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const faultLineDefinition = defineGame(game);
