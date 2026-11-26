/**
 * The typed game contract (plan 3.1b): `defineGame` owns state lookup, the action
 * map, `{ gameId, view }` broadcasts and the lifecycle hooks. Views are checked
 * per recipient, as captured from `io.to(recipient).emit(...)`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers } from './lobbyHandlers.js';
import { defineGame, type PlayerContext } from './defineGame.js';
import { GameRuleError } from './errors.js';
import { hasExactKeys, invalid, isIntInRange, typeOnly, valid, validateByType } from './actionValidation.js';
import { createDispatchHarness } from './testing.js';
import type { AppServer } from './gameDefinition.js';

interface CounterView {
  total: number;
  /** The recipient's own secret, or null for spectators. */
  secret: string | null;
  removed: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap {
    'test-counter': CounterView;
  }
}

type CounterAction = { type: 'add'; amount: number } | { type: 'slow-add' } | { type: 'refuse' };

class Counter {
  total = 0;
  removed: string[] = [];
  disconnected = new Set<string>();
  constructor(readonly players: string[]) {}
  secretOf(playerId: string) {
    return `secret-${playerId}`;
  }
}

/** Lets a test hold an async `slow-add` open across a reset. */
const slowAdd = { gate: Promise.resolve(), started: vi.fn() };

const hooks = {
  onPlayerDisconnect: vi.fn(({ state, playerId }: PlayerContext<Counter>) => {
    state.disconnected.add(playerId);
  }),
  onPlayerReconnect: vi.fn(({ state, playerId }: PlayerContext<Counter>) => {
    state.disconnected.delete(playerId);
  }),
  onPlayerRemoved: vi.fn(({ state, playerId }: PlayerContext<Counter>) => {
    state.removed.push(playerId);
  }),
  onRoomDestroyed: vi.fn(),
};

const counterDefinition = defineGame({
  meta: {
    id: 'test-counter',
    name: 'Counter',
    description: 'test',
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '1',
    tags: [],
    displayModes: ['peer'],
    supportsBots: true,
  },
  validateAction: (action) =>
    validateByType<CounterAction>(action, {
      add: (a) =>
        hasExactKeys(a, ['type', 'amount']) && isIntInRange(a.amount, 1, 3)
          ? valid({ type: 'add', amount: a.amount })
          : invalid('Bad amount'),
      'slow-add': typeOnly('slow-add'),
      refuse: typeOnly('refuse'),
    }),
  createState: (_roomCode, players) => new Counter(players.map((p) => p.id)),
  actions: {
    add: ({ state }, action) => {
      state.total += action.amount;
    },
    'slow-add': async ({ state, instance }) => {
      slowAdd.started();
      await slowAdd.gate;
      if (!instance.isCurrent()) return;
      state.total += 10;
    },
    refuse: () => {
      throw new GameRuleError('Not allowed');
    },
  },
  getPlayerView: (state, playerId) => ({ total: state.total, secret: state.secretOf(playerId), removed: state.removed }),
  getSpectatorView: (state) => ({ total: state.total, secret: null, removed: state.removed }),
  isGameOver: (state) => state.total >= 100,
  ...hooks,
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  slowAdd.gate = Promise.resolve();
});

function gameStates(emitted: { to: string; event: string; payload: unknown }[], to?: string) {
  return emitted
    .filter((e) => e.event === 'game:state' && (to === undefined || e.to === to))
    .map((e) => e.payload as GameStateEnvelope<'test-counter'>);
}

