import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import {
  RoomManager,
  dispatchGameAction,
  returnRoomToLobby,
  setupLobbyHandlers,
} from '@parlor/multiplayer';
import { crazyEightsDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupCrazyEightsSocketHandlers(io: AppServer): void {
  const callbacks = crazyEightsDefinition.createLobbyCallbacks(roomManager, io);

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks, { defaultGame: crazyEightsDefinition.meta });

    socket.on('game:action', (action, ack) => {
      void dispatchGameAction({
        io,
        socket,
        roomManager,
        definition: crazyEightsDefinition,
        action,
        ack,
        onRoomFailure: (roomCode) => returnRoomToLobby(io, roomManager, roomCode, callbacks),
      });
    });
  });
}
