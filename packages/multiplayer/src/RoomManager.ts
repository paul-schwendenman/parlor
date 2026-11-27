import { secureRandomInt, type RandomInt } from './random.js';
import { randomUUID } from 'node:crypto';
import { MAX_BOTS, type GameMeta, type LobbyPlayer } from '@parlor/game-types';
import { GameInstance } from './gameInstance.js';
import { foldPlayerName } from './playerNames.js';
import { GameRuleError } from './errors.js';
import { logServerError, recordMetric } from './observability.js';
import { generateRoomCode } from './utils.js';

const MAX_ROOMS = 512;
const MAX_SPECTATORS = 16;
const ROOM_CODE_ATTEMPTS = 16;

type GameRules = Pick<GameMeta, 'id' | 'minPlayers' | 'maxPlayers' | 'supportsBots'>;

export interface GameRoom {
  code: string;
  hostId: string;
  players: Map<string, LobbyPlayer>;
  spectators: Set<string>;
  gameData: unknown;
  gameId: string | null;
  gameRules: GameRules | null;
  gameParticipants: Set<string>;
  defaultMaxPlayers: number;
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
  newHostId?: string;
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
  previousSeat: DisconnectResult | null;
}

export interface JoinRoomResult {
  success: boolean;
  error?: string;
  playerId?: string;
  reconnectToken?: string;
  previousSeat?: DisconnectResult | null;
  newHostId?: string;
}

export interface ReconnectResult {
  reconnectToken: string;
  supersededSocketId?: string;
  previousSeat: DisconnectResult | null;
  newHostId?: string;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private readonly instances = new WeakMap<GameRoom, GameInstance>();
  private readonly roomDestroyCallbacks = new WeakMap<GameRoom, () => void>();
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
  constructor(
    private readonly graceMs = 60_000,
    private readonly randomInt: RandomInt = secureRandomInt,
  ) {}

  static isBotPlayer(id: string): boolean {
    return id.startsWith('bot-');
  }

  createRoom(
    hostSocketId: string,
    hostName: string,
    maxPlayers = 8,
    onDestroyed?: (roomCode: string) => void,
  ): CreateRoomResult {
    if (this.rooms.size >= MAX_ROOMS) throw new GameRuleError('The server has reached its room limit');
    let code = generateRoomCode(undefined, this.randomInt);
    for (let attempt = 1; attempt < ROOM_CODE_ATTEMPTS && this.rooms.has(code); attempt++) {
      code = generateRoomCode(undefined, this.randomInt);
    }
    if (this.rooms.has(code)) throw new GameRuleError('Could not allocate a new room code. Try again.');

    const playerId = randomUUID();
    const reconnectToken = randomUUID();

    const host: LobbyPlayer = {
      id: playerId,
      name: hostName,
      connected: true,
      isReady: false,
      isBot: false,
    };

    const room: GameRoom = {
      code,
      hostId: playerId,
      players: new Map([[playerId, host]]),
      spectators: new Set(),
      gameData: null,
      gameId: null,
      gameRules: null,
      gameParticipants: new Set(),
      defaultMaxPlayers: maxPlayers,
      maxPlayers,
      status: 'waiting',
      createdAt: Date.now(),
      reconnectTokens: new Map([[playerId, reconnectToken]]),
    };
    this.rooms.set(code, room);
    recordMetric('rooms');
    if (onDestroyed) this.roomDestroyCallbacks.set(room, () => onDestroyed(code));

    this.playerToRoom.set(playerId, code);
    const previousSeat = this.replaceSeat(hostSocketId, playerId);
    return { roomCode: code, playerId, reconnectToken, previousSeat };
  }

  joinRoom(code: string, socketId: string, name: string): JoinRoomResult {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= room.maxPlayers) return { success: false, error: 'Room is full' };
    if (room.status !== 'waiting') return { success: false, error: 'Game already in progress' };