describe('defineGame: views go out as { gameId, view } to the right recipients', () => {
  it('sends each player its own view and spectators only the spectator view', async () => {
    const h = createDispatchHarness(counterDefinition, 3);
    h.spectate('spectator-socket');
    h.emitted.length = 0;

    expect(await h.send(h.playerIds[0], { type: 'add', amount: 2 })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      expect(gameStates(h.emitted, id)).toEqual([
        { gameId: 'test-counter', view: { total: 2, secret: `secret-${id}`, removed: [] } },
      ]);
    }
    expect(gameStates(h.emitted, 'spectator-socket')).toEqual([
      { gameId: 'test-counter', view: { total: 2, secret: null, removed: [] } },
    ]);
    // Exactly one envelope per recipient, and no secret reached the spectator.
    expect(gameStates(h.emitted)).toHaveLength(4);
    expect(JSON.stringify(gameStates(h.emitted, 'spectator-socket'))).not.toMatch(/secret-/);
  });

  it('broadcasts the start state and skips bot seats', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('host-socket', 'Host');
    rm.selectGame(host.roomCode, counterDefinition.meta);
    const bot = rm.addBot(host.roomCode, 'Bot');
    rm.setPlayerReady(host.playerId, true);
    const emitted: { to: string; event: string; payload: unknown }[] = [];
    const io = { to: (to: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ to, event, payload }) }) } as never as AppServer;

    const players = rm.startGame(host.roomCode)!;
    counterDefinition.createLobbyCallbacks(rm, io).onGameStart?.(host.roomCode, players, io);

    expect(emitted.map((e) => e.to)).toEqual([host.playerId]);
    expect(emitted.map((e) => e.to)).not.toContain(bot.botId);
    expect(counterDefinition.typed?.getState(rm, host.roomCode)?.players).toEqual([host.playerId, bot.botId]);
  });

  it('a rule rejection broadcasts nothing and leaves state unchanged; a valid action afterward is applied', async () => {
    const h = createDispatchHarness(counterDefinition);
    h.emitted.length = 0;

    expect(await h.send(h.playerIds[0], { type: 'refuse' })).toMatchObject({ ok: false, code: 'RULE_VIOLATION' });
    expect(await h.send(h.playerIds[0], { type: 'add', amount: 9 })).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(h.emitted).toEqual([]);
    expect(h.getState()?.total).toBe(0);

    expect(await h.send(h.playerIds[1], { type: 'add', amount: 3 })).toEqual({ ok: true });
    expect(h.getState()?.total).toBe(3);
    expect(gameStates(h.emitted)).toHaveLength(2);
  });

  it('marks the room finished when the game is over', async () => {
    const h = createDispatchHarness(counterDefinition);
    h.getState()!.total = 99;
    expect(await h.send(h.playerIds[0], { type: 'add', amount: 1 })).toEqual({ ok: true });
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
  });
});

describe('defineGame: game-instance lifetime', () => {
  it('an async handler that resumes after a reset neither mutates nor broadcasts', async () => {
    const h = createDispatchHarness(counterDefinition);
    const state = h.getState()!;
    let release!: () => void;
    slowAdd.gate = new Promise((resolve) => { release = resolve; });

    const pending = h.send(h.playerIds[0], { type: 'slow-add' });
    expect(slowAdd.started).toHaveBeenCalledOnce();
    h.emitted.length = 0;
    expect(h.roomManager.resetGame(h.roomCode)).toBe(true);
    expect(h.getState()).toBeNull();

    release();
    expect(await pending).toMatchObject({ ok: false, code: 'NO_ACTIVE_GAME' });
    expect(state.total).toBe(0);
    expect(h.emitted).toEqual([]);
  });

  it('an async handler that finishes normally broadcasts once it resolves', async () => {
    const h = createDispatchHarness(counterDefinition);
    h.emitted.length = 0;
    expect(await h.send(h.playerIds[0], { type: 'slow-add' })).toEqual({ ok: true });
    expect(gameStates(h.emitted).map((e) => e.view.total)).toEqual([10, 10]);
  });
});

// --- Lifecycle hooks over the real lobby handlers ------------------------------

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

