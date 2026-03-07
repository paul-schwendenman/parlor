import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';

export interface GameServerOptions {
  httpServer: HttpServer;
  maxPlayersPerRoom?: number;
  corsOrigin?: string | string[];
  callbacks?: LobbyCallbacks;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function createGameServer(options: GameServerOptions) {
  const { httpServer, corsOrigin = '*', callbacks } = options;

  const io: AppServer = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: { origin: corsOrigin },
    },
  );

  const roomManager = new RoomManager();

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);
  });

  return { io, roomManager };
}
