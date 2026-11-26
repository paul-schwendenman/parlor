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
import { bootyDiceDefinition } from '../definition.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupBootyDiceSocketHandlers(io: AppServer): void {
  const callbacks = bootyDiceDefinition.createLobbyCallbacks(roomManager, io);
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks, { defaultMaxPlayers: bootyDiceDefinition.meta.maxPlayers });
    socket.on('game:action', (action, ack) => {
      void dispatchGameAction({
        io,
        socket,
        roomManager,
        definition: bootyDiceDefinition,
        action,
        ack,
        onRoomFailure: (roomCode) => returnRoomToLobby(io, roomManager, roomCode, callbacks),
      });
    });
  });
}
