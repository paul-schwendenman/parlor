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
          break;
        }

        case 'phase1-mark':
        case 'phase1-pass': {
          engine.submitPhase1(socket.id, action);
          // Broadcast updated submission status
          broadcastViews(io, roomCode, engine, roomManager);

          if (engine.allPhase1Submitted()) {
            engine.resolvePhase1();
            broadcastViews(io, roomCode, engine, roomManager);
          }
          break;
        }

        case 'phase2-mark':
        case 'phase2-pass': {
          const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
          if (activePlayer.id !== socket.id) return;
          engine.submitPhase2(action);

          if (engine.isGameOver()) {
            broadcastViews(io, roomCode, engine, roomManager);
          } else {
            engine.advanceTurn();
            broadcastViews(io, roomCode, engine, roomManager);

            // Auto-roll after turn advance
            if (engine.getPhase() === 'rolling') {
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
  // Auto-roll after a brief delay
  setTimeout(() => {
    if (engine.getPhase() === 'rolling' && !engine.isGameOver()) {
      try {
        engine.rollDice();
        broadcastViews(io, roomCode, engine, roomManager);
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
}
