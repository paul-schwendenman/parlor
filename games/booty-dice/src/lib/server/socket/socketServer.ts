import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { bootyDiceDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupBootyDiceSocketHandlers(io: AppServer): void {
  const callbacks = bootyDiceDefinition.createLobbyCallbacks(roomManager, io);
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);
    socket.on('game:action', (action) => {
      bootyDiceDefinition.handleGameAction(io, socket, roomManager, action);
    });
  });
}
