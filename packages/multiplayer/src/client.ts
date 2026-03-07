import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from '@parlor/game-types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface GameClientOptions {
  url: string;
}

export function createGameClient(options: GameClientOptions): GameSocket {
  const socket: GameSocket = io(options.url, {
    autoConnect: false,
  });

  return socket;
}

export function createRoom(socket: GameSocket, playerName: string): Promise<Room> {
  return new Promise((resolve) => {
    socket.emit('room:create', playerName, (room) => {
      resolve(room);
    });
  });
}

export function joinRoom(
  socket: GameSocket,
  code: string,
  playerName: string
): Promise<{ room: Room | null; error?: string }> {
  return new Promise((resolve) => {
    socket.emit('room:join', code, playerName, (room, error) => {
      resolve({ room, error });
    });
  });
}
