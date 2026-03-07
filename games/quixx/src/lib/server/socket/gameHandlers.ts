import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { RoomManager } from '@parlor/multiplayer';
import type { QuixxAction } from '../../types/game.js';
import type { QuixxEngine } from '../game/QuixxEngine.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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
      }
    }, config.turnTimer * 1000),
  );
}

export function cleanupRoomTimers(roomCode: string): void {
  clearRoomTimer(roomCode);
}

export function setupGameHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
): void {
  socket.on('game:action', (rawAction) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const engine = roomManager.getGameData<QuixxEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as QuixxAction;

    try {
      switch (action.type) {
        case 'roll-dice': {
          const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
          if (activePlayer.id !== socket.id) return;
          engine.rollDice();
          broadcastViews(io, roomCode, engine, roomManager);
          startPhase1Timer(io, roomCode, engine, roomManager);
          break;
        }

        case 'phase1-mark':
        case 'phase1-pass': {
          engine.submitPhase1(socket.id, action);
          broadcastViews(io, roomCode, engine, roomManager);

          if (engine.allPhase1Submitted()) {
            clearRoomTimer(roomCode);
            engine.resolvePhase1();
            broadcastViews(io, roomCode, engine, roomManager);

            if (!engine.isGameOver()) {
              startPhase2Timer(io, roomCode, engine, roomManager);
            }
          }
          break;
        }

        case 'phase2-mark':
        case 'phase2-pass': {
          clearRoomTimer(roomCode);
          engine.submitPhase2(socket.id, action);

          if (engine.isGameOver()) {
            broadcastViews(io, roomCode, engine, roomManager);
          } else {
            engine.advanceTurn();
            broadcastViews(io, roomCode, engine, roomManager);

            // Auto-roll after turn advance
            if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
              autoRollIfNeeded(io, roomCode, engine, roomManager);
            }
          }
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', message);
    }
  });
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
  const players = roomManager.getPlayersInRoom(roomCode);
  for (const player of players) {
    const view = engine.getPlayerView(player.id);
    io.to(player.id).emit('game:state', view as never);
  }

  const spectators = roomManager.getSpectatorsInRoom(roomCode);
  if (spectators.length > 0) {
    const spectatorView = engine.getSpectatorView();
    for (const spectatorId of spectators) {
      io.to(spectatorId).emit('game:state', spectatorView as never);
    }
  }
}
