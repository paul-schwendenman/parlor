import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager } from '@parlor/multiplayer';
import type { CrazyEightsAction } from '../../types/game.js';
import type { CrazyEightsEngine } from '../game/CrazyEightsEngine.js';
import { broadcastViews } from './socketServer.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRoomTimer(roomCode: string): void {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomCode);
  }
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

    const engine = roomManager.getGameData<CrazyEightsEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as CrazyEightsAction;

    try {
      switch (action.type) {
        case 'play-card': {
          engine.playCard(socket.id, action.card);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'draw-card': {
          engine.drawCard(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'pass': {
          engine.pass(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'choose-suit': {
          engine.chooseSuit(socket.id, action.suit);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', message);
    }
  });
}
