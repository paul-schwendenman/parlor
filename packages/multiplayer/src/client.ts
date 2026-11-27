import { io, type Socket } from 'socket.io-client';
import type {
  GameClientEvents,
  GameId,
  ServerToClientEvents,
  SessionData,
} from '@parlor/game-types';

/**
 * A client socket. `game:action` accepts only game `Id`'s actions (plan 3.5):
 * the multi-game parlor client uses the default (every game), and each GameView
 * takes `GameSocket<'its-game-id'>`, so it cannot send another game's action.
 * Handing the parlor client's every-game socket to a GameView is sound: a socket
 * that accepts any game's action accepts that game's.
 */
export type GameSocket<Id extends GameId = GameId> = Socket<ServerToClientEvents, GameClientEvents<Id>>;

export {
  createParlorRuntime,
  type ParlorRuntime,
  type ParlorRuntimeAdapter,
  type RuntimeConnectionState,
  type RuntimeLobbyState,
  type RuntimeGameState,
  type RuntimePlayerState,
} from './clientRuntime.js';

export interface GameClientOptions {
  url?: string;
  autoReconnect?: boolean;
}

const SESSION_KEY = 'parlor-session';

export function createGameClient(options: GameClientOptions = {}): GameSocket {
  const { url, autoReconnect = true } = options;

  const socket: GameSocket = io(url ?? '', {
    autoConnect: true,
    reconnection: autoReconnect,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  return socket;
}

export function saveSession(data: SessionData): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession(): SessionData | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function createRoom(socket: GameSocket, playerName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.emit('lobby:create', playerName, (result, error) => {
      if (result) resolve(result.roomCode);
      else reject(new Error(error ?? 'Failed to create room'));
    });
  });
}

export function joinRoom(
  socket: GameSocket,
  code: string,
  playerName: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit('lobby:join', code, playerName, (result) => {
      resolve({ success: result.success, error: result.error });
    });
  });
}
