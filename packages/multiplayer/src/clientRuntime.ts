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
  /**
   * Optional: flip while a `player:reconnect` handshake is in flight so pages
   * can defer their "room not found" decision until the ack resolves.
   */
  setReconnectPending?(pending: boolean): void;
  /** Optional: surface a transient action failure (ack timeout / server reject). */
  setActionError?(message: string | null): void;
}

export interface RuntimeLobbyState {
  gameStarting: boolean;
  setLobbyState(players: LobbyPlayer[], canStart: boolean): void;
  setHost(hostId: string): void;
  setGameStarting(): void;
  setSelectedGame?(gameId: string | null): void;
  /** Optional: flip a single player's connected flag (grey out / restore during grace). */
  setPlayerConnected?(playerId: string, connected: boolean): void;
  reset(): void;
}

export interface RuntimeGameState {
  readonly view: unknown;
  setGameId?(gameId: string | null): void;
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
  selectGameAction(gameId: string | null): void;
  readyAction(isReady: boolean): void;
  startGameAction(): void;
  disconnectSocket(): void;
  /** HMR-safe teardown: drop the socket without clearing the persisted session. */
  teardown(): void;
}

/** Ack timeout (ms) applied to reconnect + lobby action emits. */
const ACK_TIMEOUT = 5000;

export function createParlorRuntime(adapter: ParlorRuntimeAdapter): ParlorRuntime {
  const { browser, connectionState, lobbyState, gameState, playerState } = adapter;

  let socket: GameSocket | null = null;
  // Per-connection auth latch: true once *this* connection has completed a
  // successful (or definitively-rejected) reconnect. Reset on every disconnect
  // and whenever a brand-new socket is built, so a fresh connection re-attempts.
  let authedForConnection = false;
  // Guards the connect/ack race: a second `connect` firing while an emit is
  // still awaiting its ack must not fire a duplicate `player:reconnect`.
  let reconnectInFlight = false;

  function attemptReconnect(): void {
    if (!socket) return;
    if (authedForConnection || reconnectInFlight) return;

    const session = loadSession();
    if (!session || !session.roomCode || !session.playerId) return;

    reconnectInFlight = true;
    connectionState.setReconnectPending?.(true);

    socket
      .timeout(ACK_TIMEOUT)
      .emit(
        'player:reconnect',
        session.roomCode,
        session.playerId,
        session.reconnectToken ?? '',
        (err: Error | null, success?: boolean) => {
          reconnectInFlight = false;
          connectionState.setReconnectPending?.(false);

          if (err) {
            // No ack (timeout): transient. Do NOT clear the session — leave the
            // per-connection latch open so the next `connect` retries.
            return;
          }

          if (success) {
            authedForConnection = true;
            // playerId is stable; re-persist to refresh the stored session.
            saveSession(session);
            if (adapter.restorePlayerOnReconnect) {
              playerState.set({
                id: session.playerId,
                name: session.playerName,
                roomCode: session.roomCode,
              });
            }
          } else {
            // Room/player genuinely gone: clear and stop retrying this room.
            authedForConnection = true;
            clearSession();
            playerState.reset();
          }
        },
      );
  }

  function getSocket(): GameSocket {
    if (!browser) {
      throw new Error('Socket can only be used in browser');
    }

    if (!socket) {
      socket = createGameClient({ autoReconnect: true });
      authedForConnection = false;
      reconnectInFlight = false;

      socket.on('connect', () => {
        connectionState.setConnected();
        // Attempt reconnect on EVERY connect (initial + every auto-reconnect),
        // guarded by the per-connection latch + in-flight flag above.
        attemptReconnect();
      });

      socket.on('disconnect', () => {
        // New connection coming: allow it to re-attempt reconnect.
        authedForConnection = false;
        reconnectInFlight = false;
        connectionState.setDisconnected();
      });

      // connect_error fires during reconnection attempts; it must NOT clobber
      // the 'reconnecting' status. Only reconnect_failed is terminal.
      socket.on('connect_error', () => {
        /* intentionally no status change */
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

      // Grace-window signals: authoritative connected flags also arrive via
      // `lobby:state`; these let a store grey a player out immediately.
      socket.on('player:disconnected', (playerId) => {
        lobbyState.setPlayerConnected?.(playerId, false);
      });

      socket.on('player:reconnected', (playerId) => {
        lobbyState.setPlayerConnected?.(playerId, true);
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

  /** Emit with an ack + timeout; surface failures via `setActionError`. */
  function emitWithAck(
    label: string,
    emit: (
      s: GameSocket,
      cb: (err: Error | null, success?: boolean, error?: string) => void,
    ) => void,
  ): void {
    const s = getSocket();
    connectionState.setActionError?.(null);
    emit(s, (err, success, error) => {
      if (err) {
        connectionState.setActionError?.(`${label} timed out — check your connection.`);
        return;
      }
      if (success === false) {
        connectionState.setActionError?.(error ?? `${label} failed.`);
      }
    });
  }

  function createRoomAction(playerName: string, gameId?: string): Promise<string> {
    const s = getSocket();
    return new Promise((resolve) => {
      s.emit('lobby:create', playerName, (result) => {
        const { roomCode, playerId, reconnectToken } = result;
        playerState.set({ id: playerId, name: playerName, roomCode });
        lobbyState.setHost(playerId);
        saveSession({ playerId, playerName, roomCode, reconnectToken });

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
      s.emit('lobby:join', roomCode, playerName, (result) => {
        const { success, error } = result;
        if (success && result.playerId) {
          const normalizedCode = result.roomCode ?? roomCode.toUpperCase();
          playerState.set({ id: result.playerId, name: playerName, roomCode: normalizedCode });
          saveSession({
            playerId: result.playerId,
            playerName,
            roomCode: normalizedCode,
            reconnectToken: result.reconnectToken,
          });
        }
        resolve({ success, error });
      });
    });
  }

  function selectGameAction(gameId: string | null): void {
    emitWithAck('Game selection', (s, cb) => {
      s.timeout(ACK_TIMEOUT).emit('lobby:selectGame', gameId, cb);
    });
  }

  function readyAction(isReady: boolean): void {
    emitWithAck('Ready', (s, cb) => {
      s.timeout(ACK_TIMEOUT).emit('lobby:ready', isReady, cb);
    });
  }

  function startGameAction(): void {
    emitWithAck('Start game', (s, cb) => {
      s.timeout(ACK_TIMEOUT).emit('lobby:startGame', cb);
    });
  }

  function teardown(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
      authedForConnection = false;
      reconnectInFlight = false;
    }
  }

  function disconnectSocket(): void {
    teardown();
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
    readyAction,
    startGameAction,
    disconnectSocket,
    teardown,
  };
}
