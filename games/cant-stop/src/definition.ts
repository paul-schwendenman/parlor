import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CantStopEngine } from './engine.js';
import { cantStopMeta } from './meta.js';
import { isColumn, type Move } from './rules.js';
import type { CantStopAction } from './types.js';

const drive = createTurnDriver<CantStopEngine>('cant-stop-step', 700, (state) => state.revealing ? 2000 : undefined);

function act(game: PlayerContext<CantStopEngine>, action: CantStopAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<CantStopEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const game: TypedGameDefinition<'cant-stop', CantStopEngine> = {
  meta: cantStopMeta,
  createState: (_room, players) => new CantStopEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<CantStopAction>(action, {
    roll: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'roll' }) : invalid('Invalid roll.'),
    stop: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'stop' }) : invalid('Invalid stop.'),
    place: (input) => {
      const { columns } = input;
      if (!hasExactKeys(input, ['type', 'columns']) || !Array.isArray(columns) || columns.length < 1 ||
        columns.length > 2 || !columns.every(isColumn) || (columns.length === 2 && columns[0] > columns[1])) {
        return invalid('Choose a move.');
      }
      return valid({ type: 'place', columns: [...columns] as Move });
    },
  }),
  actions: { roll: act, place: act, stop: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const cantStopDefinition = defineGame(game);
