import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { crazyEightsDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupCrazyEightsSocketHandlers(io: AppServer): void {
  const callbacks = crazyEightsDefinition.createLobbyCallbacks(roomManager, io);

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);

    socket.on('game:action', (action) => {
      crazyEightsDefinition.handleGameAction(io, socket, roomManager, action);
    });
  });
}
