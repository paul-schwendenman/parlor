import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyPlayer,
} from '@parlor/game-types';
import type { RoomManager } from './RoomManager.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface LobbyCallbacks {
  onGameStart?: (roomCode: string, players: LobbyPlayer[], io: AppServer) => void;
  onGameReset?: (roomCode: string, io: AppServer) => void;
  onPlayerDisconnect?: (roomCode: string, playerId: string, io: AppServer) => void;
  onPlayerReconnect?: (roomCode: string, playerId: string, io: AppServer) => void;
}

export function setupLobbyHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  callbacks?: LobbyCallbacks,
): void {
  socket.on('lobby:create', (playerName, callback) => {
    const roomCode = roomManager.createRoom(socket.id, playerName);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerId = socket.id;
    socket.data.playerName = playerName;
    callback(roomCode);

    const players = roomManager.getPlayersInRoom(roomCode);
    io.to(roomCode).emit('lobby:state', players, false);
  });

  socket.on('lobby:join', (roomCode, playerName, callback) => {
    const result = roomManager.joinRoom(roomCode, socket.id, playerName);
    if (!result.success) {
      callback(false, result.error);
      return;
    }

    const normalizedCode = roomCode.toUpperCase();
    socket.join(normalizedCode);
    socket.data.roomCode = normalizedCode;
    socket.data.playerId = socket.id;
    socket.data.playerName = playerName;
    callback(true);

    const players = roomManager.getPlayersInRoom(normalizedCode);
    const player = players.find((p) => p.id === socket.id);
    if (player) {
      io.to(normalizedCode).emit('lobby:playerJoined', player);
    }
    io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
  });

  socket.on('lobby:ready', (isReady) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    roomManager.setPlayerReady(socket.id, isReady);
    const players = roomManager.getPlayersInRoom(roomCode);
    io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
  });

  socket.on('lobby:startGame', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    if (!roomManager.isHost(roomCode, socket.id)) return;
    if (!roomManager.canStartGame(roomCode)) return;

    io.to(roomCode).emit('lobby:gameStarting');

    const players = roomManager.startGame(roomCode);
    if (players) {
      callbacks?.onGameStart?.(roomCode, players, io);
    }
  });

  socket.on('lobby:resetGame', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    if (roomManager.resetGame(roomCode)) {
      callbacks?.onGameReset?.(roomCode, io);
      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
    }
  });

  socket.on('player:reconnect', (roomCode, oldPlayerId) => {
    const success = roomManager.handleReconnect(roomCode, oldPlayerId, socket.id);
    if (success) {
      const normalizedCode = roomCode.toUpperCase();
      socket.join(normalizedCode);
      socket.data.roomCode = normalizedCode;
      socket.data.playerId = socket.id;

      const players = roomManager.getPlayersInRoom(normalizedCode);
      io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
      callbacks?.onPlayerReconnect?.(normalizedCode, socket.id, io);
    }
  });

  socket.on('disconnect', () => {
    const result = roomManager.handleDisconnect(socket.id);
    if (result) {
      io.to(result.roomCode).emit('lobby:playerLeft', socket.id);
      const players = roomManager.getPlayersInRoom(result.roomCode);
      if (players.length > 0) {
        io.to(result.roomCode).emit(
          'lobby:state',
          players,
          roomManager.canStartGame(result.roomCode),
        );

        if (result.wasHost) {
          const room = roomManager.getRoom(result.roomCode);
          if (room) {
            io.to(result.roomCode).emit('lobby:hostChanged', room.hostId);
          }
        }
      }

      if (result.wasInGame) {
        callbacks?.onPlayerDisconnect?.(result.roomCode, socket.id, io);
      }
    }
  });
}
