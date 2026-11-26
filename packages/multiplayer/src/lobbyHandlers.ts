import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyPlayer,
  GameMeta,
} from '@parlor/game-types';
import type { RoomManager, DisconnectResult, ExpiryOutcome } from './RoomManager.js';
import { safeAck } from './ack.js';
import { toPublicError } from './errors.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface LobbyCallbacks {
  onGameStart?: (roomCode: string, players: LobbyPlayer[], io: AppServer) => void;
  onGameReset?: (roomCode: string, io: AppServer) => void;
  onPlayerDisconnect?: (roomCode: string, playerId: string, io: AppServer) => void;
  onPlayerReconnect?: (roomCode: string, playerId: string, io: AppServer) => void;
  /**
   * Fired when an in-game player is really removed after the disconnect grace
   * window expires, so the game layer can forfeit / clean up in the engine.
   */
  onPlayerRemoved?: (roomCode: string, playerId: string, io: AppServer) => void;
}

export interface LobbyHandlerOptions {
  /** Max players for rooms created through this server (e.g. a game's meta.maxPlayers). */
  defaultMaxPlayers?: number;
  /** Standalone servers create rooms with their only game selected. */
  defaultGame?: GameMeta;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Emit the real-removal signals when a disconnect grace timer expires. */
function emitExpiry(
  io: AppServer,
  roomManager: RoomManager,
  outcome: ExpiryOutcome,
  callbacks?: LobbyCallbacks,
): void {
  // A seat was released or its grace period expired.
  io.to(outcome.roomCode).emit('lobby:playerLeft', outcome.playerId);

  if (outcome.wasInGame && roomManager.isGameParticipant(outcome.roomCode, outcome.playerId)) {
    // Let the game layer forfeit / clean up the seat in the engine.
    callbacks?.onPlayerRemoved?.(outcome.roomCode, outcome.playerId, io);
  }

  if (!outcome.roomDestroyed) {
    const players = roomManager.getPlayersInRoom(outcome.roomCode);
    io.to(outcome.roomCode).emit(
      'lobby:state',
      players,
      roomManager.canStartGame(outcome.roomCode),
    );
    if (outcome.newHostId) {
      io.to(outcome.roomCode).emit('lobby:hostChanged', outcome.newHostId);
    }
  }
}

/**
 * Send a room back to the lobby: reset it, let the game clean up, and broadcast
 * the lobby. Shared by `lobby:resetGame`, the start/restart rollback, and the
 * action boundary's room-failure path. Never throws. Returns false if the room
 * is gone.
 */
export function returnRoomToLobby(
  io: AppServer,
  roomManager: RoomManager,
  roomCode: string,
  callbacks?: LobbyCallbacks,
): boolean {
  if (!roomManager.resetGame(roomCode)) return false;
  try {
    callbacks?.onGameReset?.(roomCode, io);
  } catch (err) {
    console.error('[parlor] onGameReset failed', { roomCode }, err);
  }
  try {
    const players = roomManager.getPlayersInRoom(roomCode);
    io.to(roomCode).emit('lobby:returned', roomManager.getGameId(roomCode));
    io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
  } catch (err) {
    console.error('[parlor] lobby:state broadcast failed', { roomCode }, err);
  }
  return true;
}

export function setupLobbyHandlers(
  io: AppServer,
  socket: AppSocket,
  roomManager: RoomManager,
  callbacks?: LobbyCallbacks,
  options?: LobbyHandlerOptions,
): void {
  function syncSeat(
    previousSeat: DisconnectResult | null | undefined,
    roomCode = '',
    playerId = '',
    playerName = '',
  ): void {
    if (previousSeat) {
      if (previousSeat.roomCode !== roomCode) void socket.leave(previousSeat.roomCode);
      if (previousSeat.playerId !== socket.id) void socket.leave(previousSeat.playerId);
    }

    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
    socket.data.playerName = playerName;
    if (roomCode) void socket.join(roomCode);
    if (playerId) void socket.join(playerId);
  }

  function notifySeatReleased(previousSeat: DisconnectResult | null | undefined): void {
    if (!previousSeat) return;
    const { roomCode, playerId, wasInGame, newHostId } = previousSeat;
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      io.in(roomCode).socketsLeave(roomCode);
      return;
    }
    if (playerId === socket.id) return;

    emitExpiry(io, roomManager, {
      roomCode, playerId, wasInGame, newHostId,
      wasHost: previousSeat.wasHost, roomDestroyed: false,
    }, callbacks);
  }

