import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { kingsCornerDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupKingsCornerSocketHandlers(io: AppServer): void {
  const callbacks = kingsCornerDefinition.createLobbyCallbacks(roomManager, io);

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);

    socket.on('game:action', (action) => {
      kingsCornerDefinition.handleGameAction(io, socket, roomManager, action);
    });
  });
}
