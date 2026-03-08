import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GameMeta,
} from '@parlor/game-types';
import type { RoomManager } from './RoomManager.js';
import type { LobbyCallbacks } from './lobbyHandlers.js';

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface ServerGameDefinition {
  meta: GameMeta;
  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => LobbyCallbacks;
  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    action: Record<string, unknown>,
  ) => void;
}
