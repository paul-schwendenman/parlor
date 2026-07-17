import { randomUUID } from 'node:crypto';
import type { LobbyPlayer } from '@parlor/game-types';
import { generateRoomCode } from './utils.js';

export interface GameRoom {
  code: string;
  hostId: string;
  players: Map<string, LobbyPlayer>;
  spectators: Set<string>;
  gameData: unknown;
  gameId: string | null;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  /** playerId -> reconnect token. Never sent to clients. */
  reconnectTokens: Map<string, string>;
}

export interface DisconnectResult {
  roomCode: string;
  playerId: string;
  wasHost: boolean;
  wasInGame: boolean;
  /** True when the player was kept during the grace window (a timer is now pending). */
  retained: boolean;
}

/** Outcome reported to the lobby layer when a grace timer expires and a player is really removed. */
export interface ExpiryOutcome {
  roomCode: string;
  playerId: string;
  wasInGame: boolean;
  wasHost: boolean;
  /** Set when the host was reassigned to this player id. */
  newHostId?: string;
  /** True when the room was destroyed (no humans left). */
  roomDestroyed: boolean;
}

export interface CreateRoomResult {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}

export interface JoinRoomResult {
  success: boolean;
  error?: string;
  playerId?: string;
  reconnectToken?: string;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  /** stable playerId -> roomCode */
  private playerToRoom = new Map<string, string>();
  /** socketId -> stable playerId */
  private socketToPlayer = new Map<string, string>();
  /** socketId -> roomCode (spectators are tracked by socket id) */
  private spectatorToRoom = new Map<string, string>();
  /** playerId -> pending disconnect grace timer */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private botCounter = 0;

  /** @param graceMs disconnect grace window before a player is really removed. */
  constructor(private readonly graceMs = 60_000) {}

  static isBotPlayer(id: string): boolean {
    return id.startsWith('bot-');
  }

  createRoom(hostSocketId: string, hostName: string, maxPlayers = 8): CreateRoomResult {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const playerId = randomUUID();
    const reconnectToken = randomUUID();

    const host: LobbyPlayer = {
      id: playerId,
      name: hostName,
      connected: true,
      isReady: false,
      isBot: false,
    };

    this.rooms.set(code, {
      code,
      hostId: playerId,
      players: new Map([[playerId, host]]),
      spectators: new Set(),
      gameData: null,
      gameId: null,
      maxPlayers,
      status: 'waiting',
      createdAt: Date.now(),
      reconnectTokens: new Map([[playerId, reconnectToken]]),
    });

    this.playerToRoom.set(playerId, code);
    this.socketToPlayer.set(hostSocketId, playerId);
    return { roomCode: code, playerId, reconnectToken };
  }

  joinRoom(code: string, socketId: string, name: string): JoinRoomResult {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= room.maxPlayers) return { success: false, error: 'Room is full' };
    if (room.status !== 'waiting') return { success: false, error: 'Game already in progress' };

    const nameTaken = [...room.players.values()].some(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (nameTaken) return { success: false, error: 'Name already taken in this room' };

    const playerId = randomUUID();
    const reconnectToken = randomUUID();

    const player: LobbyPlayer = {
      id: playerId,
      name,
      connected: true,
      isReady: false,
      isBot: false,
    };
    room.players.set(playerId, player);
    room.reconnectTokens.set(playerId, reconnectToken);
    this.playerToRoom.set(playerId, code.toUpperCase());
    this.socketToPlayer.set(socketId, playerId);
    return { success: true, playerId, reconnectToken };
  }

  addBot(code: string, botName: string): { success: boolean; error?: string; botId?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= room.maxPlayers) return { success: false, error: 'Room is full' };
    if (room.status !== 'waiting') return { success: false, error: 'Game already in progress' };

