import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, ServerToClientEvents } from '@parlor/game-types';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers } from './lobbyHandlers.js';
import type { AppServer } from './server.js';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let io: AppServer;
let roomManager: RoomManager;
let url: string;
let clients: Client[];

beforeEach(async () => {
  const server = createServer();
  io = new Server(server);
  roomManager = new RoomManager(25);
  clients = [];
  io.on('connection', (socket) => setupLobbyHandlers(io, socket, roomManager, undefined, {
    defaultMaxPlayers: 2,
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  await io.close();
});

async function makeClient(): Promise<Client> {
  const client: Client = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ackTimeout: 1_000,
  });
  clients.push(client);
  await once(client, 'connect');
  return client;
}

it('keeps the original seat and its broadcasts when a join is rejected', async () => {
  const [originalHost, guest, targetHost, targetGuest] = await Promise.all([
    makeClient(), makeClient(), makeClient(), makeClient(),
  ]);
  const original = await originalHost.emitWithAck('lobby:create', 'Original host');
  const seat = await guest.emitWithAck('lobby:join', original.roomCode, 'Guest');
  const target = await targetHost.emitWithAck('lobby:create', 'Target host');
  await targetGuest.emitWithAck('lobby:join', target.roomCode, 'Target guest');
  const targetBefore = structuredClone(roomManager.getRoom(target.roomCode));
  const unusedRoomCode = roomManager.getRoom('VOID') ? 'NONE' : 'VOID';

  for (const code of [target.roomCode, unusedRoomCode]) {
    expect(await guest.emitWithAck('lobby:join', code, 'Guest')).toMatchObject({ success: false });
    expect(roomManager.getRoom(target.roomCode)).toEqual(targetBefore);
    expect(roomManager.getPlayerIdBySocket(guest.id ?? '')).toBe(seat.playerId);
    expect(roomManager.getPlayersInRoom(original.roomCode)).toContainEqual(
      expect.objectContaining({ id: seat.playerId, connected: true }),
    );
    const players = new Promise((resolve) => guest.once('lobby:state', resolve));
    expect(await originalHost.emitWithAck('lobby:ready', true)).toBe(true);
    expect(await players).toContainEqual(expect.objectContaining({ id: original.playerId, isReady: true }));
  }
});

it('removes old public and private room memberships during successful seat changes', async () => {
  const [host, guest, targetHost] = await Promise.all([makeClient(), makeClient(), makeClient()]);
  const original = await host.emitWithAck('lobby:create', 'Host');
  const guestSeat = await guest.emitWithAck('lobby:join', original.roomCode, 'Guest');
  const target = await targetHost.emitWithAck('lobby:create', 'Target host');
  const socket = io.sockets.sockets.get(guest.id ?? '');
  expect(await guest.emitWithAck('lobby:spectate', target.roomCode)).toBe(true);
  expect(roomManager.getRoom(original.roomCode)?.players.has(guestSeat.playerId ?? '')).toBe(false);
  expect(socket?.rooms.has(original.roomCode)).toBe(false);
  expect(socket?.rooms.has(guestSeat.playerId ?? '')).toBe(false);
  expect(socket?.rooms.has(target.roomCode)).toBe(true);
  expect(socket?.data.playerId).toBe('');

  const created = await guest.emitWithAck('lobby:create', 'New host');
  expect(roomManager.getSpectatorsInRoom(target.roomCode)).toEqual([]);
  expect(socket?.rooms.has(target.roomCode)).toBe(false);
  expect(await guest.emitWithAck('lobby:join', target.roomCode, 'New guest')).toMatchObject({ success: true });
  expect(roomManager.getRoom(created.roomCode)).toBeUndefined();
  expect(socket?.rooms.has(created.roomCode)).toBe(false);
});

it('rotates the token, disconnects the old socket, and keeps the new seat through grace', async () => {
  const [old, replacement, other] = await Promise.all([makeClient(), makeClient(), makeClient()]);
  const seat = await old.emitWithAck('lobby:create', 'Host');
  const previous = await replacement.emitWithAck('lobby:create', 'Previous room');

  const oldDisconnected = once(old, 'disconnect');
  const [success, token] = await new Promise<[boolean, string?]>((resolve, reject) => {
    replacement.timeout(1_000).emit(
      'player:reconnect', seat.roomCode, seat.playerId, seat.reconnectToken,
      (error, accepted, rotated) => {
        if (error) reject(error);
        else resolve([accepted, rotated]);
      },
    );
  });
  expect(success).toBe(true);
  expect(token).toEqual(expect.any(String));
  expect(token).not.toBe(seat.reconnectToken);
  await oldDisconnected;
  expect(roomManager.getRoom(previous.roomCode)).toBeUndefined();

  const otherSeat = await other.emitWithAck('lobby:create', 'Other');
  expect(await other.emitWithAck('player:reconnect', seat.roomCode, seat.playerId, seat.reconnectToken)).toBe(false);
  expect(roomManager.getRoom(otherSeat.roomCode)?.players.has(otherSeat.playerId)).toBe(true);
  expect(await other.emitWithAck('lobby:ready', true)).toBe(true);

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(roomManager.getRoom(seat.roomCode)?.players.get(seat.playerId)?.connected).toBe(true);
  expect(await replacement.emitWithAck('lobby:ready', true)).toBe(true);
});
