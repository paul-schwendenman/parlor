import type { LobbyPlayer } from '@parlor/game-types';
import { generateRoomCode } from './utils.js';

export interface GameRoom {
  code: string;
  hostId: string;
  players: Map<string, LobbyPlayer>;
  gameData: unknown;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

export interface DisconnectResult {
  roomCode: string;
  wasHost: boolean;
  wasInGame: boolean;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private playerToRoom = new Map<string, string>();

  createRoom(hostSocketId: string, hostName: string, maxPlayers = 8): string {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const host: LobbyPlayer = {
      id: hostSocketId,
      name: hostName,
      connected: true,
      isReady: false,
    };

    this.rooms.set(code, {
      code,
      hostId: hostSocketId,
      players: new Map([[hostSocketId, host]]),
      gameData: null,
      maxPlayers,
      status: 'waiting',
      createdAt: Date.now(),
    });

    this.playerToRoom.set(hostSocketId, code);
    return code;
  }

  joinRoom(code: string, socketId: string, name: string): { success: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.players.size >= room.maxPlayers) return { success: false, error: 'Room is full' };
    if (room.status !== 'waiting') return { success: false, error: 'Game already in progress' };

    const nameTaken = [...room.players.values()].some(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (nameTaken) return { success: false, error: 'Name already taken in this room' };

    const player: LobbyPlayer = {
      id: socketId,
      name,
      connected: true,
      isReady: false,
    };
    room.players.set(socketId, player);
    this.playerToRoom.set(socketId, code.toUpperCase());
    return { success: true };
  }

  setPlayerReady(socketId: string, isReady: boolean): void {
    const room = this.getRoomByPlayer(socketId);
    if (!room) return;

    const player = room.players.get(socketId);
    if (player) {
      player.isReady = isReady;
    }
  }

  canStartGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    if (room.players.size < 2) return false;
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
      player.isReady = false;
    }

    return true;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByPlayer(socketId: string): GameRoom | undefined {
    const code = this.playerToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  getPlayersInRoom(roomCode: string): LobbyPlayer[] {
    const room = this.rooms.get(roomCode);
    return room ? [...room.players.values()] : [];
  }

  isHost(roomCode: string, socketId: string): boolean {
    const room = this.rooms.get(roomCode);
    return room?.hostId === socketId;
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

  handleDisconnect(socketId: string): DisconnectResult | null {
    const room = this.getRoomByPlayer(socketId);
    if (!room) return null;

    const player = room.players.get(socketId);
    const wasHost = room.hostId === socketId;
    const wasInGame = room.status === 'playing';

    if (player) {
      if (wasInGame) {
        player.connected = false;
      } else {
        room.players.delete(socketId);
        this.playerToRoom.delete(socketId);

        if (wasHost && room.players.size > 0) {
          room.hostId = [...room.players.values()][0].id;
        }
      }
    }

    if (room.players.size === 0) {
      this.rooms.delete(room.code);
    }

    return { roomCode: room.code, wasHost, wasInGame };
  }

  handleReconnect(roomCode: string, oldPlayerId: string, newSocketId: string): boolean {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return false;

    const player = room.players.get(oldPlayerId);
    if (!player || player.connected) return false;

    room.players.delete(oldPlayerId);
    player.id = newSocketId;
    player.connected = true;
    room.players.set(newSocketId, player);

    this.playerToRoom.delete(oldPlayerId);
    this.playerToRoom.set(newSocketId, roomCode.toUpperCase());

    if (room.hostId === oldPlayerId) {
      room.hostId = newSocketId;
    }

    return true;
  }

  getRoomCodeForPlayer(socketId: string): string | undefined {
    return this.playerToRoom.get(socketId);
  }
}
