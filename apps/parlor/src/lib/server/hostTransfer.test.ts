import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, expect, it } from 'vitest';
import { setupParlorSocketHandlers } from './socketServer.js';

// Plans 8.6 (pass the host role by hand) and 8.7 (the host keeps the role
// through a short reconnect window), over real sockets.

let io: AppServer | undefined;
const clients: Socket[] = [];

afterEach(async () => {
	for (const socket of clients.splice(0)) socket.close();
	await io?.close();
	io = undefined;
});

async function start(rm: RoomManager): Promise<string> {
	const http = createServer();
	io = new Server(http);
	setupParlorSocketHandlers(io, rm);
	await new Promise<void>(resolve => http.listen(0, resolve));
	return `http://localhost:${(http.address() as AddressInfo).port}`;
}

async function participant(url: string) {
	const socket = connect(url, { transports: ['websocket'], reconnection: false });
	clients.push(socket);
	const hosts: string[] = [];
	/** The reason sent with each change (undefined for a sync). */
	const reasons: (string | undefined)[] = [];
	socket.on('lobby:hostChanged', (id, reason) => {
		hosts.push(id);
		reasons.push(reason);
	});
	await new Promise<void>((resolve, reject) => {
		socket.once('connect', resolve);
		socket.once('connect_error', reject);
	});
	/** Every argument of the acknowledgement (emitWithAck keeps only the first). */
	const ask = (event: 'lobby:transferHost' | 'lobby:selectGame', arg: string) =>
		new Promise<unknown[]>((resolve, reject) => {
			socket.timeout(2000).emit(event, arg, (error: Error | null, ...reply: unknown[]) => {
				if (error) reject(error);
				else resolve(reply);
			});
		});
	return { request: socket.timeout(2000), socket, hosts, reasons, ask };
}

async function lobby(url: string) {
	const host = await participant(url);
	const { roomCode, playerId: hostId, reconnectToken } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant(url);
	const { playerId: guestId } = await guest.request.emitWithAck('lobby:join', roomCode, 'Guest');
	const friend = await participant(url);
	await friend.request.emitWithAck('lobby:join', roomCode, 'Friend');
	const watcher = await participant(url);
	expect(await watcher.request.emitWithAck('lobby:spectate', roomCode)).toBe(true);
	for (const p of [host, guest, friend, watcher]) {
		p.hosts.length = 0;
		p.reasons.length = 0;
	}
	return { host, guest, friend, watcher, roomCode, hostId, guestId: guestId!, reconnectToken };
}

it('tells every player and spectator about a hand-over, and nobody about a refused one', async () => {
	const rm = new RoomManager();
	const url = await start(rm);
	const { host, guest, friend, watcher, roomCode, hostId, guestId } = await lobby(url);

	expect(await guest.ask('lobby:transferHost', guestId)).toEqual([false, 'Only the host can pass the host role on']);
	expect(await watcher.ask('lobby:transferHost', guestId)).toEqual([false, 'Not in a room']);
	expect(await host.ask('lobby:transferHost', hostId)).toEqual([false, 'You are already the host']);
	expect(await host.ask('lobby:transferHost', guestId)).toEqual([true]);

	for (const p of [host, guest, friend, watcher]) await expect.poll(() => p.hosts).toEqual([guestId]);
	for (const p of [host, guest, friend, watcher]) expect(p.reasons).toEqual(['transfer']);
	expect(rm.getRoom(roomCode)?.hostId).toBe(guestId);

	// The new host can drive the ballot; the old one can't.
	expect(await host.ask('lobby:selectGame', 'quixx')).toEqual([false, 'Only the host can select the game']);
	expect(await guest.ask('lobby:selectGame', 'quixx')).toEqual([true]);
});

it('keeps the role through a quick reconnect and hands it on after the window', async () => {
	// A window long enough that reconnecting a fresh socket fits inside it even
	// when the whole test suite runs in parallel.
	const rm = new RoomManager(5_000, undefined, 1_500);
	const url = await start(rm);
	const { host, guest, watcher, roomCode, hostId, guestId, reconnectToken } = await lobby(url);

	host.socket.close();
	await expect.poll(() => rm.getRoom(roomCode)?.players.get(hostId)?.connected).toBe(false);
	const back = await participant(url);
	expect(await back.request.emitWithAck('player:reconnect', roomCode, hostId, reconnectToken)).toBe(true);
	await expect.poll(() => back.hosts).toEqual([hostId]);
	// The returning host is only told who hosts: a sync, with no reason.
	expect(back.reasons).toEqual([undefined]);
	await new Promise(resolve => setTimeout(resolve, 1_700));
	expect(guest.hosts).toEqual([]);
	expect(rm.getRoom(roomCode)?.hostId).toBe(hostId);

	back.socket.close();
	await new Promise(resolve => setTimeout(resolve, 100));
	expect(guest.hosts).toEqual([]);
	await expect.poll(() => guest.hosts, { timeout: 4_000 }).toEqual([guestId]);
	await expect.poll(() => watcher.hosts, { timeout: 4_000 }).toEqual([guestId]);
	expect(guest.reasons).toEqual(['handoff']);
	expect(watcher.reasons).toEqual(['handoff']);
});
