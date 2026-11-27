import { PLAYER_NAME_MAX_LENGTH } from '@parlor/game-types';
import { getMetrics } from './observability.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from './RoomManager.js';
import type { LobbyCallbacks } from './lobbyHandlers.js';
import { connectFakeSocket, createFakeIo } from './testing.js';

const gameRules = { id: 'test', minPlayers: 2, maxPlayers: 4, supportsBots: true };

describe('lobbyHandlers malformed payloads', () => {
  it('does not throw on a non-string create name', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const socket = connectFakeSocket(io, rm, undefined, 's1');
    const ack = vi.fn();
    expect(() => socket.fire('lobby:create', 123, ack)).not.toThrow();
    expect(ack).toHaveBeenCalledWith(null, 'Invalid player name');
  });

  it('does not throw on a null join name', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const socket = connectFakeSocket(io, rm, undefined, 's1');
    const cb = vi.fn();
    expect(() => socket.fire('lobby:join', 'ROOM', null, cb)).not.toThrow();
    expect(cb).toHaveBeenCalledWith({ success: false, error: expect.any(String) });
  });

  it('does not throw when join is missing arguments', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const socket = connectFakeSocket(io, rm, undefined, 's1');
    expect(() => socket.fire('lobby:join')).not.toThrow();
  });

  it('does not throw on a non-boolean ready value', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 's1');
    host.fire('lobby:create', 'Ann', vi.fn());
    const cb = vi.fn();
    expect(() => host.fire('lobby:ready', 'yes', cb)).not.toThrow();
    expect(cb).toHaveBeenCalledWith(false, expect.any(String));
  });
});

describe('lobby player names', () => {
  it('rejects a disallowed create name without changing the existing seat, then accepts a valid create', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    host.fire('lobby:create', 'Original', vi.fn());
    const original = rm.getRoom(host.data.roomCode);
    const before = structuredClone(original);

    for (const name of ['x'.repeat(25), 'Bob\u200b', 'Alex👏', 'Bοt Alice']) {
      const ack = vi.fn();
      host.fire('lobby:create', name, ack);
      expect(ack).toHaveBeenCalledExactlyOnceWith(null, expect.any(String));
      expect(rm.getRoom(host.data.roomCode)).toEqual(before);
      expect(rm.getPlayerIdBySocket(host.id)).toBe(host.data.playerId);
    }

    const ack = vi.fn();
    host.fire('lobby:create', '  Jose\u0301 ', ack);
    expect(ack).toHaveBeenCalledOnce();
    expect(rm.getPlayersInRoom(host.data.roomCode)).toContainEqual(
      expect.objectContaining({ name: 'José' }),
    );
  });

  it('rejects lookalike duplicates and bot names without changing either room', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    const guest = connectFakeSocket(io, rm, undefined, 'guest');
    host.fire('lobby:create', 'José', vi.fn());
    guest.fire('lobby:create', 'Original', vi.fn());
    const roomCode = host.data.roomCode;
    const guestRoomCode = guest.data.roomCode;
    const targetBefore = structuredClone(rm.getRoom(roomCode));
    const guestBefore = structuredClone(rm.getRoom(guestRoomCode));

    for (const [name, error] of [
      ['  jＯse\u0301  ', 'Name already taken in this room'],
      ['Jоsé', 'Name already taken in this room'],
      ['Ｂot Alice', 'Names starting with Bot are reserved'],
    ]) {
      const ack = vi.fn();
      guest.fire('lobby:join', roomCode, name, ack);
      expect(ack).toHaveBeenCalledExactlyOnceWith({ success: false, error });
      expect(rm.getRoom(roomCode)).toEqual(targetBefore);
      expect(rm.getRoom(guestRoomCode)).toEqual(guestBefore);
      expect(guest.data.roomCode).toBe(guestRoomCode);
    }

    const ack = vi.fn();
    guest.fire('lobby:join', roomCode, '  李 明 ', ack);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(rm.getPlayersInRoom(roomCode)).toContainEqual(expect.objectContaining({ name: '李 明' }));
  });

  it('caps names at the shared input limit: rejects one character over without changing the room, then accepts the limit', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    const guest = connectFakeSocket(io, rm, undefined, 'guest');
    host.fire('lobby:create', 'Ann', vi.fn());
    const roomCode = host.data.roomCode;
    const before = structuredClone(rm.getRoom(roomCode));

    const tooLong = vi.fn();
    guest.fire('lobby:join', roomCode, 'x'.repeat(PLAYER_NAME_MAX_LENGTH + 1), tooLong);
    expect(tooLong).toHaveBeenCalledExactlyOnceWith({
      success: false,
      error: `Player names must be 1–${PLAYER_NAME_MAX_LENGTH} characters`,
    });
    expect(rm.getRoom(roomCode)).toEqual(before);

    const atLimit = 'Bartholomew Fitzgera';
    expect(atLimit).toHaveLength(PLAYER_NAME_MAX_LENGTH);
    const ack = vi.fn();
    guest.fire('lobby:join', roomCode, atLimit, ack);
    expect(ack).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(rm.getPlayersInRoom(roomCode)).toContainEqual(expect.objectContaining({ name: atLimit }));
  });

  it('uses an available bot name after a bot is removed', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    host.fire('lobby:create', 'Host', vi.fn());
    const roomCode = host.data.roomCode;
    rm.selectGame(roomCode, gameRules);
    host.fire('lobby:addBot', vi.fn());
    host.fire('lobby:addBot', vi.fn());
    const first = rm.getPlayersInRoom(roomCode).find((player) => player.isBot);
    expect(first?.name).toBe('Bot Alice');

    host.fire('lobby:removeBot', first?.id, vi.fn());
    host.fire('lobby:addBot', vi.fn());
    expect(rm.getPlayersInRoom(roomCode).map((player) => player.name)).toEqual(['Host', 'Bot Bob', 'Bot Alice']);
  });
});

