import {
  createTurnDriver, defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, scheduleGameDeadline, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { SignalRelayEngine } from './engine.js';
import { levels, signalCount } from './rules.js';
import { signalRelayMeta } from './meta.js';
import type { RelayAction } from './types.js';

const deadlineKey = 'signal-relay-deadline';
const driveTurn = createTurnDriver<SignalRelayEngine>('signal-relay-step', 525, (state) => state.revealing ? 2000 : undefined,
  (game) => scheduleDeadline(game));

function scheduleDeadline(game: GameContext<SignalRelayEngine>) {
  scheduleGameDeadline(game, deadlineKey, driveTurn);
}

function drive(game: GameContext<SignalRelayEngine>) {
  scheduleDeadline(game);
  driveTurn(game);
}

function act(game: PlayerContext<SignalRelayEngine>, action: RelayAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function connected(game: PlayerContext<SignalRelayEngine>, value: boolean) {
  game.state.setConnected(game.playerId, value);
  drive(game);
}

function validate(type: RelayAction['type']) {
  return (input: Record<string, unknown>) => {
    const { level, signal, antenna, version } = input;
    return hasExactKeys(input, ['type', 'level', 'signal', 'antenna', 'version']) &&
      isIntInRange(level, 1, levels) && isIntInRange(signal, 0, signalCount - 1) &&
      (antenna === 0 || antenna === 1) && isIntInRange(version, 0, signalCount)
      ? valid<RelayAction>({ type, level, signal, antenna, version }) : invalid('Choose a signal and antenna.');
  };
}

const game: TypedGameDefinition<'signal-relay', SignalRelayEngine> = {
  meta: signalRelayMeta,
  createState: (_room, players) => new SignalRelayEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<RelayAction>(action, { send: validate('send'), reroute: validate('reroute') }),
  actions: { send: act, reroute: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: (game) => connected(game, false),
  onPlayerRemoved: (game) => connected(game, false),
  onPlayerReconnect: (game) => connected(game, true),
  onRoomDestroyed: () => undefined,
};

export const signalRelayDefinition = defineGame(game);