    const nameKey = foldPlayerName(name);
    const nameTaken = [...room.players.values()].some((player) => foldPlayerName(player.name) === nameKey);
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
    const previousSeat = this.replaceSeat(socketId, playerId);
    const newHostId = this.assignHostIfAbsent(room, playerId);
    return { success: true, playerId, reconnectToken, previousSeat, newHostId };
  }

  addBot(code: string, botName: string): { success: boolean; error?: string; botId?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.status !== 'waiting') {
      return { success: false, error: 'Bots can only join between games. Add one when you are back in the lobby.' };
    }
    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: 'The room is full. Remove a bot or a player to make space.' };
    }
    // With no game chosen yet (voting), bots may fill seats early; a game
    // without bot support is caught at selection/start instead.
    if (room.gameRules && !room.gameRules.supportsBots) {
      return { success: false, error: 'This game does not use bots. Invite someone instead, or choose another game.' };
    }

    const botCount = [...room.players.values()].filter((player) => player.isBot).length;
    if (botCount >= MAX_BOTS) {
      return { success: false, error: `A room can have ${MAX_BOTS} bots at most. Invite someone for the next seat.` };
    }

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
    if (room.status !== 'waiting') return { success: false, error: 'Game already in progress' };

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

  setPlayerReady(playerId: string, isReady: boolean): boolean {
    const room = this.getRoomByPlayer(playerId);
    if (!room || room.status !== 'waiting') return false;

    const player = room.players.get(playerId);
    if (!player?.connected) return false;
    player.isReady = isReady;
    return true;
  }

  canStartGame(roomCode: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || room.status !== 'waiting') return false;
    const players = [...room.players.values()];
    // Pressing START is the host's ready; every other seat must be connected and ready.
    return this.meetsGameRequirements(room, players)
      && players.every((p) => p.connected && (p.isReady || p.id === room.hostId));
  }

  startGame(roomCode: string, onFailure?: () => void): LobbyPlayer[] | null {
    const room = this.getRoom(roomCode);
    if (!room || !this.canStartGame(roomCode)) return null;

    return this.beginGame(room, [...room.players.values()], onFailure);
  }

  /** Validate before resetting or asking the game to clean up the old engine. */
  restartGame(roomCode: string, onReset: () => void, onFailure?: () => void): LobbyPlayer[] | null {
    const room = this.getRoom(roomCode);
    if (!room || room.status === 'waiting') return null;
    const players = [...room.players.values()].filter((player) => player.connected);
    if (!this.meetsGameRequirements(room, players)) return null;

    this.resetGame(roomCode);
    onReset();
    for (const player of players) player.isReady = true;
    return this.beginGame(room, players, onFailure);
  }

  private meetsGameRequirements(room: GameRoom, players: LobbyPlayer[]): boolean {
    const rules = room.gameRules;
    return !!rules && room.gameId === rules.id
      && players.length >= rules.minPlayers
      && players.length <= room.maxPlayers
      && players.length <= rules.maxPlayers
      && (!!rules.supportsBots || players.every((player) => !player.isBot));
  }

  private beginGame(room: GameRoom, players: LobbyPlayer[], onFailure?: () => void): LobbyPlayer[] {
    const instance = new GameInstance((error) => {
      recordMetric('caughtRoomFailures');
      logServerError('scheduled_game_task_failed', {
        roomCode: room.code, gameId: room.gameId, instanceId: instance.id,
      }, error);
      if (onFailure) onFailure();
      else this.resetGame(room.code);
    });
    this.instances.set(room, instance);
    room.status = 'playing';
    room.gameParticipants = new Set(players.map((player) => player.id));
    return players;
  }

  resetGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return false;

    this.invalidateGame(room);
    room.gameData = null;
    room.status = 'waiting';
    room.gameParticipants.clear();

    for (const player of room.players.values()) {
      player.isReady = player.isBot;
    }

    return true;
  }

  getGameInstance(roomCode: string): GameInstance | undefined {
    const room = this.getRoom(roomCode);
    return room && this.instances.get(room);
  }

  getErrorContext(roomCode?: string, playerId?: string) {
    const room = typeof roomCode === 'string' ? this.getRoom(roomCode) : undefined;
    return {
      roomCode: room?.code ?? roomCode,
      gameId: room?.gameId,
      playerId,
      instanceId: room && this.instances.get(room)?.id,
    };
  }

  private invalidateGame(room: GameRoom): void {
    const instance = this.instances.get(room);
    this.instances.delete(room);
    instance?.invalidate();
  }

  finishGame(roomCode: string, engine: unknown): void {
    const room = this.getRoom(roomCode);
    if (room?.status === 'playing' && room.gameData === engine) room.status = 'finished';
  }

  isGameParticipant(roomCode: string, playerId: string): boolean {
    return this.getRoom(roomCode)?.gameParticipants.has(playerId) ?? false;
  }

  getGamePlayers(roomCode: string): LobbyPlayer[] {
    const room = this.getRoom(roomCode);
    if (!room) return [];
    return [...room.players.values()].filter((player) => room.gameParticipants.has(player.id));
  }

  /** Grace seats excluded from a restart receive the same view as spectators if they return. */
  getGameSpectators(roomCode: string): string[] {
    const room = this.getRoom(roomCode);
    if (!room) return [];
    const returningPlayers = [...room.players.values()]
      .filter((player) => player.connected && !room.gameParticipants.has(player.id))
      .map((player) => player.id);
    return [...room.spectators, ...returningPlayers];
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

  addSpectator(code: string, socketId: string): { success: boolean; error?: string; previousSeat?: DisconnectResult | null } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };

    const oldRoomCode = this.spectatorToRoom.get(socketId);
    if (oldRoomCode === room.code) return { success: true };

    if (room.spectators.size >= MAX_SPECTATORS) {
      return { success: false, error: 'Room has reached its spectator limit' };
    }

    const previousPlayer = this.socketToPlayer.get(socketId);
    if (previousPlayer && room.players.has(previousPlayer) &&
      ![...room.players.values()].some((player) => !player.isBot && player.id !== previousPlayer)) {
      return { success: false, error: 'The last player cannot spectate their own room' };
    }

    room.spectators.add(socketId);
    this.spectatorToRoom.set(socketId, room.code);
    this.socketToPlayer.delete(socketId);
    const previousSeat = this.releaseSeat(socketId, previousPlayer, oldRoomCode);
    return { success: true, previousSeat };
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

  /**
   * True when `playerId` holds a human seat in `roomCode`. With `socketId`, also
   * requires that socket to be bound to that player and not to be a spectator,
   * so a socket can't act for a seat it doesn't own.
   */
  isSeatedPlayer(roomCode: string, playerId: string | undefined, socketId?: string): boolean {
    if (!playerId) return false;
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room || !room.players.has(playerId)) return false;
    if (RoomManager.isBotPlayer(playerId)) return false;
    if (this.playerToRoom.get(playerId) !== code) return false;
    if (socketId !== undefined) {
      if (this.spectatorToRoom.has(socketId)) return false;
      if (this.socketToPlayer.get(socketId) !== playerId) return false;
    }
    return true;
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

  selectGame(roomCode: string, rules: GameRules | null): boolean {
    const room = this.getRoom(roomCode);
    if (!room || room.status !== 'waiting' || (rules && room.players.size > rules.maxPlayers)) return false;
    if (room.gameId !== (rules?.id ?? null)) this.invalidateGame(room);
    room.gameId = rules?.id ?? null;
    room.gameRules = rules;
    room.maxPlayers = rules?.maxPlayers ?? room.defaultMaxPlayers;
    return true;
  }

  getGameId(roomCode: string): string | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    return room?.gameId ?? null;
  }

  /**
   * Record the running game's state. The core only compares it by identity
   * (is this still the game that started?); typed access goes through the
   * game definition's `typed.getState()`.
   */
  setGameData(roomCode: string, data: unknown): void {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (room) {
      room.gameData = data;
    }
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
    const context = this.getErrorContext(room.code);
    this.invalidateGame(room);
    const onDestroyed = this.roomDestroyCallbacks.get(room);
    this.roomDestroyCallbacks.delete(room);
    try {
      onDestroyed?.();
    } catch (error) {
      recordMetric('caughtRoomFailures');
      logServerError('room_destroy_callback_failed', context, error);
    }
    for (const pid of room.players.keys()) {
      this.clearDisconnectTimer(pid);
      this.playerToRoom.delete(pid);
      room.reconnectTokens.delete(pid);
    }
    for (const socketId of room.spectators) {
      if (this.spectatorToRoom.get(socketId) === room.code) {
        this.spectatorToRoom.delete(socketId);
      }
    }
    this.rooms.delete(room.code);
    recordMetric('rooms', -1);
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
    const nextHost = wasHost && [...room.players.values()].find((p) => !p.isBot && p.connected);
    if (nextHost) room.hostId = nextHost.id;
    this.scheduleDisconnectTimer(room.code, playerId, onExpire);

    return { roomCode: room.code, playerId, wasHost, wasInGame, retained: true, newHostId: nextHost ? nextHost.id : undefined };
  }

  /** Explicit leave: always removes the player immediately regardless of game status. */
  leaveRoom(socketId: string): DisconnectResult | null {
    const playerId = this.socketToPlayer.get(socketId);
    const spectatorRoomCode = this.spectatorToRoom.get(socketId);
    this.socketToPlayer.delete(socketId);
    this.spectatorToRoom.delete(socketId);
    return this.releaseSeat(socketId, playerId, spectatorRoomCode);
  }

  private replaceSeat(socketId: string, playerId: string): DisconnectResult | null {
    const previousPlayer = this.socketToPlayer.get(socketId);
    const spectatorRoomCode = this.spectatorToRoom.get(socketId);
    this.socketToPlayer.set(socketId, playerId);
    this.spectatorToRoom.delete(socketId);
    if (previousPlayer === playerId) return null;
    return this.releaseSeat(socketId, previousPlayer, spectatorRoomCode);
  }

  private releaseSeat(
    socketId: string,
    playerId: string | undefined,
    spectatorRoomCode: string | undefined,
  ): DisconnectResult | null {
    if (spectatorRoomCode) {
      this.rooms.get(spectatorRoomCode)?.spectators.delete(socketId);
      return { roomCode: spectatorRoomCode, playerId: socketId, wasHost: false, wasInGame: false, retained: false };
    }
    if (!playerId) return null;
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;

    const wasInGame = room.status === 'playing';
    const { wasHost, newHostId } = this.removePlayer(room, playerId);
    return { roomCode: room.code, playerId, wasHost, wasInGame, retained: false, newHostId };
  }

  handleReconnect(
    roomCode: string,
    playerId: string,
    token: string,
    newSocketId: string,
  ): ReconnectResult | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    const player = room?.players.get(playerId);
    if (!room || !player || room.reconnectTokens.get(playerId) !== token) return null;

    let supersededSocketId: string | undefined;
    for (const [socketId, boundPlayerId] of this.socketToPlayer) {
      if (boundPlayerId === playerId && socketId !== newSocketId) {
        this.socketToPlayer.delete(socketId);
        supersededSocketId = socketId;
        break;
      }
    }

    const reconnectToken = randomUUID();
    room.reconnectTokens.set(playerId, reconnectToken);
    this.clearDisconnectTimer(playerId);
    player.connected = true;
    const previousSeat = this.replaceSeat(newSocketId, playerId);

    const newHostId = this.assignHostIfAbsent(room, playerId);
    return { reconnectToken, supersededSocketId, previousSeat, newHostId };
  }

  private assignHostIfAbsent(room: GameRoom, playerId: string): string | undefined {
    if (room.players.get(room.hostId)?.connected) return undefined;
    room.hostId = playerId;
    return playerId;
  }

  getRoomCodeForPlayer(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }
}
