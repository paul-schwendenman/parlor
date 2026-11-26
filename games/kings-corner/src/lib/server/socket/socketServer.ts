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
  withGameStateEnvelope,
} from '@parlor/multiplayer';
import { kingsCornerDefinition as unwrappedDefinition } from '../definition.js';

// Not migrated to the typed contract yet (plan 3.1b): wrap its bare views in the
// `{ gameId, view }` envelope the client runtime expects.
const kingsCornerDefinition = withGameStateEnvelope(unwrappedDefinition);

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupKingsCornerSocketHandlers(io: AppServer): void {
  const callbacks = kingsCornerDefinition.createLobbyCallbacks(roomManager, io);

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks, { defaultGame: kingsCornerDefinition.meta });

    socket.on('game:action', (action, ack) => {
      void dispatchGameAction({
        io,
        socket,
        roomManager,
        definition: kingsCornerDefinition,
        action,
        ack,
        onRoomFailure: (roomCode) => returnRoomToLobby(io, roomManager, roomCode, callbacks),
      });
    });
  });
}
