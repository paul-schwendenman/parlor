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

describe('lobbyHandlers host readiness', () => {
  function threePlayers(callbacks?: LobbyCallbacks) {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, callbacks, 's1');
    const joe = connectFakeSocket(io, rm, callbacks, 's2');
    const ann = connectFakeSocket(io, rm, callbacks, 's3');
    let roomCode = '';
    host.fire('lobby:create', 'Margaret', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    joe.fire('lobby:join', roomCode, 'Joe', vi.fn());
    ann.fire('lobby:join', roomCode, 'Ann', vi.fn());
    rm.selectGame(roomCode, gameRules);
    return { rm, io, host, joe, ann, roomCode };
  }

  it('starts when every connected guest is ready and the host never pressed Ready', () => {
    const onGameStart = vi.fn();
    const { rm, host, joe, ann, roomCode } = threePlayers({ onGameStart });
    joe.fire('lobby:ready', true, vi.fn());
    ann.fire('lobby:ready', true, vi.fn());
    const hostSeat = rm.getPlayersInRoom(roomCode).find((player) => player.id === rm.getRoom(roomCode)?.hostId);
    expect(hostSeat?.isReady).toBe(false);
    expect(rm.canStartGame(roomCode)).toBe(true);

    const ack = vi.fn();
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenCalledWith(true);
    expect(onGameStart).toHaveBeenCalledTimes(1);
    expect(rm.getRoom(roomCode)?.status).toBe('playing');
  });

  it('rejects start while any guest is not ready, leaves the room unchanged, then accepts a valid start', () => {
    const onGameStart = vi.fn();
    const { rm, host, joe, ann, roomCode } = threePlayers({ onGameStart });
    host.fire('lobby:ready', true, vi.fn());
    joe.fire('lobby:ready', true, vi.fn());
    expect(rm.canStartGame(roomCode)).toBe(false);
    const before = structuredClone(rm.getRoom(roomCode));

    const ack = vi.fn();
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(false, expect.any(String));
    expect(rm.getRoom(roomCode)).toEqual(before);
    expect(onGameStart).not.toHaveBeenCalled();

    ann.fire('lobby:ready', true, vi.fn());
    host.fire('lobby:startGame', ack);
    expect(ack).toHaveBeenLastCalledWith(true);
    expect(onGameStart).toHaveBeenCalledTimes(1);
  });

  it('still requires a guest who is ready but disconnected to come back', () => {
    const { rm, joe, ann, roomCode } = threePlayers();
    joe.fire('lobby:ready', true, vi.fn());
    ann.fire('lobby:ready', true, vi.fn());
    expect(rm.canStartGame(roomCode)).toBe(true);
    vi.useFakeTimers();
    try {
      rm.handleDisconnect('s3');
      expect(rm.getPlayersInRoom(roomCode).find((player) => player.name === 'Ann')?.connected).toBe(false);
      expect(rm.canStartGame(roomCode)).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe('lobbyHandlers addBot', () => {
  function hostAlone() {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 's1');
    let roomCode = '';
    host.fire('lobby:create', 'Margaret', (res: { roomCode: string }) => {
      roomCode = res.roomCode;
    });
    return { rm, io, host, roomCode };
  }

  it('adds a bot while the room is still voting on a game', () => {
    const { rm, host, roomCode } = hostAlone();
    expect(rm.getGameId(roomCode)).toBeNull();
    const ack = vi.fn();
    host.fire('lobby:addBot', ack);
    expect(ack).toHaveBeenCalledWith(true);
    expect(rm.getPlayersInRoom(roomCode).filter((player) => player.isBot)).toHaveLength(1);
  });

  it('says what to do when the room is full, leaves it unchanged, and accepts a bot once a seat frees up', () => {
    const { rm, host, roomCode } = hostAlone();
    rm.selectGame(roomCode, { ...gameRules, maxPlayers: 2 });
    host.fire('lobby:addBot', vi.fn());
    const before = structuredClone(rm.getRoom(roomCode));
    const ack = vi.fn();
    host.fire('lobby:addBot', ack);
    expect(ack).toHaveBeenLastCalledWith(false, 'The room is full. Remove a bot or a player to make space.');
    expect(rm.getRoom(roomCode)).toEqual(before);

    const bot = rm.getPlayersInRoom(roomCode).find((player) => player.isBot)!;
    host.fire('lobby:removeBot', bot.id, vi.fn());
    host.fire('lobby:addBot', ack);
    expect(ack).toHaveBeenLastCalledWith(true);
  });

  it('refuses bots for a game without bot support and names the way out', () => {
    const { rm, host, roomCode } = hostAlone();
    rm.selectGame(roomCode, { ...gameRules, supportsBots: false });
    const before = structuredClone(rm.getRoom(roomCode));
    const ack = vi.fn();
    host.fire('lobby:addBot', ack);
    expect(ack).toHaveBeenLastCalledWith(false, expect.stringMatching(/Invite someone instead, or choose another game/));
    expect(rm.getRoom(roomCode)).toEqual(before);
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
    // Whether the short hand-off or the removal moved the role, the room hears why.
    expect(
      io.emitted.filter((e) => e.event === 'lobby:hostChanged').map((e) => e.args[1]),
    ).not.toContain(undefined);
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

  it('tells the room the host left, with the reason, when the host leaves', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 's1');
    const guest = connectFakeSocket(io, rm, undefined, 's2');
    host.fire('lobby:create', 'Ann', vi.fn());
    const roomCode = host.data.roomCode;
    guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
    const before = io.emitted.length;

    host.fire('room:leave', vi.fn());

    const changes = io.emitted.slice(before).filter((e) => e.event === 'lobby:hostChanged');
    expect(changes.map((e) => [e.to, ...e.args])).toEqual([[roomCode, guest.data.playerId, 'left']]);
    expect(rm.getRoom(roomCode)?.hostId).toBe(guest.data.playerId);
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

describe('lobby:roomExists', () => {
  it('returns a limited invite preview without joining the room', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    host.fire('lobby:create', 'Margaret', vi.fn());
    const roomCode = host.data.roomCode;
    rm.selectGame(roomCode, gameRules);
    const before = structuredClone(rm.getRoom(roomCode));

    const visitor = connectFakeSocket(io, rm, undefined, 'visitor');
    const emittedBefore = io.emitted.length;
    const live = vi.fn();
    visitor.fire('lobby:roomExists', roomCode.toLowerCase(), live);
    expect(live).toHaveBeenCalledExactlyOnceWith(true, undefined, gameRules.id, { hostName: 'Margaret', peopleCount: 1, status: 'waiting' });
    const missing = vi.fn();
    visitor.fire('lobby:roomExists', 'NOPE99', missing);
    expect(missing).toHaveBeenCalledExactlyOnceWith(false);
    for (const bad of [42, null, '', undefined]) {
      const ack = vi.fn();
      expect(() => visitor.fire('lobby:roomExists', bad, ack)).not.toThrow();
      expect(ack).toHaveBeenCalledExactlyOnceWith(false);
    }
    expect(() => visitor.fire('lobby:roomExists', roomCode)).not.toThrow();

    // The lookup does not join, broadcast or change the room.
    expect(visitor.received).toEqual([]);
    expect(visitor.data.roomCode).toBe('');
    expect(io.emitted.length).toBe(emittedBefore);
    expect(rm.getRoom(roomCode)).toEqual(before);
  });

  it('shares the join/spectate lookup limit and says when it is rate limited', () => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const rm = new RoomManager();
      const io = createFakeIo();
      const host = connectFakeSocket(io, rm, undefined, 'host');
      host.fire('lobby:create', 'Host', vi.fn());
      const visitor = connectFakeSocket(io, rm, undefined, 'visitor');
      for (let index = 0; index < 6; index++) visitor.fire('lobby:roomExists', 'MISSING', vi.fn());
      const limited = vi.fn();
      visitor.fire('lobby:roomExists', host.data.roomCode, limited);
      expect(limited).toHaveBeenCalledWith(false, expect.stringMatching(/Too many/));
      const join = vi.fn();
      visitor.fire('lobby:join', host.data.roomCode, 'Guest', join);
      expect(join).toHaveBeenCalledWith({ success: false, error: expect.stringMatching(/Too many/) });

      now = 500;
      const ack = vi.fn();
      visitor.fire('lobby:roomExists', host.data.roomCode, ack);
      expect(ack).toHaveBeenCalledExactlyOnceWith(true, undefined, null, { hostName: 'Host', peopleCount: 1, status: 'waiting' });
    } finally {
      clock.mockRestore();
    }
  });
});

describe('lobbyHandlers lobby:transferHost (plan 8.6)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function room(rm = new RoomManager()) {
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    host.fire('lobby:create', 'Ann', vi.fn());
    const roomCode = host.data.roomCode;
    const join = (id: string, name: string) => {
      const socket = connectFakeSocket(io, rm, undefined, id);
      socket.fire('lobby:join', roomCode, name, vi.fn());
      return socket;
    };
    const guest = join('guest', 'Bob');
    const away = join('away', 'Cat');
    away.fire('disconnect');
    rm.selectGame(roomCode, gameRules);
    const botId = rm.addBot(roomCode, 'Bot Dee').botId!;
    const spectator = connectFakeSocket(io, rm, undefined, 'spectator');
    spectator.fire('lobby:spectate', roomCode, vi.fn());
    const stranger = connectFakeSocket(io, rm, undefined, 'stranger');
    stranger.fire('lobby:create', 'Oz', vi.fn());
    return { rm, io, host, guest, away, botId, spectator, stranger, roomCode };
  }

  function hostChanges(io: ReturnType<typeof createFakeIo>) {
    return io.emitted.filter((e) => e.event === 'lobby:hostChanged');
  }

  it('rejects each invalid request with the room unchanged and nothing broadcast, then a valid transfer works', () => {
    const { rm, io, host, guest, away, botId, spectator, stranger, roomCode } = room();
    const before = structuredClone(rm.getRoom(roomCode));
    const emitted = io.emitted.length;
    const guestId = guest.data.playerId;

    const cases: [typeof host, unknown, string][] = [
      [guest, away.data.playerId, 'Only the host can pass the host role on'],
      [spectator, guestId, 'Not in a room'],
      [host, botId, 'A bot cannot be the host'],
      [host, away.data.playerId, 'Cat is offline. Try again when they are back.'],
      [host, 'no-such-player', 'That player is not in this room'],
      [host, 'spectator', 'That player is not in this room'],
      [host, host.data.playerId, 'You are already the host'],
      [host, stranger.data.playerId, 'That player is not in this room'],
      [host, 42, 'Invalid player id'],
      [host, { id: guestId }, 'Invalid player id'],
      [host, '', 'Invalid player id'],
      [host, null, 'Invalid player id'],
    ];
    for (const [sender, target, error] of cases) {
      const ack = vi.fn();
      sender.fire('lobby:transferHost', target, ack);
      expect(ack).toHaveBeenCalledExactlyOnceWith(false, error);
      expect(rm.getRoom(roomCode)).toEqual(before);
      expect(io.emitted.length).toBe(emitted);
    }

    const ack = vi.fn();
    host.fire('lobby:transferHost', guestId, ack);
    expect(ack).toHaveBeenCalledExactlyOnceWith(true);
    expect(rm.getRoom(roomCode)?.hostId).toBe(guestId);
    // The whole room (players and spectators share the room channel) learns the new host,
    // followed by a fresh lobby state (the host's seat needs no Ready, so canStart may change).
    expect(io.emitted.slice(emitted).map((e) => [e.to, e.event, e.payload])).toEqual([
      [roomCode, 'lobby:hostChanged', guestId],
      [roomCode, 'lobby:state', rm.getPlayersInRoom(roomCode)],
    ]);
    // Marked as a hand-over by the host, so clients can say who made whom host.
    expect(hostChanges(io).at(-1)?.args).toEqual([guestId, 'transfer']);
    // Nothing went to sockets privately.
    expect(host.received.filter((e) => e.event === 'error')).toEqual([]);

    // Roles swapped: the old host is refused, the new host may pass it back.
    const refused = vi.fn();
    host.fire('lobby:addBot', refused);
    expect(refused).toHaveBeenCalledWith(false, 'Only the host can add bots');
    const back = vi.fn();
    guest.fire('lobby:transferHost', host.data.playerId, back);
    expect(back).toHaveBeenCalledWith(true);
    expect(rm.getRoom(roomCode)?.hostId).toBe(host.data.playerId);
  });

  it('refuses a seat the socket no longer owns', () => {
    const { rm, host, guest, roomCode } = room();
    // The host's seat moves to another socket (e.g. a second tab reconnected with its token).
    const token = rm.getRoom(roomCode)!.reconnectTokens.get(host.data.playerId)!;
    rm.handleReconnect(roomCode, host.data.playerId, token, 'host-tab-2');
    const ack = vi.fn();
    host.fire('lobby:transferHost', guest.data.playerId, ack);
    expect(ack).toHaveBeenCalledWith(false, 'Only the host can pass the host role on');
    expect(rm.getRoom(roomCode)?.hostId).toBe(host.data.playerId);
  });

  it('only works in the lobby', () => {
    const rm = new RoomManager();
    const io = createFakeIo();
    const host = connectFakeSocket(io, rm, undefined, 'host');
    host.fire('lobby:create', 'Ann', vi.fn());
    const guest = connectFakeSocket(io, rm, undefined, 'guest');
    guest.fire('lobby:join', host.data.roomCode, 'Bob', vi.fn());
    rm.selectGame(host.data.roomCode, gameRules);
    guest.fire('lobby:ready', true, vi.fn());
    host.fire('lobby:startGame', vi.fn());
    expect(rm.getRoom(host.data.roomCode)?.status).toBe('playing');

    const ack = vi.fn();
    host.fire('lobby:transferHost', guest.data.playerId, ack);
    expect(ack).toHaveBeenCalledWith(false, 'You can pass the host role on in the lobby, between games');
    expect(rm.getRoom(host.data.roomCode)?.hostId).toBe(host.data.playerId);
  });

  it('is rate limited like other lobby requests', () => {
    let now = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const { rm, host, guest, roomCode } = room();
      for (let index = 0; index < 80; index++) host.fire('lobby:transferHost', 42, vi.fn());
      const limited = vi.fn();
      host.fire('lobby:transferHost', guest.data.playerId, limited);
      expect(limited).toHaveBeenCalledWith(false, expect.stringMatching(/Too many/));
      expect(rm.getRoom(roomCode)?.hostId).toBe(host.data.playerId);

      now = 1_000;
      const ack = vi.fn();
      host.fire('lobby:transferHost', guest.data.playerId, ack);
      expect(ack).toHaveBeenCalledWith(true);
    } finally {
      clock.mockRestore();
    }
  });

  it('broadcasts the delayed hand-off, and none when the host is back in time (plan 8.7)', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { io, host, guest, roomCode } = room(rm);
    const hostId = host.data.playerId;
    const token = rm.getRoom(roomCode)!.reconnectTokens.get(hostId)!;

    host.fire('disconnect');
    expect(hostChanges(io)).toEqual([]);
    vi.advanceTimersByTime(9_000);
    // A quick return: the host keeps the role, and only the returning socket is told who hosts.
    const back = connectFakeSocket(io, rm, undefined, 'host-2');
    const ok = vi.fn();
    back.fire('player:reconnect', roomCode, hostId, token, ok);
    expect(ok).toHaveBeenCalledWith(true, expect.any(String));
    vi.advanceTimersByTime(60_000);
    expect(hostChanges(io)).toEqual([]);
    expect(back.received).toContainEqual({ event: 'lobby:hostChanged', args: [hostId] });

    // A real drop: after the window the room hears about the new host once.
    back.fire('disconnect');
    vi.advanceTimersByTime(9_999);
    expect(hostChanges(io)).toEqual([]);
    vi.advanceTimersByTime(1);
    // Marked as a hand-off, so clients can say the host is away rather than gone.
    expect(hostChanges(io).map((e) => [e.to, ...e.args])).toEqual([[roomCode, guest.data.playerId, 'handoff']]);
    expect(io.emitted.at(-1)).toMatchObject({ to: roomCode, event: 'lobby:state' });
    vi.advanceTimersByTime(60_000);
    expect(hostChanges(io)).toHaveLength(1);
  });

  it('refuses host-only requests from guests while the host is in its window', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { io, host, guest, roomCode } = room(rm);
    rm.removeBot(roomCode, rm.getPlayersInRoom(roomCode).find((p) => p.isBot)!.id);
    guest.fire('lobby:ready', true, vi.fn());
    host.fire('disconnect');
    const before = structuredClone(rm.getRoom(roomCode));
    const emitted = io.emitted.length;

    const addBot = vi.fn();
    guest.fire('lobby:addBot', addBot);
    expect(addBot).toHaveBeenCalledWith(false, 'Only the host can add bots');
    const start = vi.fn();
    guest.fire('lobby:startGame', start);
    expect(start).toHaveBeenCalledWith(false, 'Only the host can start the game');
    const transfer = vi.fn();
    guest.fire('lobby:transferHost', guest.data.playerId, transfer);
    expect(transfer).toHaveBeenCalledWith(false, 'Only the host can pass the host role on');
    expect(rm.getRoom(roomCode)).toEqual(before);
    expect(io.emitted.length).toBe(emitted);

    vi.advanceTimersByTime(10_000);
    // Now the guest is host, but the old host's seat (in grace) still blocks the start.
    const later = vi.fn();
    guest.fire('lobby:startGame', later);
    expect(later).toHaveBeenCalledWith(false, 'Cannot start the game yet');
  });
});
