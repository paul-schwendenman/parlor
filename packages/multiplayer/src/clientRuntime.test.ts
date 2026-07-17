import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createParlorRuntime, type ParlorRuntimeAdapter } from './clientRuntime.js';

// --- socket.io-client mock -------------------------------------------------

type Handler = (...args: unknown[]) => void;

interface MockSocket {
  id: string;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  timeout: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  io: { on: ReturnType<typeof vi.fn> };
  trigger(event: string, ...args: unknown[]): void;
  triggerManager(event: string, ...args: unknown[]): void;
}

const { ioMock, sockets } = vi.hoisted(() => {
  const sockets: MockSocket[] = [];
  const ioMock = vi.fn(() => {
    const socketHandlers: Record<string, Handler[]> = {};
    const managerHandlers: Record<string, Handler[]> = {};
    const socket: MockSocket = {
      id: 'socket-id-1',
      on: vi.fn((event: string, cb: Handler) => {
        (socketHandlers[event] ||= []).push(cb);
      }),
      // Both plain `.emit(...)` and `.timeout(ms).emit(...)` route through this
      // one mock so tests can inspect all emits uniformly.
      emit: vi.fn(),
      timeout: vi.fn(() => ({ emit: socket.emit })),
      disconnect: vi.fn(),
      io: {
        on: vi.fn((event: string, cb: Handler) => {
          (managerHandlers[event] ||= []).push(cb);
        }),
      },
      trigger: (event, ...args) => (socketHandlers[event] || []).forEach((cb) => cb(...args)),
      triggerManager: (event, ...args) =>
        (managerHandlers[event] || []).forEach((cb) => cb(...args)),
    };
    sockets.push(socket);
    return socket;
  });
  return { ioMock, sockets };
});

vi.mock('socket.io-client', () => ({ io: ioMock }));

// --- helpers ---------------------------------------------------------------

function latestSocket(): MockSocket {
  return sockets[sockets.length - 1];
}

/** Pull the (success) ack callback from the last player:reconnect emit. */
function reconnectCb(socket: MockSocket): (success: boolean) => void {
  const calls = socket.emit.mock.calls.filter((c) => c[0] === 'player:reconnect');
  const last = calls[calls.length - 1];
  return last[last.length - 1] as (success: boolean) => void;
}

/** Pull the (success, error) ack from the last emit of the given event. */
function ackOf(socket: MockSocket, event: string): (success: boolean, error?: string) => void {
  const call = socket.emit.mock.calls.find((c) => c[0] === event)!;
  return call[call.length - 1] as (success: boolean, error?: string) => void;
}

function reconnectEmits(socket: MockSocket): unknown[][] {
  return socket.emit.mock.calls.filter((c) => c[0] === 'player:reconnect');
}

function makeAdapter(overrides: Partial<ParlorRuntimeAdapter> = {}): ParlorRuntimeAdapter {
  return {
    browser: true,
    connectionState: {
      setConnected: vi.fn(),
      setDisconnected: vi.fn(),
      setReconnecting: vi.fn(),
      setError: vi.fn(),
      setReconnectPending: vi.fn(),
      setActionError: vi.fn(),
    },
    lobbyState: {
      gameStarting: false,
      setLobbyState: vi.fn(),
      setHost: vi.fn(),
      setGameStarting: vi.fn(),
      setSelectedGame: vi.fn(),
      reset: vi.fn(),
    },
    gameState: {
      view: null,
      setGameId: vi.fn(),
      reset: vi.fn(),
    },
    playerState: {
      set: vi.fn(),
      reset: vi.fn(),
    },
    onView: vi.fn(),
    ...overrides,
  };
}

// Minimal in-memory localStorage so session helpers are exercised.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const SESSION_KEY = 'parlor-session';

