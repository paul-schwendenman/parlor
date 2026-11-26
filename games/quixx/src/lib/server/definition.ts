import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GameMeta,
} from '@parlor/game-types';
import {
  GameRuleError,
  RoomManager,
  type ServerGameDefinition,
  type AppServer,
} from '@parlor/multiplayer';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
import type { QuixxAction } from '../types/game.js';
import { QuixxEngine } from './game/QuixxEngine.js';
import { DEFAULT_CONFIG } from '../types/game.js';
import { scheduleBotActions } from './game/botController.js';
import { validateQuixxAction } from './validateAction.js';

const PHASE_TIMER = 'phase';
const AUTO_ROLL = 'auto-roll';

function scheduleBots(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine) return;
  scheduleBotActions(instance, engine, () => broadcastViews(io, roomCode, engine, roomManager));
}

function startPhase1Timer(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const { phase1Timer } = engine.getConfig();
  if (!phase1Timer) return;

  roomManager.getGameInstance(roomCode)?.schedule(() => {
    if (engine.getPhase() !== 'phase1' || engine.isGameOver()) return;

    for (const player of engine.getPlayers()) {
      if (player.phase1Decision === null) {
        engine.submitPhase1(player.id, { type: 'phase1-pass' });
      }
    }

    if (engine.allPhase1Submitted()) {
      engine.resolvePhase1();
      broadcastViews(io, roomCode, engine, roomManager);
      if (!engine.isGameOver()) {
        startPhase2Timer(io, roomCode, engine, roomManager);
        scheduleBots(io, roomCode, engine, roomManager);
      }
    }
  }, phase1Timer * 1000, PHASE_TIMER);
}

function startPhase2Timer(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const { turnTimer } = engine.getConfig();
  if (!turnTimer) return;

  roomManager.getGameInstance(roomCode)?.schedule(() => {
    if (engine.getPhase() !== 'phase2' || engine.isGameOver()) return;

    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    engine.submitPhase2(activePlayer.id, { type: 'phase2-pass' });
    if (engine.isGameOver()) {
      broadcastViews(io, roomCode, engine, roomManager);
      return;
    }

    engine.advanceTurn();
    broadcastViews(io, roomCode, engine, roomManager);
    if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
      autoRollIfNeeded(io, roomCode, engine, roomManager);
    }
    scheduleBots(io, roomCode, engine, roomManager);
  }, turnTimer * 1000, PHASE_TIMER);
}

function autoRollIfNeeded(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  roomManager.getGameInstance(roomCode)?.schedule(() => {
    if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;

    engine.rollDice();
    broadcastViews(io, roomCode, engine, roomManager);
    startPhase1Timer(io, roomCode, engine, roomManager);
    scheduleBots(io, roomCode, engine, roomManager);
  }, 500, AUTO_ROLL);
}

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  if (roomManager.getGameData(roomCode) !== engine) return;
  roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
    if (engine.isGameOver()) roomManager.finishGame(roomCode, engine);

    for (const player of roomManager.getGamePlayers(roomCode)) {
      if (RoomManager.isBotPlayer(player.id)) continue;
      const view = engine.getPlayerView(player.id);
      io.to(player.id).emit('game:state', view as never);
    }

    const spectators = roomManager.getGameSpectators(roomCode);
    if (spectators.length > 0) {
      const spectatorView = engine.getSpectatorView();
      for (const spectatorId of spectators) {
        io.to(spectatorId).emit('game:state', spectatorView as never);
      }
    }
  });
}

const meta: GameMeta = {
  id: 'quixx',
  name: 'Quixx',
  description: 'A fast-paced dice game of marking numbers and strategic choices',
  minPlayers: 2,
  maxPlayers: 5,
  estimatedMinutes: '15-20',
  tags: ['dice', 'strategy', 'quick'],
  displayModes: ['peer'],
  supportsBots: true,
};

export const quixxDefinition: ServerGameDefinition = {
  meta,

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players, io) => {
      const engine = new QuixxEngine(
        players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
        roomCode,
        DEFAULT_CONFIG,
      );
      roomManager.setGameData(roomCode, engine);

      broadcastViews(io, roomCode, engine, roomManager);
      if (engine.shouldAutoRoll()) {
        autoRollIfNeeded(io, roomCode, engine, roomManager);
      } else {
        scheduleBots(io, roomCode, engine, roomManager);
      }
    },

    onPlayerDisconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<QuixxEngine>(roomCode);
      if (!engine) return;

      // Auto-pass for disconnected player in phase1
      if (engine.getPhase() === 'phase1') {
        try {
          engine.submitPhase1(playerId, { type: 'phase1-pass' });
          if (engine.allPhase1Submitted()) {
            engine.resolvePhase1();
          }
        } catch {
          // Already submitted
        }
      }

      // If active player disconnected during phase2, auto-pass
      const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
      if (activePlayer.id === playerId && engine.getPhase() === 'phase2') {
        try {
          engine.submitPhase2(playerId, { type: 'phase2-pass' });
          if (!engine.isGameOver()) {
            engine.advanceTurn();
          }
        } catch {
          // Ignore
        }
      }

      // Broadcast updated state
      broadcastViews(io, roomCode, engine, roomManager);
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<QuixxEngine>(roomCode);
      if (!engine) return;

      const view = roomManager.isGameParticipant(roomCode, playerId)
        ? engine.getPlayerView(playerId)
        : engine.getSpectatorView();
      roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
        io.to(playerId).emit('game:state', view as never);
      });
    },
  }),

  validateAction: validateQuixxAction,

  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    rawAction: Record<string, unknown>,
  ) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const engine = roomManager.getGameData<QuixxEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as QuixxAction;

    switch (action.type) {
      case 'roll-dice': {
        const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
        if (activePlayer.id !== socket.data.playerId) {
          throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
        }
        engine.rollDice();
        broadcastViews(io, roomCode, engine, roomManager);
        startPhase1Timer(io, roomCode, engine, roomManager);
        scheduleBots(io, roomCode, engine, roomManager);
        break;
      }

      case 'phase1-mark':
      case 'phase1-pass': {
        engine.submitPhase1(socket.data.playerId, action);
        broadcastViews(io, roomCode, engine, roomManager);

        if (engine.allPhase1Submitted()) {
          roomManager.getGameInstance(roomCode)?.cancel(PHASE_TIMER);
          engine.resolvePhase1();
          broadcastViews(io, roomCode, engine, roomManager);

          if (!engine.isGameOver()) {
            startPhase2Timer(io, roomCode, engine, roomManager);
            scheduleBots(io, roomCode, engine, roomManager);
          }
        } else {
          scheduleBots(io, roomCode, engine, roomManager);
        }
        break;
      }

      case 'phase2-mark':
      case 'phase2-pass': {
        // submitPhase2 validates phase + active player before mutating; only a
        // successful submit may cancel the turn timer (CORE-AUDIT A-12).
        engine.submitPhase2(socket.data.playerId, action);
        roomManager.getGameInstance(roomCode)?.cancel(PHASE_TIMER);

        if (engine.isGameOver()) {
          broadcastViews(io, roomCode, engine, roomManager);
        } else {
          engine.advanceTurn();
          broadcastViews(io, roomCode, engine, roomManager);

          // Auto-roll after turn advance
          if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
            autoRollIfNeeded(io, roomCode, engine, roomManager);
          }
          scheduleBots(io, roomCode, engine, roomManager);
        }
        break;
      }

      default:
        throw new GameRuleError('Unknown action', 'INVALID_ACTION');
    }
  },
};