  socket.on('lobby:create', (playerName, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(playerName)) {
        socket.emit('error', 'Invalid player name');
        return;
      }

      const { roomCode, playerId, reconnectToken, previousSeat } = roomManager.createRoom(
        socket.id,
        playerName.trim(),
        options?.defaultMaxPlayers,
      );
      if (options?.defaultGame) roomManager.selectGame(roomCode, options.defaultGame);
      syncSeat(previousSeat, roomCode, playerId, playerName.trim());
      callback({ roomCode, playerId, reconnectToken });
      notifySeatReleased(previousSeat);

      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, false);
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to create room', { roomCode: socket.data.roomCode }).message);
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
      syncSeat(result.previousSeat, normalizedCode, result.playerId, playerName.trim());
      callback({
        success: true,
        roomCode: normalizedCode,
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
      });
      notifySeatReleased(result.previousSeat);

      const room = roomManager.getRoom(normalizedCode);
      if (room) {
        socket.emit('lobby:gameSelected', room.gameId);
        if (result.newHostId) {
          io.to(normalizedCode).emit('lobby:hostChanged', result.newHostId);
        } else {
          socket.emit('lobby:hostChanged', room.hostId);
        }
      }
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
          error: toPublicError(err, 'Failed to join room', { roomCode: socket.data.roomCode }).message,
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
      syncSeat(result.previousSeat, normalizedCode);
      callback(true);
      notifySeatReleased(result.previousSeat);
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, toPublicError(err, 'Failed to spectate', { roomCode: socket.data.roomCode }).message);
      }
    }
  });

  socket.on('lobby:ready', (isReady, callback) => {
    const ack = safeAck(callback);
    try {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) {
        ack(false, 'Not in a room');
        return;
      }
      if (typeof isReady !== 'boolean') {
        ack(false, 'Invalid ready value');
        return;
      }

      if (!roomManager.isSeatedPlayer(roomCode, playerId, socket.id)
          || !roomManager.setPlayerReady(playerId, isReady)) {
        ack(false, 'Cannot change readiness outside the lobby');
        return;
      }
      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
      ack(true);
    } catch (err) {
      ack(false, toPublicError(err, 'Failed to set ready', { roomCode: socket.data.roomCode }).message);
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
      if (!roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
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
        callback(false, toPublicError(err, 'Failed to add bot', { roomCode: socket.data.roomCode }).message);
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
      if (!roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
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
        callback(false, toPublicError(err, 'Failed to remove bot', { roomCode: socket.data.roomCode }).message);
      }
    }
  });

  socket.on('lobby:startGame', (callback) => {
    const ack = safeAck(callback);
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) {
        ack(false, 'Not in a room');
        return;
      }
      if (!roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
        ack(false, 'Only the host can start the game');
        return;
      }

      const players = roomManager.startGame(roomCode);
      if (!players) {
        ack(false, 'Cannot start the game yet');
        return;
      }

      // Build the game before telling clients it is starting, so a failed start
      // leaves them in the lobby instead of on a game page that never loads.
      try {
        callbacks?.onGameStart?.(roomCode, players, io);
      } catch (err) {
        const message = toPublicError(err, 'Failed to start game', { roomCode }).message;
        returnRoomToLobby(io, roomManager, roomCode, callbacks);
        ack(false, message);
        return;
      }
      io.to(roomCode).emit('lobby:gameStarting');
      ack(true);
    } catch (err) {
      ack(false, toPublicError(err, 'Failed to start game', { roomCode: socket.data.roomCode }).message);
    }
  });

  socket.on('lobby:resetGame', () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      if (!roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) return;

      returnRoomToLobby(io, roomManager, roomCode, callbacks);
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to reset game', { roomCode: socket.data.roomCode }).message);
    }
  });

  socket.on('lobby:restartGame', () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
        socket.emit('error', 'Only the host can restart the game');
        return;
      }
      try {
        const players = roomManager.restartGame(roomCode, () => callbacks?.onGameReset?.(roomCode, io));
        if (!players) {
          socket.emit('error', 'Cannot restart the game yet');
          return;
        }
        callbacks?.onGameStart?.(roomCode, players, io);
      } catch (err) {
        const message = toPublicError(err, 'Failed to restart game', { roomCode }).message;
        returnRoomToLobby(io, roomManager, roomCode, callbacks);
        socket.emit('error', message);
        return;
      }
      io.to(roomCode).emit('lobby:gameStarting');
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to restart game', { roomCode: socket.data.roomCode }).message);
    }
  });

  socket.on('room:leave', () => {
    try {
      const result = roomManager.leaveRoom(socket.id);
      if (!result) return;

      syncSeat(result);
      notifySeatReleased(result);
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to leave room', { roomCode: socket.data.roomCode }).message);
    }
  });

  socket.on('player:reconnect', (roomCode, playerId, token, callback) => {
    const ack = safeAck(callback);
    let acknowledged = false;
    try {
      if (typeof callback !== 'function') return;
      if (!isNonEmptyString(roomCode) || !isNonEmptyString(playerId) || !isNonEmptyString(token)) {
        ack(false);
        return;
      }

      const result = roomManager.handleReconnect(roomCode, playerId, token, socket.id);
      if (!result) {
        ack(false);
        return;
      }

      if (result.supersededSocketId) {
        io.sockets.sockets.get(result.supersededSocketId)?.disconnect(true);
      }
      const normalizedCode = roomCode.toUpperCase();
      const room = roomManager.getRoom(normalizedCode);
      syncSeat(result.previousSeat, normalizedCode, playerId, room?.players.get(playerId)?.name);
      acknowledged = true;
      ack(true, result.reconnectToken);
      notifySeatReleased(result.previousSeat);

      if (room?.status === 'waiting') {
        socket.emit('lobby:returned', room.gameId);
      } else if (room) {
        socket.emit('lobby:gameSelected', room.gameId);
        socket.emit('lobby:gameStarting');
      }
      const players = roomManager.getPlayersInRoom(normalizedCode);
      io.to(normalizedCode).emit('player:reconnected', playerId);
      io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
      if (result.newHostId) {
        io.to(normalizedCode).emit('lobby:hostChanged', result.newHostId);
      } else if (room) {
        socket.emit('lobby:hostChanged', room.hostId);
      }
      callbacks?.onPlayerReconnect?.(normalizedCode, playerId, io);
    } catch (err) {
      if (!acknowledged) ack(false);
      console.error('[parlor] reconnect failed', { roomCode }, err);
    }
  });

  socket.on('disconnect', () => {
    try {
      const result = roomManager.handleDisconnect(socket.id, (outcome) => {
        // Fired later, when the grace timer expires and the player is really removed.
        if (outcome.roomDestroyed) io.in(outcome.roomCode).socketsLeave(outcome.roomCode);
        emitExpiry(io, roomManager, outcome, callbacks);
      });
      if (!result) return;

      // Spectator (or already-gone player): nothing to retain or grey out.
      if (!result.retained) return;

      // Player kept during the grace window: grey them out, do not remove.
      io.to(result.roomCode).emit('player:disconnected', result.playerId);
      const players = roomManager.getPlayersInRoom(result.roomCode);
      io.to(result.roomCode).emit(
        'lobby:state',
        players,
        roomManager.canStartGame(result.roomCode),
      );

      if (result.newHostId) io.to(result.roomCode).emit('lobby:hostChanged', result.newHostId);

      if (result.wasInGame && roomManager.isGameParticipant(result.roomCode, result.playerId)) {
        // Tell the engine the seat went dark (view greys the player); removal waits for expiry.
        callbacks?.onPlayerDisconnect?.(result.roomCode, result.playerId, io);
      }
    } catch {
      // never let a disconnect handler throw
    }
  });
}