function storeSession(
  data: Record<string, string> = { playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' },
): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

beforeEach(() => {
  ioMock.mockClear();
  sockets.length = 0;
  installLocalStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('createParlorRuntime', () => {
  it('is a singleton: getSocket creates the socket once', () => {
    const runtime = createParlorRuntime(makeAdapter());
    const a = runtime.getSocket();
    const b = runtime.getSocket();
    expect(a).toBe(b);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('throws when not in the browser', () => {
    const runtime = createParlorRuntime(makeAdapter({ browser: false }));
    expect(() => runtime.getSocket()).toThrow('Socket can only be used in browser');
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('drives connection status transitions', () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();

    socket.trigger('connect');
    expect(adapter.connectionState.setConnected).toHaveBeenCalledTimes(1);

    socket.trigger('disconnect');
    expect(adapter.connectionState.setDisconnected).toHaveBeenCalledTimes(1);

    socket.triggerManager('reconnect_attempt');
    expect(adapter.connectionState.setReconnecting).toHaveBeenCalledTimes(1);

    socket.triggerManager('reconnect_failed');
    expect(adapter.connectionState.setError).toHaveBeenCalledWith('Failed to reconnect to server');
  });

  it('connect_error does NOT clobber status (no setError call)', () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    latestSocket().trigger('connect_error');
    expect(adapter.connectionState.setError).not.toHaveBeenCalled();
  });

  it('re-emits player:reconnect on EVERY connect (not just the first)', () => {
    storeSession();
    const runtime = createParlorRuntime(makeAdapter({ restorePlayerOnReconnect: true }));
    runtime.getSocket();
    const socket = latestSocket();

    // First connection: emit + settle, then disconnect resets the per-conn latch.
    socket.trigger('connect');
    reconnectCb(socket)(true);
    socket.trigger('disconnect');

    // Second connection re-emits.
    socket.trigger('connect');

    const emits = reconnectEmits(socket);
    expect(emits).toHaveLength(2);
    // token is passed through as the 3rd positional arg.
    expect(emits[0].slice(0, 4)).toEqual(['player:reconnect', 'ABCD', 'p1', '']);
  });

  it('passes the stored reconnect token', () => {
    storeSession({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD', reconnectToken: 'tok-9' });
    const runtime = createParlorRuntime(makeAdapter());
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    expect(reconnectEmits(socket)[0].slice(0, 4)).toEqual(['player:reconnect', 'ABCD', 'p1', 'tok-9']);
  });

  it('guards against double-emit while an ack is pending (race)', () => {
    storeSession();
    const runtime = createParlorRuntime(makeAdapter());
    runtime.getSocket();
    const socket = latestSocket();

    // Two connects with no ack in between must not double-emit.
    socket.trigger('connect');
    socket.trigger('connect');
    expect(reconnectEmits(socket)).toHaveLength(1);
  });

  it('does not emit reconnect when there is no stored session', () => {
    const runtime = createParlorRuntime(makeAdapter());
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    expect(reconnectEmits(socket)).toHaveLength(0);
  });

  it('toggles reconnectPending around the handshake', () => {
    storeSession();
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();

    socket.trigger('connect');
    expect(adapter.connectionState.setReconnectPending).toHaveBeenCalledWith(true);

    reconnectCb(socket)(true);
    expect(adapter.connectionState.setReconnectPending).toHaveBeenLastCalledWith(false);
  });

  it('re-saves the session on reconnect success', () => {
    storeSession();
    const adapter = makeAdapter({ restorePlayerOnReconnect: true });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    reconnectCb(socket)(true);

    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Ann',
      roomCode: 'ABCD',
    });
    expect(localStorage.getItem(SESSION_KEY)).toContain('ABCD');
    expect(adapter.playerState.reset).not.toHaveBeenCalled();
  });

  it('does not restore playerState on success when restorePlayerOnReconnect is false', () => {
    storeSession();
    const adapter = makeAdapter({ restorePlayerOnReconnect: false });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    reconnectCb(socket)(true);
    expect(adapter.playerState.set).not.toHaveBeenCalled();
  });

  it('room-gone rejection clears the session and resets player', () => {
    storeSession();
    const adapter = makeAdapter({ restorePlayerOnReconnect: true });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    reconnectCb(socket)(false);

    expect(adapter.playerState.set).not.toHaveBeenCalled();
    expect(adapter.playerState.reset).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('ack timeout does NOT clear the session and retries on the next connect', () => {
    vi.useFakeTimers();
    try {
      storeSession();
      const adapter = makeAdapter({ restorePlayerOnReconnect: true });
      const runtime = createParlorRuntime(adapter);
      runtime.getSocket();
      const socket = latestSocket();

      socket.trigger('connect');
      // No ack arrives; the manual timeout fires.
      vi.advanceTimersByTime(5000);

      expect(adapter.playerState.reset).not.toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).toContain('ABCD');
      expect(adapter.connectionState.setReconnectPending).toHaveBeenLastCalledWith(false);

      // Latch stayed open: a reconnect (disconnect + connect) retries.
      socket.trigger('disconnect');
      socket.trigger('connect');
      expect(reconnectEmits(socket)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('registers lobby:gameSelected only when game selection is enabled', () => {
    const withSel = createParlorRuntime(makeAdapter({ enableGameSelection: true }));
    withSel.getSocket();
    const registered = latestSocket().on.mock.calls.map((c) => c[0]);
    expect(registered).toContain('lobby:gameSelected');

    sockets.length = 0;
    ioMock.mockClear();

    const withoutSel = createParlorRuntime(makeAdapter());
    withoutSel.getSocket();
    const registered2 = latestSocket().on.mock.calls.map((c) => c[0]);
    expect(registered2).not.toContain('lobby:gameSelected');
  });

  it('selectGameAction(null) emits a null selection with an ack callback', () => {
    const runtime = createParlorRuntime(makeAdapter({ enableGameSelection: true }));
    runtime.getSocket();
    const socket = latestSocket();
    runtime.selectGameAction(null);
    const call = socket.emit.mock.calls.find((c) => c[0] === 'lobby:selectGame');
    expect(call).toBeDefined();
    expect(call![1]).toBeNull();
    expect(typeof call![2]).toBe('function');
  });

  it('readyAction surfaces an actionError on ack timeout', () => {
    vi.useFakeTimers();
    try {
      const adapter = makeAdapter();
      const runtime = createParlorRuntime(adapter);
      runtime.getSocket();
      runtime.readyAction(true);
      vi.advanceTimersByTime(5000);
      expect(adapter.connectionState.setActionError).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('readyAction clears any prior actionError before emitting', () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    runtime.readyAction(true);
    expect(adapter.connectionState.setActionError).toHaveBeenCalledWith(null);
  });

  it('startGameAction surfaces a server rejection message', () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    runtime.startGameAction();
    ackOf(socket, 'lobby:startGame')(false, 'Cannot start the game yet');
    expect(adapter.connectionState.setActionError).toHaveBeenCalledWith('Cannot start the game yet');
  });

  it('resets game view when lobby:state arrives during gameStarting', () => {
    const adapter = makeAdapter();
    adapter.gameState = { view: { some: 'view' }, setGameId: vi.fn(), reset: vi.fn() };
    adapter.lobbyState.gameStarting = true;
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();

    socket.trigger('lobby:state', [], false);

    expect(adapter.gameState.reset).toHaveBeenCalledTimes(1);
    expect(adapter.lobbyState.gameStarting).toBe(false);
    expect(adapter.lobbyState.setLobbyState).toHaveBeenCalledWith([], false);
  });

  it('applies incoming game:state via onView', () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    latestSocket().trigger('game:state', { hello: 'world' });
    expect(adapter.onView).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('createRoomAction stores session and selects a pre-chosen game when enabled', async () => {
    const adapter = makeAdapter({ enableGameSelection: true });
    const runtime = createParlorRuntime(adapter);
    const socket = (() => {
      runtime.getSocket();
      return latestSocket();
    })();
    socket.emit.mockImplementation((event: string, ...rest: unknown[]) => {
      if (event === 'lobby:create') {
        (
          rest.find((r) => typeof r === 'function') as (result: {
            roomCode: string;
            playerId: string;
            reconnectToken: string;
          }) => void
        )({ roomCode: 'WXYZ', playerId: 'server-pid', reconnectToken: 'tok-1' });
      }
    });

    const code = await runtime.createRoomAction('Ann', 'crazy-eights');
    expect(code).toBe('WXYZ');
    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'server-pid',
      name: 'Ann',
      roomCode: 'WXYZ',
    });
    expect(adapter.lobbyState.setHost).toHaveBeenCalledWith('server-pid');
    expect(socket.emit).toHaveBeenCalledWith('lobby:selectGame', 'crazy-eights');
    expect(adapter.gameState.setGameId).toHaveBeenCalledWith('crazy-eights');
    expect(localStorage.getItem(SESSION_KEY)).toContain('WXYZ');
  });

  it('joinRoomAction normalizes the room code and stores session on success', async () => {
    const adapter = makeAdapter();
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.emit.mockImplementation((event: string, ...rest: unknown[]) => {
      if (event === 'lobby:join') {
        (
          rest[rest.length - 1] as (result: {
            success: boolean;
            error?: string;
            roomCode?: string;
            playerId?: string;
            reconnectToken?: string;
          }) => void
        )({ success: true, roomCode: 'ABCD', playerId: 'server-pid', reconnectToken: 'tok-2' });
      }
    });

    const result = await runtime.joinRoomAction('abcd', 'Bob');
    expect(result).toEqual({ success: true, error: undefined });
    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'server-pid',
      name: 'Bob',
      roomCode: 'ABCD',
    });
  });

  it('disconnectSocket tears down and lets a fresh socket re-attempt reconnect', () => {
    storeSession();
    const adapter = makeAdapter({ restorePlayerOnReconnect: true });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const first = latestSocket();
    first.trigger('connect');

    runtime.disconnectSocket();
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(adapter.playerState.reset).toHaveBeenCalled();
    expect(adapter.lobbyState.reset).toHaveBeenCalled();
    expect(adapter.gameState.reset).toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();

    // A new getSocket builds a brand new socket (io called again).
    runtime.getSocket();
    expect(ioMock).toHaveBeenCalledTimes(2);
    const second = latestSocket();
    expect(second).not.toBe(first);

    // Fresh socket re-attempts session restore.
    storeSession({ playerId: 'p2', playerName: 'Cy', roomCode: 'EFGH' });
    second.trigger('connect');
    expect(reconnectEmits(second)).toHaveLength(1);
  });

  it('teardown drops the socket without clearing the session (HMR-safe)', () => {
    storeSession();
    const runtime = createParlorRuntime(makeAdapter());
    runtime.getSocket();
    const first = latestSocket();

    runtime.teardown();
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_KEY)).toContain('ABCD');

    runtime.getSocket();
    expect(ioMock).toHaveBeenCalledTimes(2);
  });
});
