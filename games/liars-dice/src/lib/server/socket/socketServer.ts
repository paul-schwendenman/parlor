import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { liarsDiceDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupLiarsDiceSocketHandlers(io: AppServer): void {
  const callbacks = liarsDiceDefinition.createLobbyCallbacks(roomManager, io);
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);
    socket.on('game:action', (action) => {
      liarsDiceDefinition.handleGameAction(io, socket, roomManager, action);
    });
  });
}
