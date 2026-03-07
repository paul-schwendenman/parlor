import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
  Player,
} from '@parlor/game-types';
import { generateRoomCode } from './utils.js';

export interface GameServerOptions {
  httpServer: HttpServer;
  maxPlayersPerRoom?: number;
  corsOrigin?: string | string[];
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function createGameServer(options: GameServerOptions) {
  const { httpServer, maxPlayersPerRoom = 8, corsOrigin = '*' } = options;

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: corsOrigin },
  });

  const rooms = new Map<string, Room>();
  const playerRooms = new Map<string, string>();

  function createRoom(host: Player): Room {
    const code = generateRoomCode();
    const room: Room = {
      id: crypto.randomUUID(),
      code,
      host: host.id,
      players: [host],
      maxPlayers: maxPlayersPerRoom,
      status: 'waiting',
    };
    rooms.set(code, room);
    return room;
  }

  function findRoom(code: string): Room | undefined {
    return rooms.get(code.toUpperCase());
  }

  function removePlayerFromRoom(socketId: string) {
    const code = playerRooms.get(socketId);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socketId);
    playerRooms.delete(socketId);

    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      if (room.host === socketId) {
        room.host = room.players[0].id;
      }
      io.to(code).emit('room:updated', room);
      io.to(code).emit('player:left', socketId);
    }
  }

  io.on('connection', (socket: GameSocket) => {
    socket.on('room:create', (playerName, callback) => {
      const player: Player = { id: socket.id, name: playerName, connected: true };
      const room = createRoom(player);
      playerRooms.set(socket.id, room.code);
      socket.join(room.code);
      callback(room);
    });

    socket.on('room:join', (code, playerName, callback) => {
      const room = findRoom(code);
      if (!room) {
        callback(null, 'Room not found');
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        callback(null, 'Room is full');
        return;
      }
      if (room.status !== 'waiting') {
        callback(null, 'Game already in progress');
        return;
      }

      const player: Player = { id: socket.id, name: playerName, connected: true };
      room.players.push(player);
      playerRooms.set(socket.id, room.code);
      socket.join(room.code);

      io.to(room.code).emit('player:joined', player);
      io.to(room.code).emit('room:updated', room);
      callback(room);
    });

    socket.on('room:leave', () => {
      removePlayerFromRoom(socket.id);
    });

    socket.on('disconnect', () => {
      removePlayerFromRoom(socket.id);
    });

    socket.on('chat:send', (text) => {
      const code = playerRooms.get(socket.id);
      if (!code) return;

      const message = {
        id: crypto.randomUUID(),
        playerId: socket.id,
        text,
        timestamp: Date.now(),
      };
      io.to(code).emit('chat:message', message);
    });
  });

  return { io, rooms, findRoom };
}
