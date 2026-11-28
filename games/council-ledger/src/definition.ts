import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, scheduleGameDeadline, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CouncilLedgerEngine } from './engine.js';
import { councilLedgerMeta } from './meta.js';
import { maxRounds, permitIds } from './rules.js';
import type { CouncilAction } from './types.js';

const driveTurn = createTurnDriver<CouncilLedgerEngine>('council-step', 700,
  (state) => state.revealing ? 2400 : undefined, scheduleDeadline);

function scheduleDeadline(game: GameContext<CouncilLedgerEngine>) {
  scheduleGameDeadline(game, 'council-deadline', driveTurn);
}

function drive(game: GameContext<CouncilLedgerEngine>) {
  scheduleDeadline(game);
  driveTurn(game);
}

function act(game: PlayerContext<CouncilLedgerEngine>, action: CouncilAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<CouncilLedgerEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

const validTurn = (value: unknown): value is number => isIntInRange(value, 1, maxRounds * councilLedgerMeta.maxPlayers);

const game: TypedGameDefinition<'council-ledger', CouncilLedgerEngine> = {
  meta: councilLedgerMeta,
  createState: (_room, players) => new CouncilLedgerEngine(players.map(({ id, name }) =>
    ({ id, name, bot: RoomManager.isBotPlayer(id) }))),
  validateAction: (action) => validateByType<CouncilAction>(action, {
    service: (input) => hasExactKeys(input, ['type', 'turn']) && validTurn(input.turn)
      ? valid({ type: 'service', turn: input.turn }) : invalid('Choose a council action.'),
    claim: (input) => {
      const permit = permitIds.find((id) => id === input.permit);
      return permit && hasExactKeys(input, ['type', 'turn', 'permit']) && validTurn(input.turn)
        ? valid({ type: 'claim', turn: input.turn, permit }) : invalid('Choose a permit.');
    },
    respond: (input) => hasExactKeys(input, ['type', 'turn', 'challenge']) && validTurn(input.turn) && typeof input.challenge === 'boolean'
      ? valid({ type: 'respond', turn: input.turn, challenge: input.challenge }) : invalid('Choose whether to challenge.'),
  }),
  actions: { service: act, claim: act, respond: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const councilLedgerDefinition = defineGame(game);