describe('lobbyHandlers host gates', () => {
  function twoPlayers(callbacks?: LobbyCallbacks) {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, callbacks, 's1');
    const guest = connectFakeSocket(io, rm, callbacks, 's2');

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
    expect(host.received).toContainEqual({ event: 'error', args: ['Cannot restart the game yet'] });
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
    const engine = rm.getRoom(roomCode)?.gameData;
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
    expect(rm.getRoom(roomCode)?.gameData).toBe(engine);
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
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, callbacks, 's1');
    const guest = connectFakeSocket(io, rm, callbacks, 's2');

    let roomCode = '';
    host.fire('lobby:create', 'Ann', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    return { io, host, guest, roomCode };
  }

  it('broadcasts a disconnected seat during grace and removes it on expiry', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const { io, host, guest } = twoPlayers(rm);
    const guestId = guest.data.playerId;

    guest.fire('disconnect');

    // During grace: greyed out, still seated.
    expect(io.emitted.some((e) => e.event === 'player:disconnected' && e.args[0] === guestId)).toBe(
      true,
    );
    expect(io.emitted.filter((e) => e.event === 'lobby:state').at(-1)?.payload).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: guestId, connected: false })]),
    );
    expect(rm.getPlayersInRoom(guest.data.roomCode).map((p) => p.id)).toContain(guestId);

    // After grace: really removed.
    vi.advanceTimersByTime(1_000);
    expect(io.emitted.filter((e) => e.event === 'lobby:state').at(-1)?.payload).toEqual([
      expect.objectContaining({ id: host.data.playerId }),
    ]);
    expect(rm.getPlayersInRoom(guest.data.roomCode).map((p) => p.id)).not.toContain(guestId);
  });

  it('fires onPlayerRemoved and hostChanged when an in-game host expires', () => {
    vi.useFakeTimers();
    const onPlayerRemoved = vi.fn();
    const rm = new RoomManager(1_000);
    const { io, host, guest } = twoPlayers(rm, { onPlayerRemoved });
    const hostId = host.data.playerId;
    const guestId = guest.data.playerId;
    const roomCode = host.data.roomCode;

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
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 's1');
    const guest = connectFakeSocket(io, rm, undefined, 's2');

    let roomCode = '';
    host.fire('lobby:create', 'Ann', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    const guestPlayerId = guest.data.playerId;

    guest.fire('room:leave');

    const remaining = rm.getPlayersInRoom(roomCode);
    expect(remaining.map((p) => p.id)).not.toContain(guestPlayerId);
    expect(io.emitted.filter((e) => e.event === 'lobby:state').at(-1)?.payload).toEqual([
      expect.objectContaining({ id: host.data.playerId }),
    ]);
  });
});


