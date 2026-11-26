import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionResult } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { dispatchGameAction, validateActionEnvelope, ACTION_LIMITS } from './actionBoundary.js';
import { GameRuleError, INTERNAL_ERROR_MESSAGE, isGameRuleError, toPublicError } from './errors.js';
import type { AppServer, AppSocket, ServerGameDefinition } from './gameDefinition.js';

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

// --- envelope ----------------------------------------------------------------

function nested(depth: number): unknown {
  let v: unknown = 1;
  for (let i = 0; i < depth; i++) v = [v];
  return v;
}

describe('validateActionEnvelope', () => {
  it.each([
    ['simple', { type: 'draw-card' }],
    ['with an array', { type: 'lockDice', diceIndices: [0, 2] }],
    ['with a nested card', { type: 'play-card', card: { suit: 'hearts', rank: 'K' }, target: 'north' }],
    ['with null and booleans', { type: 'x', a: null, b: false }],
    ['null prototype', Object.assign(Object.create(null) as object, { type: 'x' })],
    ['at max depth', { type: 'x', a: { b: { c: [1] } } }],
    ['at max string length', { type: 'x', s: 'a'.repeat(ACTION_LIMITS.maxStringLength) }],
    ['at max type length', { type: 't'.repeat(ACTION_LIMITS.maxTypeLength) }],
  ])('accepts %s', (_label, action) => {
    expect(validateActionEnvelope(action)).toEqual({ ok: true });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'bid'],
    ['a number', 1],
    ['an array', [{ type: 'bid' }]],
    ['a class instance', new (class Foo { type = 'x'; })()],
    ['a Date', new Date()],
    ['a Buffer value', { type: 'x', b: Buffer.from('hi') }],
    ['missing type', { quantity: 1 }],
    ['non-string type', { type: 7 }],
    ['empty type', { type: '' }],
    ['type too long', { type: 't'.repeat(ACTION_LIMITS.maxTypeLength + 1) }],
    ['inherited type', Object.create({ type: 'bid' }) as object],
    ['too deep (depth 5)', { type: 'x', a: { b: { c: { d: {} } } } }],
    ['too deep (array)', { type: 'x', a: nested(4) }],
    ['the 20k-deep poison payload', { type: 'play-card', card: { suit: 'clubs', rank: 'K', junk: nested(20_000) } }],
    ['too many keys', { type: 'x', ...Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, i])) }],
    ['too many elements', { type: 'x', a: Array.from({ length: 64 }, (_, i) => i) }],
    ['string too long', { type: 'x', s: 'a'.repeat(ACTION_LIMITS.maxStringLength + 1) }],
    ['nested string too long', { type: 'x', a: ['a'.repeat(ACTION_LIMITS.maxStringLength + 1)] }],
    ['key too long', { type: 'x', ['k'.repeat(ACTION_LIMITS.maxStringLength + 1)]: 1 }],
    ['__proto__ key', JSON.parse('{"type":"x","__proto__":{"polluted":true}}') as unknown],
    ['nested __proto__ key', JSON.parse('{"type":"x","card":{"__proto__":{}}}') as unknown],
    ['constructor key', { type: 'x', constructor: 1 }],
    ['prototype key', { type: 'x', a: { prototype: 1 } }],
    ['NaN', { type: 'x', n: NaN }],
    ['Infinity', { type: 'x', n: Infinity }],
    ['a function', { type: 'x', f: () => {} }],
  ])('rejects %s', (_label, action) => {
    const result = validateActionEnvelope(action);
    expect(result.ok).toBe(false);
  });
});

// --- errors ------------------------------------------------------------------

