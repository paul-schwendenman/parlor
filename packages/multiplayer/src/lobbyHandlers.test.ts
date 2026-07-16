import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';

type Handler = (...args: unknown[]) => void;

function makeSocket(id: string) {
  const handlers: Record<string, Handler> = {};
  return {
    id,
    data: {} as { roomCode?: string; playerId?: string; playerName?: string },
    on: (event: string, cb: Handler) => {
      handlers[event] = cb;
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    fire: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

function makeIo() {
  const emitted: { room: string; event: string; args: unknown[] }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, ...args: unknown[]) => {
        emitted.push({ room, event, args });
      },
    }),
    emitted,
  };
  return io;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wire(rm: RoomManager, io: any, socket: any, callbacks?: LobbyCallbacks) {
  setupLobbyHandlers(io, socket, rm, callbacks);
}

describe('lobbyHandlers malformed payloads', () => {
  it('does not throw on a non-string create name', () => {
    const rm = new RoomManager();
    const io = makeIo();
    const socket = makeSocket('s1');
    wire(rm, io, socket);
    expect(() => socket.fire('lobby:create', 123, vi.fn())).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('does not throw on a null join name', () => {
    const rm = new RoomManager();
    const io = makeIo();
    const socket = makeSocket('s1');
    wire(rm, io, socket);
    const cb = vi.fn();
    expect(() => socket.fire('lobby:join', 'ROOM', null, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledWith({ success: false, error: expect.any(String) });
  });

  it('does not throw when join is missing arguments', () => {
    const rm = new RoomManager();
    const io = makeIo();
    const socket = makeSocket('s1');
    wire(rm, io, socket);
    expect(() => socket.fire('lobby:join')).not.toThrow();
  });

  it('does not throw on a non-boolean ready value', () => {
    const rm = new RoomManager();
    const io = makeIo();
    const host = makeSocket('s1');
    wire(rm, io, host);
    host.fire('lobby:create', 'Ann', vi.fn());
    const cb = vi.fn();
    expect(() => host.fire('lobby:ready', 'yes', cb)).not.toThrow();
    expect(cb).toHaveBeenCalledWith(false, expect.any(String));
  });
});

describe('lobbyHandlers host gates', () => {
  function twoPlayers(callbacks?: LobbyCallbacks) {
    const rm = new RoomManager();
    const io = makeIo();
    const host = makeSocket('s1');
    const guest = makeSocket('s2');
    wire(rm, io, host, callbacks);
    wire(rm, io, guest, callbacks);

    let roomCode = '';
    host.fire('lobby:create', 'Ann', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    return { rm, io, host, guest, roomCode };
  }

  it('rejects resetGame from a non-host', () => {
    const onGameReset = vi.fn();
    const { guest } = twoPlayers({ onGameReset });
    guest.fire('lobby:resetGame');
    expect(onGameReset).not.toHaveBeenCalled();
  });

  it('rejects restartGame from a non-host', () => {
    const onGameStart = vi.fn();
    const { guest } = twoPlayers({ onGameStart });
    guest.fire('lobby:restartGame');
    expect(onGameStart).not.toHaveBeenCalled();
  });

  it('restartGame from the host actually starts the game', () => {
    const onGameStart = vi.fn();
    const onGameReset = vi.fn();
    const { host, io } = twoPlayers({ onGameStart, onGameReset });
    host.fire('lobby:restartGame');
    expect(onGameReset).toHaveBeenCalledTimes(1);
    expect(onGameStart).toHaveBeenCalledTimes(1);
    expect(io.emitted.some((e) => e.event === 'lobby:gameStarting')).toBe(true);
  });
});

describe('lobbyHandlers disconnect grace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function twoPlayers(rm: RoomManager, callbacks?: LobbyCallbacks) {
    const io = makeIo();
    const host = makeSocket('s1');
    const guest = makeSocket('s2');
    wire(rm, io, host, callbacks);
    wire(rm, io, guest, callbacks);

    let roomCode = '';
    host.fire('lobby:create', 'Ann', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    return { io, host, guest, roomCode };
  }

  it('emits player:disconnected (not playerLeft) while retained, and playerLeft only on expiry', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const { io, guest } = twoPlayers(rm);
    const guestId = guest.data.playerId!;

    guest.fire('disconnect');

    // During grace: greyed out, still seated.
    expect(io.emitted.some((e) => e.event === 'player:disconnected' && e.args[0] === guestId)).toBe(
      true,
    );
    expect(io.emitted.some((e) => e.event === 'lobby:playerLeft')).toBe(false);
    expect(rm.getPlayersInRoom(guest.data.roomCode!).map((p) => p.id)).toContain(guestId);

    // After grace: really removed.
    vi.advanceTimersByTime(1_000);
    expect(io.emitted.some((e) => e.event === 'lobby:playerLeft' && e.args[0] === guestId)).toBe(
      true,
    );
    expect(rm.getPlayersInRoom(guest.data.roomCode!).map((p) => p.id)).not.toContain(guestId);
  });

  it('fires onPlayerRemoved and hostChanged when an in-game host expires', () => {
    vi.useFakeTimers();
    const onPlayerRemoved = vi.fn();
    const rm = new RoomManager(1_000);
    const { io, host, guest } = twoPlayers(rm, { onPlayerRemoved });
    const hostId = host.data.playerId!;
    const guestId = guest.data.playerId!;
    const roomCode = host.data.roomCode!;

    rm.setPlayerReady(hostId, true);
    rm.setPlayerReady(guestId, true);
    rm.startGame(roomCode);

    host.fire('disconnect');
    vi.advanceTimersByTime(1_000);

    expect(onPlayerRemoved).toHaveBeenCalledWith(roomCode, hostId, expect.anything());
    expect(io.emitted.some((e) => e.event === 'lobby:hostChanged' && e.args[0] === guestId)).toBe(
      true,
    );
  });
});

describe('lobbyHandlers room:leave', () => {
  it('removes the leaving player and broadcasts', () => {
    const rm = new RoomManager();
    const io = makeIo();
    const host = makeSocket('s1');
    const guest = makeSocket('s2');
    wire(rm, io, host);
    wire(rm, io, guest);

    let roomCode = '';
    host.fire('lobby:create', 'Ann', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    const guestPlayerId = guest.data.playerId;

    guest.fire('room:leave');

    const remaining = rm.getPlayersInRoom(roomCode);
    expect(remaining.map((p) => p.id)).not.toContain(guestPlayerId);
    expect(io.emitted.some((e) => e.event === 'lobby:playerLeft' && e.args[0] === guestPlayerId)).toBe(
      true,
    );
  });
});