describe('lobby game instance lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function startRoom(rm: RoomManager, callbacks?: LobbyCallbacks, id = 'host') {
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, callbacks, id);
    host.fire('lobby:create', id, vi.fn());
    const roomCode = host.data.roomCode;
    rm.selectGame(roomCode, gameRules);
    host.fire('lobby:addBot', vi.fn());
    host.fire('lobby:ready', true, vi.fn());
    const ack = vi.fn();
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenCalledWith(true);
    return { io, host, roomCode, instance: rm.getGameInstance(roomCode)! };
  }

  it.each(['throw', 'reject'])('returns only the failed game to the lobby after a scheduled %s', async (mode) => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rm = new RoomManager();
    const before = getMetrics();
    const { instance, roomCode, io } = startRoom(rm);
    const other = startRoom(rm, undefined, 'other');
    const error = new Error('scheduled failure');
    instance.schedule(() => {
      if (mode === 'throw') throw error;
      return Promise.reject(error);
    }, 10);
    const next = vi.fn();
    instance.schedule(next, 20);

    await vi.advanceTimersByTimeAsync(30);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      event: 'scheduled_game_task_failed', roomCode, gameId: 'test',
      instanceId: instance.id, error: { message: error.message },
    });
    expect(getMetrics()).toMatchObject({
      rooms: before.rooms + 2,
      gamesStarted: before.gamesStarted + 2,
      caughtRoomFailures: before.caughtRoomFailures + 1,
    });
    expect(rm.getRoom(roomCode)?.status).toBe('waiting');
    expect(io.emitted).toContainEqual(expect.objectContaining({ to: roomCode, event: 'lobby:returned', args: ['test'] }));
    expect(next).not.toHaveBeenCalled();
    expect(instance.signal.aborted).toBe(true);
    expect(rm.getGameInstance(other.roomCode)).toBe(other.instance);
    expect(other.instance.isCurrent()).toBe(true);
  });

  it('contains a rejected player removal callback when grace expires', async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rm = new RoomManager(100);
    const callbacks: LobbyCallbacks = {
      onPlayerRemoved: vi.fn(() => Promise.reject(new Error('remove failed'))),
    };
    const { io, host, roomCode } = startRoom(rm, callbacks);
    host.fire('lobby:resetGame');
    const guest = connectFakeSocket(io, rm, callbacks, 'guest');
    guest.fire('lobby:join', roomCode, 'Guest', vi.fn());
    host.fire('lobby:ready', true, vi.fn());
    guest.fire('lobby:ready', true, vi.fn());
    host.fire('lobby:startGame', vi.fn());
    const before = getMetrics();
    const instanceId = rm.getGameInstance(roomCode)?.id;

    guest.fire('disconnect');
    await vi.advanceTimersByTimeAsync(100);
    expect(callbacks.onPlayerRemoved).toHaveBeenCalledExactlyOnceWith(roomCode, guest.data.playerId, expect.anything());
    expect(rm.getRoom(roomCode)?.status).toBe('waiting');
    expect(getMetrics().caughtRoomFailures).toBe(before.caughtRoomFailures + 1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      event: 'player_lifecycle_callback_failed', roomCode, gameId: 'test',
      playerId: guest.data.playerId, instanceId,
    });
  });

  it('keeps a player grace timer across a game reset', async () => {
    vi.useFakeTimers();
    const rm = new RoomManager(100);
    const onRoomDestroyed = vi.fn();
    const { instance, roomCode, host } = startRoom(rm, { onRoomDestroyed });
    host.fire('disconnect');
    expect(rm.getRoom(roomCode)?.players.get(host.data.playerId)?.connected).toBe(false);

    const scheduled = vi.fn();
    instance.schedule(scheduled, 100);
    expect(rm.resetGame(roomCode)).toBe(true);
    expect(instance.signal.aborted).toBe(true);
    expect(rm.getRoom(roomCode)?.status).toBe('waiting');

    await vi.advanceTimersByTimeAsync(100);
    expect(rm.getRoom(roomCode)).toBeUndefined();
    expect(onRoomDestroyed).toHaveBeenCalledExactlyOnceWith(roomCode, expect.anything());
    expect(scheduled).not.toHaveBeenCalled();
  });

  it.each(['leave', 'expiry'])('invalidates running work before destroying a room on %s', async (method) => {
    vi.useFakeTimers();
    const rm = new RoomManager(100);
    const onRoomDestroyed = vi.fn((roomCode: string) => {
      expect(rm.getGameInstance(roomCode)).toBeUndefined();
    });
    const { instance, roomCode, host } = startRoom(rm, { onRoomDestroyed });
    const mutate = vi.fn();
    const emit = vi.fn();
    let resume!: () => void;
    const wait = new Promise<void>((resolve) => { resume = resolve; });
    const started = vi.fn();
    instance.schedule(async () => {
      started();
      await wait;
      if (instance.isCurrent()) mutate();
      instance.emitIfCurrent(emit);
    }, 5);
    await vi.advanceTimersByTimeAsync(5);
    expect(started).toHaveBeenCalledOnce();

    if (method === 'leave') host.fire('room:leave');
    else {
      host.fire('disconnect');
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(rm.getRoom(roomCode)).toBeUndefined();
    expect(instance.signal.aborted).toBe(true);
    expect(onRoomDestroyed).toHaveBeenCalledExactlyOnceWith(roomCode, expect.anything());
    resume();
    await wait;
    expect(mutate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

it('shares the lookup limit across join and spectate, and refills while other requests work', () => {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  try {
    const rm = new RoomManager();
    const io = createFakeIo();
    const target = rm.createRoom('target', 'Target');
    const socket = connectFakeSocket(io, rm, undefined, 'host');
    socket.fire('lobby:create', 'Host', vi.fn());
    const roomCode = socket.data.roomCode;
    const before = structuredClone(rm.getRoom(roomCode));
    const targetBefore = structuredClone(rm.getRoom(target.roomCode));

    for (let index = 0; index < 3; index++) {
      socket.fire('lobby:join', 'MISSING', 'Guest', vi.fn());
      socket.fire('lobby:spectate', 'MISSING', vi.fn());
    }
    const join = vi.fn();
    const spectate = vi.fn();
    socket.fire('lobby:join', target.roomCode, 'Guest', join);
    socket.fire('lobby:spectate', target.roomCode, spectate);
    expect(join).toHaveBeenCalledWith({ success: false, error: expect.stringMatching(/Too many/) });
    expect(spectate).toHaveBeenCalledWith(false, expect.stringMatching(/Too many/));
    expect(rm.getRoom(roomCode)).toEqual(before);
    expect(rm.getRoom(target.roomCode)).toEqual(targetBefore);

    const ready = vi.fn();
    socket.fire('lobby:ready', true, ready);
    expect(ready).toHaveBeenCalledWith(true);
    now = 500;
    socket.fire('lobby:join', target.roomCode, 'Guest', join);
    expect(join).toHaveBeenLastCalledWith(expect.objectContaining({ success: true }));
  } finally {
    clock.mockRestore();
  }
});