    const botId = `bot-${++this.botCounter}`;
    const bot: LobbyPlayer = {
      id: botId,
      name: botName,
      connected: true,
      isReady: true,
      isBot: true,
    };
    room.players.set(botId, bot);
    return { success: true, botId };
  }

  removeBot(code: string, botId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const player = room.players.get(botId);
    if (!player) return { success: false, error: 'Bot not found' };
    if (!player.isBot) return { success: false, error: 'Player is not a bot' };

    room.players.delete(botId);
    return { success: true };
  }

  /** Set the room's max player count (e.g. from the selected game's meta). */
  setMaxPlayers(roomCode: string, maxPlayers: number): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (room) {
      room.maxPlayers = maxPlayers;
    }
  }

  setPlayerReady(playerId: string, isReady: boolean): void {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (player) {
      player.isReady = isReady;
    }
  }

  canStartGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    if (room.players.size < 2) return false;
    if (room.players.size > room.maxPlayers) return false;
    return [...room.players.values()].every((p) => p.isReady);
  }

  startGame(roomCode: string): LobbyPlayer[] | null {
    const room = this.rooms.get(roomCode);
    if (!room || !this.canStartGame(roomCode)) return null;

    room.status = 'playing';
    return [...room.players.values()];
  }

  resetGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return false;

    room.gameData = null;
    room.status = 'waiting';

    for (const player of room.players.values()) {
      player.isReady = player.isBot;
    }

    return true;
  }

  /** Mark every human player ready (used to re-ready after an explicit restart). */
  readyAllHumans(roomCode: string): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return;
    for (const player of room.players.values()) {
      player.isReady = true;
    }
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByPlayer(playerId: string): GameRoom | undefined {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  /** Resolve the stable playerId currently bound to a live socket. */
  getPlayerIdBySocket(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId);
  }

  addSpectator(code: string, socketId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    room.spectators.add(socketId);
    this.spectatorToRoom.set(socketId, code.toUpperCase());
    return { success: true };
  }

  removeSpectator(socketId: string): void {
    const code = this.spectatorToRoom.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (room) {
      room.spectators.delete(socketId);
    }
    this.spectatorToRoom.delete(socketId);
  }

  isSpectator(socketId: string): boolean {
    return this.spectatorToRoom.has(socketId);
  }

  getSpectatorsInRoom(roomCode: string): string[] {
    const room = this.rooms.get(roomCode);
    return room ? [...room.spectators] : [];
  }

  getPlayersInRoom(roomCode: string): LobbyPlayer[] {
    const room = this.rooms.get(roomCode);
    return room ? [...room.players.values()] : [];
  }

  isHost(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    return room?.hostId === playerId;
  }

  setGameId(roomCode: string, gameId: string | null): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (room) {
      room.gameId = gameId;
    }
  }

  getGameId(roomCode: string): string | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    return room?.gameId ?? null;
  }

  setGameData<T>(roomCode: string, data: T): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (room) {
      room.gameData = data;
    }
  }

  getGameData<T>(roomCode: string): T | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    return (room?.gameData as T) ?? null;
  }

  /**
   * Remove a player from its room entirely: clear any pending timer, reassign the
   * host among the remaining connected humans, and GC an empty / bot-only room.
   */
  private removePlayer(
    room: GameRoom,
    playerId: string,
  ): { wasHost: boolean; newHostId?: string; roomDestroyed: boolean } {
    const wasHost = room.hostId === playerId;
    room.players.delete(playerId);
    room.reconnectTokens.delete(playerId);
    this.playerToRoom.delete(playerId);
    this.clearDisconnectTimer(playerId);

    const humans = [...room.players.values()].filter((p) => !p.isBot);
    if (humans.length === 0) {
      // No humans left (empty or bot-only) — tear the room down.
      this.destroyRoom(room);
      return { wasHost, roomDestroyed: true };
    }

    let newHostId: string | undefined;
    if (wasHost) {
      const nextHost = humans.find((p) => p.connected) ?? humans[0];
      room.hostId = nextHost.id;
      newHostId = nextHost.id;
    }

    return { wasHost, newHostId, roomDestroyed: false };
  }

  /** Destroy a room, clearing every pending disconnect timer bound to its players. */
  private destroyRoom(room: GameRoom): void {
    for (const pid of room.players.keys()) {
      this.clearDisconnectTimer(pid);
      this.playerToRoom.delete(pid);
      room.reconnectTokens.delete(pid);
    }
    this.rooms.delete(room.code);
  }

  private clearDisconnectTimer(playerId: string): void {
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }
  }

  private scheduleDisconnectTimer(
    roomCode: string,
    playerId: string,
    onExpire?: (outcome: ExpiryOutcome) => void,
  ): void {
    this.clearDisconnectTimer(playerId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId);
      const outcome = this.expireDisconnectedPlayer(roomCode, playerId);
      if (outcome) onExpire?.(outcome);
    }, this.graceMs);
    // Do not keep the event loop alive purely for a grace timer.
    (timer as { unref?: () => void }).unref?.();
    this.disconnectTimers.set(playerId, timer);
  }

  private expireDisconnectedPlayer(roomCode: string, playerId: string): ExpiryOutcome | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.get(playerId);
    // Reconnected (or already gone) before the timer fired: nothing to do.
    if (!player || player.connected) return null;

    const wasInGame = room.status === 'playing';
    const { wasHost, newHostId, roomDestroyed } = this.removePlayer(room, playerId);
    return { roomCode, playerId, wasInGame, wasHost, newHostId, roomDestroyed };
  }

  handleDisconnect(
    socketId: string,
    onExpire?: (outcome: ExpiryOutcome) => void,
  ): DisconnectResult | null {
    // Spectator disconnect — immediate, no grace window.
    if (this.spectatorToRoom.has(socketId)) {
      const code = this.spectatorToRoom.get(socketId)!;
      const room = this.rooms.get(code);
      room?.spectators.delete(socketId);
      this.spectatorToRoom.delete(socketId);
      return {
        roomCode: code,
        playerId: socketId,
        wasHost: false,
        wasInGame: false,
        retained: false,
      };
    }

    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;
    this.socketToPlayer.delete(socketId);

    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;

    const player = room.players.get(playerId);
    const wasHost = room.hostId === playerId;
    const wasInGame = room.status === 'playing';

    if (!player) {
      return { roomCode: room.code, playerId, wasHost, wasInGame, retained: false };
    }

    // Keep the seat; mark disconnected and start the grace timer. Whether the room
    // is in a game or still in the lobby, removal now only happens on expiry.
    player.connected = false;
    this.scheduleDisconnectTimer(room.code, playerId, onExpire);

    return { roomCode: room.code, playerId, wasHost, wasInGame, retained: true };
  }

  /** Explicit leave: always removes the player immediately regardless of game status. */
  leaveRoom(socketId: string): DisconnectResult | null {
    if (this.spectatorToRoom.has(socketId)) {
      return this.handleDisconnect(socketId);
    }

    const playerId = this.socketToPlayer.get(socketId);
    if (!playerId) return null;
    this.socketToPlayer.delete(socketId);

    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;

    const wasInGame = room.status === 'playing';
    const { wasHost } = this.removePlayer(room, playerId);
    return { roomCode: room.code, playerId, wasHost, wasInGame, retained: false };
  }

  handleReconnect(
    roomCode: string,
    playerId: string,
    token: string,
    newSocketId: string,
  ): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return false;

    const player = room.players.get(playerId);
    if (!player) return false;

    const expected = room.reconnectTokens.get(playerId);
    if (!expected || expected !== token) return false;

    // Within the grace window: cancel the pending removal and restore the seat.
    this.clearDisconnectTimer(playerId);
    player.connected = true;
    this.socketToPlayer.set(newSocketId, playerId);
    return true;
  }

  getRoomCodeForPlayer(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }

  /**
   * Re-bind a new socket id to an existing player after Socket.io
   * `connectionStateRecovery` restored a briefly-dropped connection. This keeps
   * disconnect resolution and the grace timer consistent even before the client's
   * authoritative `player:reconnect` arrives. Returns false if the player is gone.
   */
  rebindSocket(socketId: string, playerId: string): boolean {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;

    this.clearDisconnectTimer(playerId);
    player.connected = true;
    this.socketToPlayer.set(socketId, playerId);
    return true;
  }
}
