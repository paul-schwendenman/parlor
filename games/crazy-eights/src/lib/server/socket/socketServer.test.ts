/**
 * The standalone Crazy Eights server over real sockets (plan 3.1b): views arrive
 * as `{ gameId: 'crazy-eights', view }` and actions still go through the boundary.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import type { ActionResult, GameStateEnvelope } from '@parlor/game-types';
import type { AppServer } from '@parlor/multiplayer';
import type { GameSocket } from '@parlor/multiplayer/client';
import { setupCrazyEightsSocketHandlers } from './socketServer.js';

let http: HttpServer;
let io: AppServer;
let clients: GameSocket<'crazy-eights'>[];

beforeEach(async () => {
  clients = [];
  http = createServer();
  io = new Server(http);
  setupCrazyEightsSocketHandlers(io);
  await new Promise<void>((resolve) => http.listen(0, resolve));
});

afterEach(async () => {
  for (const c of clients) c.close();
  await io.close();
});

async function connect() {
  const port = (http.address() as AddressInfo).port;
  const socket: GameSocket<'crazy-eights'> = ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    reconnection: false,
  });
  clients.push(socket);
  const states: GameStateEnvelope[] = [];
  socket.on('game:state', (s) => states.push(s));
  await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
  return { socket, states };
}

function ack<T extends unknown[]>(emit: (cb: (...args: T) => void) => void): Promise<T> {
  return new Promise((resolve) => emit((...args) => resolve(args)));
}

async function waitFor(pred: () => boolean): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > 2000) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

it('sends crazy-eights envelopes and accepts a move', async () => {
  const host = await connect();
  const guest = await connect();
  const [created] = await ack<[{ roomCode: string } | null]>((cb) => host.socket.emit('lobby:create', 'Ann', cb));
  const roomCode = created!.roomCode;
  await ack((cb) => guest.socket.emit('lobby:join', roomCode, 'Bob', cb));
  await ack((cb) => host.socket.emit('lobby:ready', true, cb));
  await ack((cb) => guest.socket.emit('lobby:ready', true, cb));
  const [started] = await ack<[boolean]>((cb) => host.socket.emit('lobby:startGame', cb));
  expect(started).toBe(true);
  await waitFor(() => host.states.length > 0 && guest.states.length > 0);

  for (const c of [host, guest]) {
    const [envelope] = c.states;
    expect(envelope.gameId).toBe('crazy-eights');
    if (envelope.gameId !== 'crazy-eights') return;
    expect(envelope.view.myHand).toHaveLength(7);
  }

  const active = [host, guest].find((c) => {
    const last = c.states.at(-1)!;
    return last.gameId === 'crazy-eights' && last.view.isActivePlayer;
  })!;
  const before = active.states.length;
  const [result] = await ack<[ActionResult]>((cb) => active.socket.emit('game:action', { type: 'draw-card' }, cb));
  expect(result).toEqual({ ok: true });
  await waitFor(() => active.states.length > before);
});
