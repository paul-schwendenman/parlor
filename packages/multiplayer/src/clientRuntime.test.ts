import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createParlorRuntime, type ParlorRuntimeAdapter } from './clientRuntime.js';

// --- socket.io-client mock -------------------------------------------------

type Handler = (...args: unknown[]) => void;

interface MockSocket {
  id: string;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
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
      emit: vi.fn(),
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

function makeAdapter(overrides: Partial<ParlorRuntimeAdapter> = {}): ParlorRuntimeAdapter {
  return {
    browser: true,
    connectionState: {
      setConnected: vi.fn(),
      setDisconnected: vi.fn(),
      setReconnecting: vi.fn(),
      setError: vi.fn(),
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

    socket.trigger('connect_error');
    expect(adapter.connectionState.setError).toHaveBeenCalledWith('Unable to connect to server');

    socket.triggerManager('reconnect_attempt');
    expect(adapter.connectionState.setReconnecting).toHaveBeenCalledTimes(1);

    socket.triggerManager('reconnect_failed');
    expect(adapter.connectionState.setError).toHaveBeenCalledWith('Failed to reconnect to server');
  });

  it('attempts session restore only once across repeated connects (one-shot latch)', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' }),
    );
    const runtime = createParlorRuntime(makeAdapter({ restorePlayerOnReconnect: true }));
    runtime.getSocket();
    const socket = latestSocket();

    socket.trigger('connect');
    socket.trigger('connect');

    const reconnectEmits = socket.emit.mock.calls.filter((c) => c[0] === 'player:reconnect');
    expect(reconnectEmits).toHaveLength(1);
    expect(reconnectEmits[0].slice(0, 3)).toEqual(['player:reconnect', 'ABCD', 'p1']);
  });

  it('does not emit reconnect when there is no stored session', () => {
    const runtime = createParlorRuntime(makeAdapter());
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');
    expect(socket.emit.mock.calls.filter((c) => c[0] === 'player:reconnect')).toHaveLength(0);
  });

  it('restores playerState on reconnect success when restorePlayerOnReconnect is true', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' }),
    );
    const adapter = makeAdapter({ restorePlayerOnReconnect: true });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');

    const cb = socket.emit.mock.calls.find((c) => c[0] === 'player:reconnect')![3] as (
      s: boolean,
    ) => void;
    cb(true);

    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'socket-id-1',
      name: 'Ann',
      roomCode: 'ABCD',
    });
    expect(adapter.playerState.reset).not.toHaveBeenCalled();
  });

  it('does not restore playerState on success when restorePlayerOnReconnect is false', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' }),
    );
    const adapter = makeAdapter({ restorePlayerOnReconnect: false });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');

    const cb = socket.emit.mock.calls.find((c) => c[0] === 'player:reconnect')![3] as (
      s: boolean,
    ) => void;
    cb(true);

    expect(adapter.playerState.set).not.toHaveBeenCalled();
  });

  it('clears session and resets player on reconnect failure', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' }),
    );
    const adapter = makeAdapter({ restorePlayerOnReconnect: true });
    const runtime = createParlorRuntime(adapter);
    runtime.getSocket();
    const socket = latestSocket();
    socket.trigger('connect');

    const cb = socket.emit.mock.calls.find((c) => c[0] === 'player:reconnect')![3] as (
      s: boolean,
    ) => void;
    cb(false);

    expect(adapter.playerState.set).not.toHaveBeenCalled();
    expect(adapter.playerState.reset).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
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
        (rest[rest.length - 1] as (code: string) => void)('WXYZ');
      }
    });

    const code = await runtime.createRoomAction('Ann', 'crazy-eights');
    expect(code).toBe('WXYZ');
    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'socket-id-1',
      name: 'Ann',
      roomCode: 'WXYZ',
    });
    expect(adapter.lobbyState.setHost).toHaveBeenCalledWith('socket-id-1');
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
        (rest[rest.length - 1] as (ok: boolean, err?: string) => void)(true);
      }
    });

    const result = await runtime.joinRoomAction('abcd', 'Bob');
    expect(result).toEqual({ success: true, error: undefined });
    expect(adapter.playerState.set).toHaveBeenCalledWith({
      id: 'socket-id-1',
      name: 'Bob',
      roomCode: 'ABCD',
    });
  });

  it('disconnectSocket tears down and lets a fresh socket be created with the latch reset', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p1', playerName: 'Ann', roomCode: 'ABCD' }),
    );
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

    // Latch reset: the new socket attempts session restore again.
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ playerId: 'p2', playerName: 'Cy', roomCode: 'EFGH' }),
    );
    second.trigger('connect');
    expect(second.emit.mock.calls.filter((c) => c[0] === 'player:reconnect')).toHaveLength(1);
  });
});
