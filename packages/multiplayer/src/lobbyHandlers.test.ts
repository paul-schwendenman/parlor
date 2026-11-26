import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';

const gameRules = { id: 'test', minPlayers: 2, maxPlayers: 4, supportsBots: true };

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

  it('rejects restart from waiting and accepts a subsequent valid start', () => {
    const onGameStart = vi.fn();
    const onGameReset = vi.fn();
    const { rm, host, guest, roomCode } = twoPlayers({ onGameStart, onGameReset });
    rm.selectGame(roomCode, gameRules);
    host.fire('lobby:restartGame');
    expect(host.emit).toHaveBeenCalledWith('error', 'Cannot restart the game yet');
    expect(onGameReset).not.toHaveBeenCalled();
    expect(rm.getRoom(roomCode)?.status).toBe('waiting');

    host.fire('lobby:ready', true, vi.fn());
    guest.fire('lobby:ready', true, vi.fn());
    const started = vi.fn();
    host.fire('lobby:startGame', started);
    expect(started).toHaveBeenCalledWith(true);
    expect(onGameStart).toHaveBeenCalledTimes(1);
  });

  it('enforces selection, minimum players and bot support before starting', () => {
    const onGameStart = vi.fn();
    const { rm, host, guest, roomCode } = twoPlayers({ onGameStart });
    const ack = vi.fn();
    host.fire('lobby:ready', true, vi.fn());
    guest.fire('lobby:ready', true, vi.fn());

    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(false, 'Cannot start the game yet');
    ack.mockClear();
    rm.selectGame(roomCode, { ...gameRules, minPlayers: 3 });
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(false, 'Cannot start the game yet');
    host.fire('lobby:addBot', ack);
    expect(ack).toHaveBeenLastCalledWith(true);
    const bot = rm.getPlayersInRoom(roomCode).find((player) => player.isBot)!;
    rm.selectGame(roomCode, { ...gameRules, supportsBots: false });
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(false, 'Cannot start the game yet');
    expect(onGameStart).not.toHaveBeenCalled();

    host.fire('lobby:removeBot', bot.id, ack);
    expect(ack).toHaveBeenLastCalledWith(true);
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(true);
    expect(onGameStart).toHaveBeenCalledTimes(1);
  });

  it('blocks start, readiness changes and bot changes during play', () => {
    const onGameStart = vi.fn((roomCode: string) => rm.setGameData(roomCode, { id: 'original' }));
    const { rm, host, roomCode } = twoPlayers({ onGameStart });
    const ack = vi.fn();
    rm.selectGame(roomCode, gameRules);
    host.fire('lobby:addBot', ack);
    const bot = rm.getPlayersInRoom(roomCode).find((player) => player.isBot)!;
    rm.getPlayersInRoom(roomCode).filter((player) => !player.isBot)
      .forEach((player) => rm.setPlayerReady(player.id, true));
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(true);
    const engine = rm.getGameData(roomCode);
    const before = structuredClone(rm.getRoom(roomCode));

    for (const [event, ...args] of [
      ['lobby:startGame'],
      ['lobby:ready', false],
      ['lobby:addBot'],
      ['lobby:removeBot', bot.id],
    ] as const) {
      ack.mockClear();
      host.fire(event, ...args, ack);
      expect(ack).toHaveBeenCalledExactlyOnceWith(false, expect.any(String));
    }
    expect(rm.getRoom(roomCode)).toEqual(before);
    expect(rm.getGameData(roomCode)).toBe(engine);
    expect(onGameStart).toHaveBeenCalledTimes(1);

    host.fire('lobby:resetGame');
    host.fire('lobby:ready', true, ack);
    expect(ack).toHaveBeenLastCalledWith(true);
  });

  it('restarts a finished game without requiring players to ready up', () => {
    const onGameStart = vi.fn();
    const onGameReset = vi.fn();
    const { rm, host, io, roomCode } = twoPlayers({ onGameStart, onGameReset });
    rm.selectGame(roomCode, gameRules);
    for (const player of rm.getPlayersInRoom(roomCode)) rm.setPlayerReady(player.id, true);
    rm.startGame(roomCode);
    const engine = {};
    rm.setGameData(roomCode, engine);
    rm.finishGame(roomCode, engine);
    expect(rm.getRoom(roomCode)?.status).toBe('finished');

    host.fire('lobby:restartGame');
    expect(onGameReset).toHaveBeenCalledTimes(1);
    expect(onGameStart).toHaveBeenCalledTimes(1);
    expect(rm.getRoom(roomCode)?.status).toBe('playing');
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

    rm.selectGame(roomCode, gameRules);
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
