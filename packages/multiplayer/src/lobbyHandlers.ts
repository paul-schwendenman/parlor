import { MAX_BOTS, type LobbyPlayer, type GameMeta } from '@parlor/game-types';
import type { RoomManager, DisconnectResult, ExpiryOutcome } from './RoomManager.js';
import { safeAck } from './ack.js';
import { foldPlayerName, validatePlayerName } from './playerNames.js';
import { toPublicError } from './errors.js';
import { logServerError, recordMetric } from './observability.js';
import { allowSocketRequest, RATE_LIMIT_MESSAGE } from './rateLimit.js';
import type { GameIo, LobbyIo, LobbySocket } from './gameDefinition.js';

export interface LobbyCallbacks {
  onLobbyRosterChanged?: (roomCode: string) => void;
  onGameStart?: (roomCode: string, players: LobbyPlayer[], io: GameIo) => void;
  onGameReset?: (roomCode: string, io: GameIo) => void;
  /** Called on room deletion after scheduled game work has been invalidated. */
  onRoomDestroyed?: (roomCode: string, io: GameIo) => void;
  onSpectatorJoin?: (roomCode: string, socketId: string) => void;
  onPlayerDisconnect?: (roomCode: string, playerId: string, io: GameIo) => void | Promise<void>;
  onPlayerReconnect?: (roomCode: string, playerId: string, io: GameIo) => void | Promise<void>;
  /**
   * Fired when an in-game player is really removed after the disconnect grace
   * window expires, so the game layer can forfeit / clean up in the engine.
   */
  onPlayerRemoved?: (roomCode: string, playerId: string, io: GameIo) => void | Promise<void>;
}

export interface LobbyHandlerOptions {
  /** Max players for rooms created through this server (e.g. a game's meta.maxPlayers). */
  defaultMaxPlayers?: number;
  /** Standalone servers create rooms with their only game selected. */
  defaultGame?: GameMeta;
}

const UNEXPECTED_ARGUMENTS = 'Unexpected request arguments';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function runPlayerCallback(
  io: GameIo,
  roomManager: RoomManager,
  callbacks: LobbyCallbacks | undefined,
  event: 'onPlayerRemoved' | 'onPlayerReconnect' | 'onPlayerDisconnect',
  roomCode: string,
  playerId: string,
): void {
  const callback = callbacks?.[event];
  if (!callback) return;
  const instance = roomManager.getGameInstance(roomCode);
  const context = roomManager.getErrorContext(roomCode, playerId);
  const fail = (error: unknown) => {
    if (instance && !instance.isCurrent()) return;
    logServerError('player_lifecycle_callback_failed', { ...context, callback: event }, error);
    if (instance) {
      recordMetric('caughtRoomFailures');
      returnRoomToLobby(io, roomManager, roomCode, callbacks);
    }
  };
  try {
    const work = callback(roomCode, playerId, io);
    if (work) void work.catch(fail);
  } catch (error) {
    fail(error);
  }
}

