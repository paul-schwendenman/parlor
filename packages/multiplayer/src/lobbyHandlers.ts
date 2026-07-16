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

export interface LobbyHandlerOptions {
  /** Max players for rooms created through this server (e.g. a game's meta.maxPlayers). */
  defaultMaxPlayers?: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function setupLobbyHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  callbacks?: LobbyCallbacks,
  options?: LobbyHandlerOptions,
): void {
  socket.on('lobby:create', (playerName, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(playerName)) {
        socket.emit('error', 'Invalid player name');
        return;
      }

      const { roomCode, playerId, reconnectToken } = roomManager.createRoom(
        socket.id,
        playerName.trim(),
        options?.defaultMaxPlayers,
      );
      socket.join(roomCode);
      socket.join(playerId);
      socket.data.roomCode = roomCode;
      socket.data.playerId = playerId;
      socket.data.playerName = playerName.trim();
      callback({ roomCode, playerId, reconnectToken });

      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, false);
    } catch (err) {
      socket.emit('error', err instanceof Error ? err.message : 'Failed to create room');
    }
  });

  socket.on('lobby:join', (roomCode, playerName, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(roomCode) || !isNonEmptyString(playerName)) {
        callback({ success: false, error: 'Invalid room code or player name' });
        return;
      }

      const result = roomManager.joinRoom(roomCode, socket.id, playerName.trim());
      if (!result.success || !result.playerId) {
        callback({ success: false, error: result.error });
        return;
      }

      const normalizedCode = roomCode.toUpperCase();
      socket.join(normalizedCode);
      socket.join(result.playerId);
      socket.data.roomCode = normalizedCode;
      socket.data.playerId = result.playerId;
      socket.data.playerName = playerName.trim();
      callback({
        success: true,
        roomCode: normalizedCode,
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
      });

      const players = roomManager.getPlayersInRoom(normalizedCode);
      const player = players.find((p) => p.id === result.playerId);
      if (player) {
        io.to(normalizedCode).emit('lobby:playerJoined', player);
      }
      io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to join room',
        });
      }
    }
  });

  socket.on('lobby:spectate', (roomCode, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(roomCode)) {
        callback(false, 'Invalid room code');
        return;
      }

      const result = roomManager.addSpectator(roomCode, socket.id);
      if (!result.success) {
        callback(false, result.error);
        return;
      }

      const normalizedCode = roomCode.toUpperCase();
      socket.join(normalizedCode);
      socket.data.roomCode = normalizedCode;
      callback(true);
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, err instanceof Error ? err.message : 'Failed to spectate');
      }
    }
  });

  socket.on('lobby:ready', (isReady, callback) => {
    try {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) {
        callback?.(false, 'Not in a room');
        return;
      }
      if (typeof isReady !== 'boolean') {
        callback?.(false, 'Invalid ready value');
        return;
      }

      roomManager.setPlayerReady(playerId, isReady);
      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
      callback?.(true);
    } catch (err) {
      callback?.(false, err instanceof Error ? err.message : 'Failed to set ready');
    }
  });

  const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave'];

  socket.on('lobby:addBot', (callback) => {
    try {
      if (typeof callback !== 'function') return;
      const roomCode = socket.data.roomCode;
      if (!roomCode) {
        callback(false, 'Not in a room');
        return;
      }
      if (!roomManager.isHost(roomCode, socket.data.playerId)) {
        callback(false, 'Only the host can add bots');
        return;
      }

      const players = roomManager.getPlayersInRoom(roomCode);
      const existingBotCount = players.filter((p) => p.isBot).length;
      const botName = BOT_NAMES[existingBotCount % BOT_NAMES.length];

      const result = roomManager.addBot(roomCode, botName);
      if (!result.success) {
        callback(false, result.error);
        return;
      }

      callback(true);
      const updatedPlayers = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', updatedPlayers, roomManager.canStartGame(roomCode));
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, err instanceof Error ? err.message : 'Failed to add bot');
      }
    }
  });

  socket.on('lobby:removeBot', (botId, callback) => {
    try {
      if (typeof callback !== 'function') return;
      const roomCode = socket.data.roomCode;
      if (!roomCode) {
        callback(false, 'Not in a room');
        return;
      }
      if (!roomManager.isHost(roomCode, socket.data.playerId)) {
        callback(false, 'Only the host can remove bots');
        return;
      }
      if (!isNonEmptyString(botId)) {
        callback(false, 'Invalid bot id');
        return;
      }

      const result = roomManager.removeBot(roomCode, botId);
      if (!result.success) {
        callback(false, result.error);
        return;
      }

      callback(true);
      const updatedPlayers = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', updatedPlayers, roomManager.canStartGame(roomCode));
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, err instanceof Error ? err.message : 'Failed to remove bot');
      }
    }
  });

  socket.on('lobby:startGame', (callback) => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) {
        callback?.(false, 'Not in a room');
        return;
      }
      if (!roomManager.isHost(roomCode, socket.data.playerId)) {
        callback?.(false, 'Only the host can start the game');
        return;
      }

      const players = roomManager.startGame(roomCode);
      if (!players) {
        callback?.(false, 'Cannot start the game yet');
        return;
      }

      io.to(roomCode).emit('lobby:gameStarting');
      callbacks?.onGameStart?.(roomCode, players, io);
      callback?.(true);
    } catch (err) {
      callback?.(false, err instanceof Error ? err.message : 'Failed to start game');
    }
  });

  socket.on('lobby:resetGame', () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      if (!roomManager.isHost(roomCode, socket.data.playerId)) return;

      if (roomManager.resetGame(roomCode)) {
        callbacks?.onGameReset?.(roomCode, io);
        const players = roomManager.getPlayersInRoom(roomCode);
        io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
      }
    } catch (err) {
      socket.emit('error', err instanceof Error ? err.message : 'Failed to reset game');
    }
  });

  socket.on('lobby:restartGame', () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      if (!roomManager.isHost(roomCode, socket.data.playerId)) return;

      if (!roomManager.resetGame(roomCode)) return;
      callbacks?.onGameReset?.(roomCode, io);

      // resetGame un-readies humans; re-ready them so an explicit restart can start.
      roomManager.readyAllHumans(roomCode);

      const players = roomManager.startGame(roomCode);
      if (players) {
        io.to(roomCode).emit('lobby:gameStarting');
        callbacks?.onGameStart?.(roomCode, players, io);
      } else {
        const current = roomManager.getPlayersInRoom(roomCode);
        io.to(roomCode).emit('lobby:state', current, roomManager.canStartGame(roomCode));
      }
    } catch (err) {
      socket.emit('error', err instanceof Error ? err.message : 'Failed to restart game');
    }
  });

  socket.on('room:leave', () => {
    try {
      const result = roomManager.leaveRoom(socket.id);
      if (!result) return;

      socket.leave(result.roomCode);
      socket.leave(result.playerId);
      socket.data.roomCode = '';
      socket.data.playerId = '';

      io.to(result.roomCode).emit('lobby:playerLeft', result.playerId);
      const players = roomManager.getPlayersInRoom(result.roomCode);
      if (players.length > 0) {
        io.to(result.roomCode).emit('lobby:state', players, roomManager.canStartGame(result.roomCode));
        if (result.wasHost) {
          const room = roomManager.getRoom(result.roomCode);
          if (room) io.to(result.roomCode).emit('lobby:hostChanged', room.hostId);
        }
      }
    } catch (err) {
      socket.emit('error', err instanceof Error ? err.message : 'Failed to leave room');
    }
  });

  socket.on('player:reconnect', (roomCode, playerId, token, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(roomCode) || !isNonEmptyString(playerId) || !isNonEmptyString(token)) {
        callback(false);
        return;
      }

      const success = roomManager.handleReconnect(roomCode, playerId, token, socket.id);
      if (success) {
        const normalizedCode = roomCode.toUpperCase();
        socket.join(normalizedCode);
        socket.join(playerId);
        socket.data.roomCode = normalizedCode;
        socket.data.playerId = playerId;

        const players = roomManager.getPlayersInRoom(normalizedCode);
        io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
        callbacks?.onPlayerReconnect?.(normalizedCode, playerId, io);
      }
      callback(success);
    } catch {
      if (typeof callback === 'function') callback(false);
    }
  });

  socket.on('disconnect', () => {
    try {
      const result = roomManager.handleDisconnect(socket.id);
      if (!result) return;

      io.to(result.roomCode).emit('lobby:playerLeft', result.playerId);
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
        callbacks?.onPlayerDisconnect?.(result.roomCode, result.playerId, io);
      }
    } catch {
      // never let a disconnect handler throw
    }
  });
}
