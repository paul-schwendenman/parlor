import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, isOneOf, RoomManager, scheduleGameDeadline, typeOnly, valid,
  validateByType, type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CoupEngine } from './engine.js';
import { coupMeta } from './meta.js';
import { ACTIONS, CHARACTERS, TARGETED } from './rules.js';
import type { CoupActionMsg } from './types.js';

const driveTurn = createTurnDriver<CoupEngine>('coup-step', 1100, (state) => state.revealing ? 1800 : undefined, scheduleWindow);

function scheduleWindow(game: GameContext<CoupEngine>) {
  scheduleGameDeadline(game, 'coup-window', driveTurn);
}

function drive(game: GameContext<CoupEngine>) {
  scheduleWindow(game);
  driveTurn(game);
}

function act(game: PlayerContext<CoupEngine>, action: CoupActionMsg) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<CoupEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const windowId = (value: unknown): value is number => isIntInRange(value, 0, 1e9);

const game: TypedGameDefinition<'coup', CoupEngine> = {
  meta: coupMeta,
  createState: (_room, players) => new CoupEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<CoupActionMsg>(action, {
    declare: (input) => {
      const { action: choice, targetId } = input;
      if (!isOneOf(choice, ACTIONS)) return invalid('Choose an action.');
      if (TARGETED.includes(choice)) {
        return hasExactKeys(input, ['type', 'action', 'targetId']) && typeof targetId === 'string' && targetId.length > 0 && targetId.length <= 64
          ? valid({ type: 'declare', action: choice, targetId }) : invalid('Choose a player.');
      }
      return hasExactKeys(input, ['type', 'action']) ? valid({ type: 'declare', action: choice }) : invalid('Choose an action.');
    },
    challenge: (input) => hasExactKeys(input, ['type', 'windowId']) && windowId(input.windowId)
      ? valid({ type: 'challenge', windowId: input.windowId }) : invalid('Invalid challenge.'),
    pass: (input) => hasExactKeys(input, ['type', 'windowId']) && windowId(input.windowId)
      ? valid({ type: 'pass', windowId: input.windowId }) : invalid('Invalid pass.'),
    block: (input) => hasExactKeys(input, ['type', 'windowId', 'character']) && windowId(input.windowId) && isOneOf(input.character, CHARACTERS)
      ? valid({ type: 'block', windowId: input.windowId, character: input.character }) : invalid('Invalid block.'),
    prove: typeOnly<CoupActionMsg>('prove'),
    expose: (input) => hasExactKeys(input, ['type', 'index']) && isIntInRange(input.index, 0, 1)
      ? valid({ type: 'expose', index: input.index }) : invalid('Choose a card.'),
    keep: (input) => {
      const { indices } = input;
      return hasExactKeys(input, ['type', 'indices']) && Array.isArray(indices) && indices.length >= 1 && indices.length <= 2 &&
        indices.every((index) => isIntInRange(index, 0, 3)) && new Set(indices).size === indices.length
        ? valid({ type: 'keep', indices: [...indices] as number[] }) : invalid('Choose the cards to keep.');
    },
  }),
  actions: { declare: act, challenge: act, pass: act, block: act, prove: act, expose: act, keep: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onPlayerRemoved: (game) => {
    game.state.removePlayer(game.playerId);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

export const coupDefinition = defineGame(game);
