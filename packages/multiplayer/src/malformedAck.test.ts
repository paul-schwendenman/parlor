/**
 * Regression for CORE-AUDIT F-01 (A-01 / B-01): a non-function value in the ack
 * position used to crash the whole process, because `callback?.()` only skips
 * null/undefined and socket.io dispatches listeners with no try/catch.
 *
 * Runs over a real socket.io server and client, since the crash path is inside
 * socket.io's own dispatch, not our handler.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers } from './lobbyHandlers.js';
import { safeAck } from './ack.js';

const BAD_ACKS: unknown[] = [1, 0, 'x', true, {}, [], null];

let http: HttpServer;
let io: Server;
let client: ClientSocket;
let uncaught: unknown[];
const onUncaught = (err: unknown) => uncaught.push(err);

function ackOnce<T extends unknown[]>(emit: (cb: (...args: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no ack within 2s')), 2000);
    emit((...args) => {
      clearTimeout(t);
      resolve(args);
    });
  });
}

/** Give the server a few ticks to process (and, before the fix, crash on) queued packets. */
const settle = () => new Promise((r) => setTimeout(r, 50));

beforeEach(async () => {
  uncaught = [];
  process.on('uncaughtException', onUncaught);
  http = createServer();
  io = new Server(http);
  const rm = new RoomManager();
  io.on('connection', (s) => setupLobbyHandlers(io as never, s as never, rm, {}));
  await new Promise<void>((r) => http.listen(0, r));
  const { port } = http.address() as AddressInfo;
  client = ioc(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
  await new Promise<void>((r) => client.on('connect', () => r()));
});

afterEach(async () => {
  process.off('uncaughtException', onUncaught);
  client.close();
  await io.close();
});

describe('malformed ack arguments (F-01)', () => {
  it.each(BAD_ACKS)('lobby:ready with ack=%j does not crash, and the server keeps serving', async (bad) => {
    const [create] = await ackOnce<[{ roomCode: string }]>((cb) => client.emit('lobby:create', 'Host', cb));
    expect(create.roomCode).toMatch(/^[A-Z2-9]{6}$/);

    client.emit('lobby:ready', true, bad);
    await settle();

    expect(uncaught).toEqual([]);
    const [ok] = await ackOnce<[boolean]>((cb) => client.emit('lobby:ready', false, cb));
    expect(ok).toBe(true);
  });

  it.each(BAD_ACKS)('lobby:startGame with ack=%j does not crash, and the server keeps serving', async (bad) => {
    await ackOnce((cb) => client.emit('lobby:create', 'Host', cb));

    // Not-ready path (returns early) and the not-in-a-room path are both exercised.
    client.emit('lobby:startGame', bad);
    await settle();

    expect(uncaught).toEqual([]);
    const [ok, err] = await ackOnce<[boolean, string?]>((cb) => client.emit('lobby:startGame', cb));
    expect(ok).toBe(false);
    expect(err).toEqual(expect.any(String));
  });

  it('lobby:ready with a bad ack before joining any room does not crash', async () => {
    client.emit('lobby:ready', true, 1);
    await settle();
    expect(uncaught).toEqual([]);
    const [ok] = await ackOnce<[boolean, string?]>((cb) => client.emit('lobby:ready', true, cb));
    expect(ok).toBe(false);
  });
});

describe('safeAck', () => {
  it('returns the callback when it is a function', () => {
    const fn = () => undefined;
    expect(safeAck(fn)).toBe(fn);
  });

  it.each([undefined, ...BAD_ACKS])('returns a callable no-op for %j', (bad) => {
    const ack = safeAck(bad as never as (ok: boolean) => void);
    expect(() => ack(true)).not.toThrow();
  });
});
