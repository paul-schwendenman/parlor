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
import { scheduleBotActions, clearBotTimers } from './game/botController.js';
import { validateQuixxAction } from './validateAction.js';

// Per-room timer handles
const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRoomTimer(roomCode: string): void {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomCode);
  }
}

function startPhase1Timer(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const config = engine.getConfig();
  if (!config.phase1Timer) return;

  clearRoomTimer(roomCode);
  roomTimers.set(
    roomCode,
    setTimeout(() => {
      roomTimers.delete(roomCode);
      if (engine.getPhase() !== 'phase1' || engine.isGameOver()) return;

      // Auto-pass all players who haven't submitted
      for (const player of engine.getPlayers()) {
        if (player.phase1Decision === null) {
          try {
            engine.submitPhase1(player.id, { type: 'phase1-pass' });
          } catch {
            // Already submitted
          }
        }
      }

      if (engine.allPhase1Submitted()) {
        engine.resolvePhase1();
        broadcastViews(io, roomCode, engine, roomManager);
        if (!engine.isGameOver()) {
          startPhase2Timer(io, roomCode, engine, roomManager);
          scheduleBotActions(io, roomCode, engine, roomManager);
        }
      }
    }, config.phase1Timer * 1000),
  );
}

function startPhase2Timer(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  const config = engine.getConfig();
  if (!config.turnTimer) return;

  clearRoomTimer(roomCode);
  roomTimers.set(
    roomCode,
    setTimeout(() => {
      roomTimers.delete(roomCode);
      if (engine.getPhase() !== 'phase2' || engine.isGameOver()) return;

      const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
      try {
        engine.submitPhase2(activePlayer.id, { type: 'phase2-pass' });
      } catch {
        return;
      }

      if (engine.isGameOver()) {
        broadcastViews(io, roomCode, engine, roomManager);
      } else {
        engine.advanceTurn();
        broadcastViews(io, roomCode, engine, roomManager);

        if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
          autoRollIfNeeded(io, roomCode, engine, roomManager);
        }
        scheduleBotActions(io, roomCode, engine, roomManager);
      }
    }, config.turnTimer * 1000),
  );
}

function autoRollIfNeeded(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  setTimeout(() => {
    if (engine.getPhase() === 'rolling' && !engine.isGameOver()) {
      try {
        engine.rollDice();
        broadcastViews(io, roomCode, engine, roomManager);
        startPhase1Timer(io, roomCode, engine, roomManager);
        scheduleBotActions(io, roomCode, engine, roomManager);
      } catch {
        // Ignore if phase changed
      }
    }
  }, 500);
}

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: QuixxEngine,
  roomManager: RoomManager,
): void {
  if (roomManager.getGameData(roomCode) !== engine) return;
  if (engine.isGameOver()) roomManager.finishGame(roomCode, engine);

  const players = roomManager.getGamePlayers(roomCode);
  for (const player of players) {
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
}

export function cleanupRoomTimers(roomCode: string): void {
  clearRoomTimer(roomCode);
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

      // Send initial views to each player (skip bots)
      for (const player of players) {
        if (RoomManager.isBotPlayer(player.id)) continue;
        const view = engine.getPlayerView(player.id);
        io.to(player.id).emit('game:state', view as never);
      }

      // Send initial view to spectators
      const spectators = roomManager.getGameSpectators(roomCode);
      if (spectators.length > 0) {
        const spectatorView = engine.getSpectatorView();
        for (const spectatorId of spectators) {
          io.to(spectatorId).emit('game:state', spectatorView as never);
        }
      }

      // Auto-roll if configured
      if (DEFAULT_CONFIG.diceRolling === 'auto') {
        setTimeout(() => {
          if (engine.getPhase() === 'rolling') {
            try {
              engine.rollDice();
              broadcastViews(io, roomCode, engine, roomManager);
            } catch {
              // Ignore
            }
          }
          scheduleBotActions(io, roomCode, engine, roomManager);
        }, 500);
      } else {
        scheduleBotActions(io, roomCode, engine, roomManager);
      }
    },

    onGameReset: (roomCode) => {
      cleanupRoomTimers(roomCode);
      clearBotTimers(roomCode);
      roomManager.setGameData(roomCode, null);
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
      io.to(playerId).emit('game:state', view as never);
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
        scheduleBotActions(io, roomCode, engine, roomManager);
        break;
      }

      case 'phase1-mark':
      case 'phase1-pass': {
        engine.submitPhase1(socket.data.playerId, action);
        broadcastViews(io, roomCode, engine, roomManager);

        if (engine.allPhase1Submitted()) {
          clearRoomTimer(roomCode);
          engine.resolvePhase1();
          broadcastViews(io, roomCode, engine, roomManager);

          if (!engine.isGameOver()) {
            startPhase2Timer(io, roomCode, engine, roomManager);
            scheduleBotActions(io, roomCode, engine, roomManager);
          }
        } else {
          scheduleBotActions(io, roomCode, engine, roomManager);
        }
        break;
      }

      case 'phase2-mark':
      case 'phase2-pass': {
        // submitPhase2 validates phase + active player before mutating; only a
        // successful submit may cancel the turn timer (CORE-AUDIT A-12).
        engine.submitPhase2(socket.data.playerId, action);
        clearRoomTimer(roomCode);

        if (engine.isGameOver()) {
          broadcastViews(io, roomCode, engine, roomManager);
        } else {
          engine.advanceTurn();
          broadcastViews(io, roomCode, engine, roomManager);

          // Auto-roll after turn advance
          if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
            autoRollIfNeeded(io, roomCode, engine, roomManager);
          }
          scheduleBotActions(io, roomCode, engine, roomManager);
        }
        break;
      }

      default:
        throw new GameRuleError('Unknown action', 'INVALID_ACTION');
    }
  },
};
