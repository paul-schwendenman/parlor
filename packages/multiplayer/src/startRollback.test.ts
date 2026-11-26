/**
 * Regression for CORE-AUDIT B-08 (F-17): if a game's `onGameStart` throws, the
 * room used to stay `playing` with no game, and the host got the raw error text.
 * Now the start is rolled back to the lobby and only a generic message is sent.
 * Real socket.io server + client.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';

let http: HttpServer;
let io: Server;
let rm: RoomManager;
let host: ClientSocket;
let guest: ClientSocket;
let callbacks: LobbyCallbacks;
let throwOnStart: boolean;
let errorSpy: ReturnType<typeof vi.spyOn>;

function ackOnce<T extends unknown[]>(emit: (cb: (...args: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no ack within 2s')), 2000);
    emit((...args) => {
      clearTimeout(t);
      resolve(args);
    });
  });
}

function nextEvent<T extends unknown[]>(s: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within 2s`)), 2000);
    s.once(event, (...args: unknown[]) => {
      clearTimeout(t);
      resolve(args as T);
    });
  });
}

const settle = () => new Promise((r) => setTimeout(r, 50));

function connect(port: number): Promise<ClientSocket> {
  const s = ioc(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
  return new Promise((r) => s.on('connect', () => r(s)));
}

beforeEach(async () => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  throwOnStart = true;
  callbacks = {
    onGameStart: vi.fn((roomCode: string) => {
      rm.setGameData(roomCode, { engine: 'half-built' });
      if (throwOnStart) throw new TypeError("Cannot read properties of undefined (reading 'secret')");
      rm.setGameData(roomCode, { engine: 'ok' });
    }),
    onGameReset: vi.fn(),
  };
  http = createServer();
  io = new Server(http);
  rm = new RoomManager();
  io.on('connection', (s) => setupLobbyHandlers(io as never, s as never, rm, callbacks));
  await new Promise<void>((r) => http.listen(0, r));
  const { port } = http.address() as AddressInfo;
  host = await connect(port);
  guest = await connect(port);
});

afterEach(async () => {
  errorSpy.mockRestore();
  host.close();
  guest.close();
  await io.close();
});

async function seatAndReady(): Promise<string> {
  const [{ roomCode }] = await ackOnce<[{ roomCode: string }]>((cb) => host.emit('lobby:create', 'Host', cb));
  rm.selectGame(roomCode, { id: 'test', minPlayers: 2, maxPlayers: 4 });
  await ackOnce((cb) => guest.emit('lobby:join', roomCode, 'Guest', cb));
  await ackOnce((cb) => host.emit('lobby:ready', true, cb));
  await ackOnce((cb) => guest.emit('lobby:ready', true, cb));
  return roomCode;
}

describe('lobby start rollback (B-08)', () => {
  it('startGame: onGameStart throwing rolls back to waiting and acks a generic message', async () => {
    const roomCode = await seatAndReady();
    const starting = vi.fn();
    host.on('lobby:gameStarting', starting);
    guest.on('lobby:gameStarting', starting);
    const guestLobby = nextEvent(guest, 'lobby:state');

    const [ok, message] = await ackOnce<[boolean, string?]>((cb) => host.emit('lobby:startGame', cb));
    expect(ok).toBe(false);
    expect(message).toBe('Failed to start game');
    expect(message).not.toMatch(/Cannot read|secret/);

    await guestLobby;
    const room = rm.getRoom(roomCode)!;
    expect(room.status).toBe('waiting');
    expect(room.gameData).toBeNull();
    expect(callbacks.onGameReset).toHaveBeenCalledWith(roomCode, expect.anything());
    await settle();
    // Clients were never told the game was starting, so nobody is stranded on the game page.
    expect(starting).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    // A valid request afterward succeeds: re-ready and start for real.
    throwOnStart = false;
    await ackOnce((cb) => host.emit('lobby:ready', true, cb));
    await ackOnce((cb) => guest.emit('lobby:ready', true, cb));
    const [ok2] = await ackOnce<[boolean, string?]>((cb) => host.emit('lobby:startGame', cb));
    expect(ok2).toBe(true);
    expect(rm.getRoom(roomCode)!.status).toBe('playing');
    expect(rm.getGameData(roomCode)).toEqual({ engine: 'ok' });
  });

  it('restartGame: onGameStart throwing rolls back to waiting and emits a generic error', async () => {
    const roomCode = await seatAndReady();
    throwOnStart = false;
    await ackOnce((cb) => host.emit('lobby:startGame', cb));
    expect(rm.getRoom(roomCode)!.status).toBe('playing');

    throwOnStart = true;
    const hostError = nextEvent<[string]>(host, 'error');
    const guestLobby = nextEvent(guest, 'lobby:state');
    host.emit('lobby:restartGame');
    const [message] = await hostError;
    await guestLobby;
    expect(message).toBe('Failed to restart game');
    expect(rm.getRoom(roomCode)!.status).toBe('waiting');
    expect(rm.getGameData(roomCode)).toBeNull();

    // And the room still works.
    throwOnStart = false;
    await ackOnce((cb) => host.emit('lobby:ready', true, cb));
    await ackOnce((cb) => guest.emit('lobby:ready', true, cb));
    const [ok] = await ackOnce<[boolean, string?]>((cb) => host.emit('lobby:startGame', cb));
    expect(ok).toBe(true);
  });
});