/** Emit the real-removal signals when a disconnect grace timer expires. */
function emitExpiry(
  io: GameIo,
  roomManager: RoomManager,
  outcome: ExpiryOutcome,
  callbacks?: LobbyCallbacks,
): void {
  if (outcome.wasInGame && roomManager.isGameParticipant(outcome.roomCode, outcome.playerId)) {
    // Let the game layer forfeit / clean up the seat in the engine.
    runPlayerCallback(io, roomManager, callbacks, 'onPlayerRemoved', outcome.roomCode, outcome.playerId);
  }

  if (!outcome.roomDestroyed) {
    const players = roomManager.getPlayersInRoom(outcome.roomCode);
    io.to(outcome.roomCode).emit(
      'lobby:state',
      players,
      roomManager.canStartGame(outcome.roomCode),
    );
    callbacks?.onLobbyRosterChanged?.(outcome.roomCode);
    if (outcome.newHostId) {
      io.to(outcome.roomCode).emit('lobby:hostChanged', outcome.newHostId, 'left');
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
  io: GameIo,
  roomManager: RoomManager,
  roomCode: string,
  callbacks?: LobbyCallbacks,
): boolean {
  const context = roomManager.getErrorContext(roomCode);
  if (!roomManager.resetGame(roomCode)) return false;
  try {
    callbacks?.onGameReset?.(roomCode, io);
  } catch (err) {
    recordMetric('caughtRoomFailures');
    logServerError('game_reset_callback_failed', context, err);
  }
  try {
    const players = roomManager.getPlayersInRoom(roomCode);
    io.to(roomCode).emit('lobby:returned', roomManager.getGameId(roomCode));
    io.to(roomCode).emit('lobby:state', players, roomManager.canStartGame(roomCode));
  } catch (err) {
    logServerError('lobby_return_broadcast_failed', context, err);
  }
  return true;
}

export function setupLobbyHandlers(
  io: LobbyIo,
  socket: LobbySocket,
  roomManager: RoomManager,
  callbacks?: LobbyCallbacks,
  options?: LobbyHandlerOptions,
): void {
  const context = () => roomManager.getErrorContext(socket.data.roomCode, socket.data.playerId);

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
      io.to(roomCode).emit('room:closed', roomCode);
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
    let acknowledged = false;
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket)) {
        callback(null, RATE_LIMIT_MESSAGE);
        return;
      }
      const validated = validatePlayerName(playerName);
      if (!validated.name) {
        callback(null, validated.error);
        return;
      }

      const { roomCode, playerId, reconnectToken, previousSeat } = roomManager.createRoom(
        socket.id,
        validated.name,
        options?.defaultMaxPlayers,
        (code) => callbacks?.onRoomDestroyed?.(code, io),
      );
      if (options?.defaultGame) roomManager.selectGame(roomCode, options.defaultGame);
      syncSeat(previousSeat, roomCode, playerId, validated.name);
      acknowledged = true;
      callback({ roomCode, playerId, reconnectToken });
      notifySeatReleased(previousSeat);

      const players = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', players, false);
      callbacks?.onLobbyRosterChanged?.(roomCode);
    } catch (err) {
      const { message } = toPublicError(err, 'Failed to create room', context());
      if (!acknowledged && typeof callback === 'function') callback(null, message);
    }
  });

  socket.on('lobby:join', (roomCode, playerName, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket, true)) {
        callback({ success: false, error: RATE_LIMIT_MESSAGE });
        return;
      }
      if (!isNonEmptyString(roomCode)) {
        callback({ success: false, error: 'Invalid room code or player name' });
        return;
      }

      const validated = validatePlayerName(playerName);
      if (!validated.name) {
        callback({ success: false, error: validated.error });
        return;
      }

      const result = roomManager.joinRoom(roomCode, socket.id, validated.name);
      if (!result.success || !result.playerId) {
        callback({ success: false, error: result.error });
        return;
      }

      const normalizedCode = roomCode.toUpperCase();
      syncSeat(result.previousSeat, normalizedCode, result.playerId, validated.name);
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
      io.to(normalizedCode).emit('lobby:state', players, roomManager.canStartGame(normalizedCode));
      callbacks?.onLobbyRosterChanged?.(normalizedCode);
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: toPublicError(err, 'Failed to join room', context()).message,
        });
      }
    }
  });

  // Joining by code and previewing a room share the same lookup budget.
  socket.on('lobby:roomExists', (roomCode, callback) => {
    const ack = typeof callback === 'function' ? callback : undefined;
    try {
      if (!ack) return;
      if (!allowSocketRequest(socket, true)) {
        ack(false, RATE_LIMIT_MESSAGE);
        return;
      }
      const room = isNonEmptyString(roomCode) ? roomManager.getRoom(roomCode) : undefined;
      if (room) ack(true, undefined, room.gameId);
      else ack(false);
    } catch (err) {
      ack?.(false, toPublicError(err, 'Could not check this room', context()).message);
    }
  });

  socket.on('lobby:spectate', (roomCode, callback) => {
    let acknowledged = false;
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket, true)) {
        callback(false, RATE_LIMIT_MESSAGE);
        return;
      }
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
      acknowledged = true;
      callback(true);
      notifySeatReleased(result.previousSeat);
      const room = roomManager.getRoom(normalizedCode);
      if (!room) return;
      socket.emit('lobby:gameSelected', room.gameId);
      socket.emit('lobby:hostChanged', room.hostId);
      socket.emit('lobby:state', roomManager.getPlayersInRoom(normalizedCode), roomManager.canStartGame(normalizedCode));
      callbacks?.onLobbyRosterChanged?.(normalizedCode);
      if (room.status !== 'waiting') {
        socket.emit('lobby:gameStarting');
        callbacks?.onSpectatorJoin?.(normalizedCode, socket.id);
      }
    } catch (err) {
      const { message } = toPublicError(err, 'Failed to spectate', context());
      if (!acknowledged && typeof callback === 'function') callback(false, message);
    }
  });

  socket.on('lobby:ready', (isReady, callback) => {
    const ack = safeAck(callback);
    try {
      if (!allowSocketRequest(socket)) {
        ack(false, RATE_LIMIT_MESSAGE);
        return;
      }
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
      ack(false, toPublicError(err, 'Failed to set ready', context()).message);
    }
  });

  const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave'];

  socket.on('lobby:addBot', (callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket)) {
        callback(false, RATE_LIMIT_MESSAGE);
        return;
      }
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
      const occupiedNames = new Set(players.map((player) => foldPlayerName(player.name)));
      const botName = BOT_NAMES.find((name) => !occupiedNames.has(foldPlayerName(name)));
      if (!botName) {
        callback(false, `A room can have ${MAX_BOTS} bots at most. Invite someone for the next seat.`);
        return;
      }

      const result = roomManager.addBot(roomCode, botName);
      if (!result.success) {
        callback(false, result.error);
        return;
      }

      callback(true);
      const updatedPlayers = roomManager.getPlayersInRoom(roomCode);
      io.to(roomCode).emit('lobby:state', updatedPlayers, roomManager.canStartGame(roomCode));
      callbacks?.onLobbyRosterChanged?.(roomCode);
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, toPublicError(err, 'Failed to add bot', context()).message);
      }
    }
  });

  socket.on('lobby:removeBot', (botId, callback) => {
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket)) {
        callback(false, RATE_LIMIT_MESSAGE);
        return;
      }
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
      callbacks?.onLobbyRosterChanged?.(roomCode);
    } catch (err) {
      if (typeof callback === 'function') {
        callback(false, toPublicError(err, 'Failed to remove bot', context()).message);
      }
    }
  });

  socket.on('lobby:transferHost', (targetId, callback) => {
    const ack = safeAck(callback);
    try {
      if (!allowSocketRequest(socket)) {
        ack(false, RATE_LIMIT_MESSAGE);
        return;
      }
      if (callback !== undefined && typeof callback !== 'function') {
        socket.emit('error', UNEXPECTED_ARGUMENTS);
        return;
      }
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) {
        ack(false, 'Not in a room');
        return;
      }
      if (!isNonEmptyString(targetId)) {
        ack(false, 'Invalid player id');
        return;
      }
      if (!roomManager.isSeatedPlayer(roomCode, playerId, socket.id)) {
        ack(false, 'Only the host can pass the host role on');
        return;
      }

      const result = roomManager.transferHost(roomCode, playerId, targetId);
      if (!result.success) {
        ack(false, result.error);
        return;
      }

      ack(true);
      io.to(roomCode).emit('lobby:hostChanged', targetId, 'transfer');
      // The host's own seat needs no Ready, so whether the room can start may change.
      io.to(roomCode).emit('lobby:state', roomManager.getPlayersInRoom(roomCode), roomManager.canStartGame(roomCode));
    } catch (err) {
      ack(false, toPublicError(err, 'Could not pass the host role on', context()).message);
    }
  });

  socket.on('lobby:startGame', (callback) => {
    const ack = safeAck(callback);
    try {
      if (!allowSocketRequest(socket)) {
        ack(false, RATE_LIMIT_MESSAGE);
        return;
      }
      if (callback !== undefined && typeof callback !== 'function') {
        socket.emit('error', UNEXPECTED_ARGUMENTS);
        return;
      }
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

      const players = roomManager.startGame(roomCode, () => returnRoomToLobby(io, roomManager, roomCode, callbacks));
      if (!players) {
        ack(false, 'Cannot start the game yet');
        return;
      }

      // Build the game before telling clients it is starting, so a failed start
      // leaves them in the lobby instead of on a game page that never loads.
      try {
        callbacks?.onGameStart?.(roomCode, players, io);
      } catch (err) {
        recordMetric('caughtRoomFailures');
        const message = toPublicError(err, 'Failed to start game', context()).message;
        returnRoomToLobby(io, roomManager, roomCode, callbacks);
        ack(false, message);
        return;
      }
      recordMetric('gamesStarted');
      io.to(roomCode).emit('lobby:gameStarting');
      ack(true);
    } catch (err) {
      ack(false, toPublicError(err, 'Failed to start game', context()).message);
    }
  });

  socket.on('lobby:resetGame', (...args: unknown[]) => {
    try {
      if (!allowSocketRequest(socket)) {
        socket.emit('error', RATE_LIMIT_MESSAGE);
        return;
      }
      if (args.length > 0) {
        socket.emit('error', UNEXPECTED_ARGUMENTS);
        return;
      }
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;
      if (!roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) return;

      returnRoomToLobby(io, roomManager, roomCode, callbacks);
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to reset game', context()).message);
    }
  });

  socket.on('lobby:restartGame', (...args: unknown[]) => {
    try {
      if (!allowSocketRequest(socket)) {
        socket.emit('error', RATE_LIMIT_MESSAGE);
        return;
      }
      if (args.length > 0) {
        socket.emit('error', UNEXPECTED_ARGUMENTS);
        return;
      }
      const roomCode = socket.data.roomCode;
      if (!roomCode || !roomManager.isHost(roomCode, socket.data.playerId)
          || !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
        socket.emit('error', 'Only the host can restart the game');
        return;
      }
      let restartContext = context();
      try {
        const players = roomManager.restartGame(
          roomCode,
          () => callbacks?.onGameReset?.(roomCode, io),
          () => returnRoomToLobby(io, roomManager, roomCode, callbacks),
        );
        if (!players) {
          socket.emit('error', 'Cannot restart the game yet');
          return;
        }
        restartContext = context();
        callbacks?.onGameStart?.(roomCode, players, io);
      } catch (err) {
        recordMetric('caughtRoomFailures');
        const message = toPublicError(err, 'Failed to restart game', restartContext).message;
        returnRoomToLobby(io, roomManager, roomCode, callbacks);
        socket.emit('error', message);
        return;
      }
      recordMetric('gamesStarted');
      io.to(roomCode).emit('lobby:gameStarting');
    } catch (err) {
      socket.emit('error', toPublicError(err, 'Failed to restart game', context()).message);
    }
  });

  socket.on('room:leave', (callback, ...args: unknown[]) => {
    const ack = safeAck(callback);
    try {
      if (!allowSocketRequest(socket)) {
        if (callback) ack(false, RATE_LIMIT_MESSAGE);
        else socket.emit('error', RATE_LIMIT_MESSAGE);
        return;
      }
      if (args.length > 0 || (callback !== undefined && typeof callback !== 'function')) {
        socket.emit('error', UNEXPECTED_ARGUMENTS);
        return;
      }
      const result = roomManager.leaveRoom(socket.id);
      if (result) {
        syncSeat(result);
        notifySeatReleased(result);
      }
    } catch (err) {
      const message = toPublicError(err, 'Failed to leave room', context()).message;
      if (callback) ack(false, message);
      else socket.emit('error', message);
      return;
    }
    ack(true);
  });

  socket.on('player:reconnect', (roomCode, playerId, token, callback) => {
    const ack = safeAck(callback);
    let acknowledged = false;
    try {
      if (typeof callback !== 'function') return;
      if (!allowSocketRequest(socket)) {
        socket.emit('error', RATE_LIMIT_MESSAGE);
        return;
      }
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
      callbacks?.onLobbyRosterChanged?.(normalizedCode);
      if (result.newHostId) {
        io.to(normalizedCode).emit('lobby:hostChanged', result.newHostId);
      } else if (room) {
        socket.emit('lobby:hostChanged', room.hostId);
      }
      runPlayerCallback(io, roomManager, callbacks, 'onPlayerReconnect', normalizedCode, playerId);
    } catch (err) {
      if (!acknowledged) ack(false);
      logServerError('reconnect_failed', context(), err);
    }
  });

  socket.on('disconnect', () => {
    try {
      const result = roomManager.handleDisconnect(socket.id, (outcome) => {
        // Fired later, when the grace timer expires and the player is really removed.
        try {
          if (outcome.roomDestroyed) {
            io.to(outcome.roomCode).emit('room:closed', outcome.roomCode);
            io.in(outcome.roomCode).socketsLeave(outcome.roomCode);
          }
          emitExpiry(io, roomManager, outcome, callbacks);
        } catch (error) {
          logServerError('grace_expiry_broadcast_failed', roomManager.getErrorContext(outcome.roomCode, outcome.playerId), error);
        }
      }, (outcome) => {
        // Fired later, when a disconnected host's short grace ends without a reconnect.
        try {
          io.to(outcome.roomCode).emit('lobby:hostChanged', outcome.newHostId, 'handoff');
          io.to(outcome.roomCode).emit(
            'lobby:state',
            roomManager.getPlayersInRoom(outcome.roomCode),
            roomManager.canStartGame(outcome.roomCode),
          );
        } catch (error) {
          logServerError('host_handoff_broadcast_failed', roomManager.getErrorContext(outcome.roomCode, outcome.previousHostId), error);
        }
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

      if (result.wasInGame && roomManager.isGameParticipant(result.roomCode, result.playerId)) {
        // Tell the engine the seat went dark (view greys the player); removal waits for expiry.
        runPlayerCallback(io, roomManager, callbacks, 'onPlayerDisconnect', result.roomCode, result.playerId);
      }
    } catch (error) {
      logServerError('disconnect_failed', context(), error);
    }
  });
}