/** Host + guest in a started counter game, wired through `setupLobbyHandlers`. */
function startLobbyGame(graceMs = 1_000) {
  const rm = new RoomManager(graceMs);
  const emitted: { to: string; event: string; payload: unknown }[] = [];
  const io = {
    in: () => ({ socketsLeave: vi.fn() }),
    to: (to: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ to, event, payload }) }),
    sockets: { sockets: new Map() },
  } as never as AppServer;
  const callbacks = counterDefinition.createLobbyCallbacks(rm, io);
  const host = makeSocket('host-socket');
  const guest = makeSocket('guest-socket');
  for (const socket of [host, guest]) setupLobbyHandlers(io, socket as never, rm, callbacks);

  host.fire('lobby:create', 'Ann', vi.fn());
  const roomCode = host.data.roomCode!;
  let guestToken = '';
  guest.fire('lobby:join', roomCode, 'Bob', (result: { reconnectToken: string }) => {
    guestToken = result.reconnectToken;
  });
  rm.selectGame(roomCode, counterDefinition.meta);
  host.fire('lobby:ready', true, vi.fn());
  guest.fire('lobby:ready', true, vi.fn());
  const ack = vi.fn();
  host.fire('lobby:startGame', ack);
  expect(ack).toHaveBeenCalledWith(true);
  return {
    rm, io, callbacks, emitted, host, guest, roomCode, guestToken,
    hostId: host.data.playerId!, guestId: guest.data.playerId!,
  };
}

describe('defineGame: lifecycle hooks', () => {
  it('onPlayerDisconnect runs then broadcasts; onPlayerRemoved runs on grace expiry then broadcasts', () => {
    vi.useFakeTimers();
    const { rm, emitted, guest, roomCode, hostId, guestId } = startLobbyGame();
    const state = counterDefinition.typed!.getState(rm, roomCode)!;

    emitted.length = 0;
    guest.fire('disconnect');
    expect(hooks.onPlayerDisconnect).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ roomCode, playerId: guestId, state }),
    );
    expect(state.disconnected.has(guestId)).toBe(true);
    expect(gameStates(emitted, hostId)).toHaveLength(1);
    expect(hooks.onPlayerRemoved).not.toHaveBeenCalled();

    emitted.length = 0;
    vi.advanceTimersByTime(1_000);
    expect(hooks.onPlayerRemoved).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ roomCode, playerId: guestId, state }),
    );
    // The remaining player sees the removal; the removed seat is sent nothing.
    expect(gameStates(emitted, hostId).map((e) => e.view.removed)).toEqual([[guestId]]);
    expect(gameStates(emitted, guestId)).toEqual([]);
    expect(hooks.onRoomDestroyed).not.toHaveBeenCalled();
  });

  it('onPlayerReconnect runs and only the returning player is sent its view', () => {
    vi.useFakeTimers();
    const { rm, io, callbacks, emitted, guest, roomCode, guestId, guestToken } = startLobbyGame();
    guest.fire('disconnect');
    emitted.length = 0;

    const returned = makeSocket('returned-socket');
    setupLobbyHandlers(io, returned as never, rm, callbacks);
    const ack = vi.fn();
    returned.fire('player:reconnect', roomCode, guestId, guestToken, ack);
    expect(ack).toHaveBeenCalledWith(true, expect.any(String));

    expect(hooks.onPlayerReconnect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: guestId }));
    expect(gameStates(emitted).map((e) => e.view.secret)).toEqual([`secret-${guestId}`]);
    expect(emitted.filter((e) => e.event === 'game:state').map((e) => e.to)).toEqual([guestId]);
    expect(counterDefinition.typed!.getState(rm, roomCode)!.disconnected.has(guestId)).toBe(false);
  });

  it('onRoomDestroyed gets the running state when the last human leaves, and the game is stopped', () => {
    vi.useFakeTimers();
    const { rm, emitted, host, guest, roomCode } = startLobbyGame();
    const state = counterDefinition.typed!.getState(rm, roomCode)!;
    const instance = rm.getGameInstance(roomCode)!;

    guest.fire('room:leave');
    expect(hooks.onRoomDestroyed).not.toHaveBeenCalled();
    emitted.length = 0;
    host.fire('room:leave');

    expect(rm.getRoom(roomCode)).toBeUndefined();
    expect(instance.isCurrent()).toBe(false);
    expect(hooks.onRoomDestroyed).toHaveBeenCalledExactlyOnceWith({ roomCode, state });
    expect(gameStates(emitted)).toEqual([]);
  });

  it('onRoomDestroyed gets null state when no game was running', () => {
    const { rm, host, guest, roomCode } = startLobbyGame();
    rm.resetGame(roomCode);
    guest.fire('room:leave');
    host.fire('room:leave');
    expect(hooks.onRoomDestroyed).toHaveBeenCalledExactlyOnceWith({ roomCode, state: null });
  });
});
