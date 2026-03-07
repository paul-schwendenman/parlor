import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionData,
} from '@parlor/game-types';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
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
  return new Promise((resolve) => {
    socket.emit('lobby:create', playerName, (roomCode) => {
      resolve(roomCode);
    });
  });
}

export function joinRoom(
  socket: GameSocket,
  code: string,
  playerName: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit('lobby:join', code, playerName, (success, error) => {
      resolve({ success, error });
    });
  });
}
