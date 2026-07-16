import type { LobbyPlayer } from '@parlor/game-types';
import {
  createGameClient,
  saveSession,
  loadSession,
  clearSession,
  type GameSocket,
} from './client.js';

/**
 * Adapter interfaces describe the minimal surface the runtime needs from each
 * app's runes-based stores. The concrete store classes (per app / per game)
 * satisfy these structurally.
 */
export interface RuntimeConnectionState {
  setConnected(): void;
  setDisconnected(): void;
  setReconnecting(): void;
  setError(message: string): void;
}

export interface RuntimeLobbyState {
  gameStarting: boolean;
  setLobbyState(players: LobbyPlayer[], canStart: boolean): void;
  setHost(hostId: string): void;
  setGameStarting(): void;
  setSelectedGame?(gameId: string): void;
  reset(): void;
}

export interface RuntimeGameState {
  readonly view: unknown;
  setGameId?(gameId: string): void;
  reset(): void;
}

export interface RuntimePlayerState {
  set(data: { id: string; name: string; roomCode: string }): void;
  reset(): void;
}

export interface ParlorRuntimeAdapter {
  /** Whether we are running in the browser (SvelteKit `$app/environment` `browser`). */
  browser: boolean;
  connectionState: RuntimeConnectionState;
  lobbyState: RuntimeLobbyState;
  gameState: RuntimeGameState;
  playerState: RuntimePlayerState;
  /** Applies an incoming `game:state` payload to the game store (per-app cast). */
  onView: (state: unknown) => void;
  /**
   * When true, restore `playerState` on a successful `player:reconnect`
   * (parlor / liars-dice / booty-dice behavior). When false/omitted, a
   * successful reconnect leaves `playerState` untouched (crazy-eights / quixx /
   * kings-corner behavior).
   */
  restorePlayerOnReconnect?: boolean;
  /**
   * When true, wire multi-game selection: register the `lobby:gameSelected`
   * handler, honor the optional `gameId` in `createRoomAction`, and make
   * `selectGameAction` emit. Parlor only.
   */
  enableGameSelection?: boolean;
}

export interface ParlorRuntime {
  getSocket(): GameSocket;
  createRoomAction(playerName: string, gameId?: string): Promise<string>;
  joinRoomAction(
    roomCode: string,
    playerName: string,
  ): Promise<{ success: boolean; error?: string }>;
  selectGameAction(gameId: string): void;
  disconnectSocket(): void;
}

export function createParlorRuntime(adapter: ParlorRuntimeAdapter): ParlorRuntime {
  const { browser, connectionState, lobbyState, gameState, playerState } = adapter;

  let socket: GameSocket | null = null;
  let reconnectAttempted = false;

  function getSocket(): GameSocket {
    if (!browser) {
      throw new Error('Socket can only be used in browser');
    }

    if (!socket) {
      socket = createGameClient({ autoReconnect: true });

      socket.on('connect', () => {
        connectionState.setConnected();

        if (reconnectAttempted) return;
        reconnectAttempted = true;

        const session = loadSession();
        if (session && session.roomCode && session.playerId) {
          socket?.emit('player:reconnect', session.roomCode, session.playerId, (success) => {
            if (success) {
              if (adapter.restorePlayerOnReconnect) {
                playerState.set({
                  id: socket!.id!,
                  name: session.playerName!,
                  roomCode: session.roomCode!,
                });
              }
            } else {
              clearSession();
              playerState.reset();
            }
          });
        }
      });

      socket.on('disconnect', () => {
        connectionState.setDisconnected();
      });

      socket.on('connect_error', () => {
        connectionState.setError('Unable to connect to server');
      });

      socket.io.on('reconnect_attempt', () => {
        connectionState.setReconnecting();
      });

      socket.io.on('reconnect_failed', () => {
        connectionState.setError('Failed to reconnect to server');
      });

      // Lobby events
      socket.on('lobby:state', (players, canStart) => {
        // If we had an active game and receive lobby state, the game was reset
        if (gameState.view && lobbyState.gameStarting) {
          gameState.reset();
          lobbyState.gameStarting = false;
        }
        lobbyState.setLobbyState(players, canStart);
      });

      socket.on('lobby:hostChanged', (newHostId) => {
        lobbyState.setHost(newHostId);
      });

      socket.on('lobby:gameStarting', () => {
        lobbyState.setGameStarting();
      });

      // Game selection event (multi-game apps only)
      if (adapter.enableGameSelection) {
        socket.on('lobby:gameSelected', (gameId) => {
          lobbyState.setSelectedGame?.(gameId);
          gameState.setGameId?.(gameId);
        });
      }

      // Game events - each app applies its own view shape
      socket.on('game:state', (state) => {
        adapter.onView(state);
      });

      socket.on('error', (message) => {
        console.error('Server error:', message);
      });
    }

    return socket;
  }

  function createRoomAction(playerName: string, gameId?: string): Promise<string> {
    const s = getSocket();
    return new Promise((resolve) => {
      s.emit('lobby:create', playerName, (roomCode) => {
        playerState.set({ id: s.id!, name: playerName, roomCode });
        lobbyState.setHost(s.id!);
        saveSession({ playerId: s.id!, playerName, roomCode });

        // If a game was pre-selected, select it
        if (adapter.enableGameSelection && gameId) {
          s.emit('lobby:selectGame', gameId);
          lobbyState.setSelectedGame?.(gameId);
          gameState.setGameId?.(gameId);
        }

        resolve(roomCode);
      });
    });
  }

  function joinRoomAction(
    roomCode: string,
    playerName: string,
  ): Promise<{ success: boolean; error?: string }> {
    const s = getSocket();
    return new Promise((resolve) => {
      s.emit('lobby:join', roomCode, playerName, (success, error) => {
        if (success) {
          const normalizedCode = roomCode.toUpperCase();
          playerState.set({ id: s.id!, name: playerName, roomCode: normalizedCode });
          saveSession({ playerId: s.id!, playerName, roomCode: normalizedCode });
        }
        resolve({ success, error });
      });
    });
  }

  function selectGameAction(gameId: string): void {
    const s = getSocket();
    s.emit('lobby:selectGame', gameId);
  }

  function disconnectSocket(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
      reconnectAttempted = false;
    }
    clearSession();
    playerState.reset();
    lobbyState.reset();
    gameState.reset();
  }

  return {
    getSocket,
    createRoomAction,
    joinRoomAction,
    selectGameAction,
    disconnectSocket,
  };
}