describe('GameRuleError / toPublicError', () => {
  it('defaults to RULE_VIOLATION and keeps its message', () => {
    const err = new GameRuleError('Bid is not high enough');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('RULE_VIOLATION');
    expect(err.name).toBe('GameRuleError');
    expect(new GameRuleError('Not your turn', 'NOT_YOUR_TURN').code).toBe('NOT_YOUR_TURN');
  });

  it('isGameRuleError recognizes the brand even without the same class identity', () => {
    const foreign = Object.assign(new Error('x'), { [Symbol.for('parlor.GameRuleError')]: true, code: 'RULE_VIOLATION' });
    expect(isGameRuleError(foreign)).toBe(true);
    expect(isGameRuleError(new Error('x'))).toBe(false);
    expect(isGameRuleError(null)).toBe(false);
  });

  it('passes GameRuleError through without logging', () => {
    expect(toPublicError(new GameRuleError('Not your turn', 'NOT_YOUR_TURN'), 'fallback')).toEqual({
      code: 'NOT_YOUR_TURN',
      message: 'Not your turn',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('hides any other error behind the fallback and logs it with context', () => {
    const raw = new TypeError("Cannot read properties of null (reading 'suit')");
    expect(toPublicError(raw, 'Failed to join room', { roomCode: 'ABCD' })).toEqual({
      code: 'INTERNAL',
      message: 'Failed to join room',
    });
    expect(toPublicError('a string')).toEqual({ code: 'INTERNAL', message: INTERNAL_ERROR_MESSAGE });
    expect(errorSpy).toHaveBeenCalledWith('[parlor] unexpected error', { roomCode: 'ABCD' }, raw);
  });
});

// --- dispatcher --------------------------------------------------------------

interface FakeSocket {
  id: string;
  data: { roomCode?: string; playerId?: string };
  emit: ReturnType<typeof vi.fn>;
}

const io = {} as AppServer;

function setup(handler: ServerGameDefinition['handleGameAction'], extra: Partial<ServerGameDefinition> = {}) {
  const rm = new RoomManager();
  const host = rm.createRoom('sockA', 'Ann');
  const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
  rm.setPlayerReady(host.playerId, true);
  rm.setPlayerReady(guest.playerId!, true);

  const handle = vi.fn(handler);
  const definition: ServerGameDefinition = {
    meta: {
      id: 'fake',
      name: 'Fake',
      description: '',
      minPlayers: 2,
      maxPlayers: 4,
      estimatedMinutes: '1',
      tags: [],
      displayModes: ['peer'],
    },
    createLobbyCallbacks: () => ({}),
    validateAction: (a) => ({ ok: true, action: a }),
    handleGameAction: handle,
    ...extra,
  };
  rm.selectGame(host.roomCode, definition.meta);
  rm.startGame(host.roomCode);
  rm.setGameData(host.roomCode, { engine: true });
  const onRoomFailure = vi.fn();
  const player: FakeSocket = { id: 'sockA', data: { roomCode: host.roomCode, playerId: host.playerId }, emit: vi.fn() };

  const send = async (socket: FakeSocket, action: unknown, def: ServerGameDefinition | null = definition) => {
    const ack = vi.fn();
    const result = await dispatchGameAction({
      io,
      socket: socket as unknown as AppSocket,
      roomManager: rm,
      definition: def,
      action,
      ack,
      onRoomFailure,
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledWith(result);
    return result;
  };

  return { rm, roomCode: host.roomCode, host, guest, definition, handle, onRoomFailure, player, send };
}

describe('dispatchGameAction', () => {
  it('calls the handler and acks ok for a valid action from a seated player', async () => {
    const t = setup(() => {});
    const result = await t.send(t.player, { type: 'lockDice', diceIndices: [0, 2] });
    expect(result).toEqual({ ok: true });
    expect(t.handle).toHaveBeenCalledTimes(1);
    expect(t.handle.mock.calls[0][3]).toEqual({ type: 'lockDice', diceIndices: [0, 2] });
    expect(t.player.emit).not.toHaveBeenCalled();
  });

  it('works without an ack, and tolerates a non-function ack', async () => {
    const t = setup(() => {});
    for (const ack of [undefined, 1, 'x', {}, null]) {
      const result = await dispatchGameAction({
        io,
        socket: t.player as unknown as AppSocket,
        roomManager: t.rm,
        definition: t.definition,
        action: { type: 'x' },
        ack,
        onRoomFailure: t.onRoomFailure,
      });
      expect(result).toEqual({ ok: true });
    }
    expect(t.handle).toHaveBeenCalledTimes(5);
  });

  it('rejects a bad envelope with INVALID_ACTION before any other check', async () => {
    const t = setup(() => {});
    const stranger: FakeSocket = { id: 'nobody', data: {}, emit: vi.fn() };
    expect(await t.send(stranger, null)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(await t.send(t.player, { type: 'x', a: { b: { c: { d: {} } } } })).toMatchObject({
      ok: false,
      code: 'INVALID_ACTION',
    });
    expect(t.handle).not.toHaveBeenCalled();
  });

  it('rejects a socket with no room, or a room that is gone, with NOT_IN_ROOM', async () => {
    const t = setup(() => {});
    expect(await t.send({ id: 'x', data: {}, emit: vi.fn() }, { type: 'x' })).toMatchObject({ code: 'NOT_IN_ROOM' });
    expect(await t.send({ id: 'x', data: { roomCode: 'ZZZZ', playerId: t.host.playerId }, emit: vi.fn() }, { type: 'x' }))
      .toMatchObject({ code: 'NOT_IN_ROOM' });
    expect(t.handle).not.toHaveBeenCalled();
  });

  it('rejects spectators and sockets acting for someone else with NOT_A_PLAYER', async () => {
    const t = setup(() => {});
    t.rm.addSpectator(t.roomCode, 'sockS');
    const spectator: FakeSocket = { id: 'sockS', data: { roomCode: t.roomCode }, emit: vi.fn() };
    expect(await t.send(spectator, { type: 'nextRound' })).toMatchObject({ ok: false, code: 'NOT_A_PLAYER' });

    // Spectator socket that also carries a (stale) playerId.
    spectator.data.playerId = t.host.playerId;
    expect(await t.send(spectator, { type: 'nextRound' })).toMatchObject({ code: 'NOT_A_PLAYER' });

    // A socket claiming another player's seat.
    const impostor: FakeSocket = { id: 'sockB', data: { roomCode: t.roomCode, playerId: t.host.playerId }, emit: vi.fn() };
    expect(await t.send(impostor, { type: 'x' })).toMatchObject({ code: 'NOT_A_PLAYER' });
    expect(t.handle).not.toHaveBeenCalled();
  });

  it('rejects when no game is running with NO_ACTIVE_GAME', async () => {
    const t = setup(() => {});
    expect(await t.send(t.player, { type: 'x' }, null)).toMatchObject({ code: 'NO_ACTIVE_GAME' });
    t.rm.resetGame(t.roomCode);
    expect(await t.send(t.player, { type: 'x' })).toMatchObject({ code: 'NO_ACTIVE_GAME' });
    expect(t.handle).not.toHaveBeenCalled();
  });

  it('runs the game validateAction hook and rejects with its message', async () => {
    const validateAction = vi.fn((a: Record<string, unknown>) =>
      a.type === 'ok' ? ({ ok: true, action: a } as const) : ({ ok: false, message: 'Unknown action' } as const),
    );
    const t = setup(() => {}, { validateAction });
    expect(await t.send(t.player, { type: 'nope' })).toEqual({ ok: false, code: 'INVALID_ACTION', message: 'Unknown action' });
    expect(t.handle).not.toHaveBeenCalled();
    expect(await t.send(t.player, { type: 'ok' })).toEqual({ ok: true });
    expect(t.handle).toHaveBeenCalledTimes(1);
  });

  it('passes the sanitized action from validateAction to the handler, not the client payload', async () => {
    const t = setup(() => {}, {
      validateAction: (a) => ({ ok: true, action: { type: a.type, card: { suit: 'hearts', rank: 'K' } } }),
    });
    const clientCard = { suit: 'hearts', rank: 'K' };
    await t.send(t.player, { type: 'play-card', card: clientCard });
    const received = t.handle.mock.calls[0][3] as { card: unknown };
    expect(received).toEqual({ type: 'play-card', card: { suit: 'hearts', rank: 'K' } });
    expect(received.card).not.toBe(clientCard);
  });

  it('a GameRuleError acks its code and message, emits error, and keeps the room', async () => {
    const t = setup(() => {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    });
    const result = await t.send(t.player, { type: 'x' });
    expect(result).toEqual({ ok: false, code: 'NOT_YOUR_TURN', message: 'Not your turn' });
    expect(t.player.emit).toHaveBeenCalledWith('error', 'Not your turn');
    expect(t.onRoomFailure).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('a GameRuleError from an async handler is handled the same way', async () => {
    const t = setup(async () => {
      await Promise.resolve();
      throw new GameRuleError('Bid is not high enough');
    });
    expect(await t.send(t.player, { type: 'x' })).toEqual({
      ok: false,
      code: 'RULE_VIOLATION',
      message: 'Bid is not high enough',
    });
    expect(t.onRoomFailure).not.toHaveBeenCalled();
  });

  it('an unexpected sync throw → INTERNAL generic message, logged, and onRoomFailure', async () => {
    const t = setup(() => {
      throw new TypeError("Cannot read properties of null (reading 'suit')");
    });
    const result = await t.send(t.player, { type: 'play-card', card: null });
    expect(result).toEqual({ ok: false, code: 'INTERNAL', message: 'Something went wrong' });
    expect(t.player.emit).toHaveBeenCalledWith('error', 'Something went wrong');
    expect(JSON.stringify(t.player.emit.mock.calls)).not.toMatch(/Cannot read/);
    expect(t.onRoomFailure).toHaveBeenCalledWith(t.roomCode);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('an async rejection → INTERNAL and onRoomFailure (no unhandled rejection)', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const t = setup(async () => {
        await new Promise((r) => setTimeout(r, 5));
        throw new RangeError('Maximum call stack size exceeded');
      });
      const result = await t.send(t.player, { type: 'x' });
      expect(result).toEqual({ ok: false, code: 'INTERNAL', message: 'Something went wrong' });
      expect(t.onRoomFailure).toHaveBeenCalledWith(t.roomCode);
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('acks ok only after an async handler resolves', async () => {
    let release!: () => void;
    const t = setup(() => new Promise<void>((r) => (release = r)));
    const ack = vi.fn();
    const pending = dispatchGameAction({
      io,
      socket: t.player as unknown as AppSocket,
      roomManager: t.rm,
      definition: t.definition,
      action: { type: 'x' },
      ack,
      onRoomFailure: t.onRoomFailure,
    });
    await Promise.resolve();
    expect(ack).not.toHaveBeenCalled();
    release();
    expect(await pending).toEqual({ ok: true });
    expect(ack).toHaveBeenCalledWith({ ok: true } satisfies ActionResult);
  });

  it('a throwing onRoomFailure is contained', async () => {
    const t = setup(() => {
      throw new Error('boom');
    });
    t.onRoomFailure.mockImplementation(() => {
      throw new Error('reset failed');
    });
    expect(await t.send(t.player, { type: 'x' })).toMatchObject({ code: 'INTERNAL' });
  });

  it('a throwing validateAction is INTERNAL but does not fail the room (no game code ran)', async () => {
    const t = setup(() => {}, {
      validateAction: () => {
        throw new Error('validator bug');
      },
    });
    expect(await t.send(t.player, { type: 'x' })).toEqual({ ok: false, code: 'INTERNAL', message: 'Something went wrong' });
    expect(t.onRoomFailure).not.toHaveBeenCalled();
    expect(t.handle).not.toHaveBeenCalled();
  });
});
