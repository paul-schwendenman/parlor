import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { GameBallotSnapshot } from '@parlor/game-types';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { setupParlorSocketHandlers } from './socketServer.js';

let io: AppServer;
let url: string;
const clients: Socket[] = [];

beforeEach(async () => {
	const http = createServer();
	io = new Server(http);
	setupParlorSocketHandlers(io, new RoomManager(500));
	await new Promise<void>(resolve => http.listen(0, resolve));
	url = `http://localhost:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
	for (const socket of clients.splice(0)) socket.close();
	await io.close();
});

async function participant() {
	const socket = connect(url, { transports: ['websocket'], reconnection: false });
	clients.push(socket);
	let ballot: GameBallotSnapshot | null = null;
	socket.on('lobby:ballot', (_roomCode, snapshot) => { ballot = snapshot; });
	await new Promise<void>((resolve, reject) => {
		socket.once('connect', resolve);
		socket.once('connect_error', reject);
	});
	return { request: socket.timeout(2000), socket, ballot: () => ballot };
}

it('keeps one private vote per seat and rejects conflicting room changes', async () => {
	const host = await participant();
	const { roomCode } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant();
	expect(await guest.request.emitWithAck('lobby:join', roomCode, 'Guest')).toMatchObject({ success: true });
	const watcher = await participant();
	expect(await watcher.request.emitWithAck('lobby:spectate', roomCode)).toBe(true);
	await expect.poll(watcher.ballot).toMatchObject({ totals: {}, myVote: null });
	const round = watcher.ballot()!.roundId;

	expect(await watcher.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(false);
	expect(await guest.request.emitWithAck('lobby:confirmGame', round, 'quixx')).toBe(false);
	expect(await guest.request.emitWithAck('lobby:vote', round, 'unknown')).toBe(false);
	expect(await guest.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(true);
	expect(await guest.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ totals: { quixx: 1 }, myVote: 'quixx' });
	await expect.poll(watcher.ballot).toMatchObject({ totals: { quixx: 1 }, myVote: null });
	expect(await guest.request.emitWithAck('lobby:vote', round, 'kings-corner')).toBe(true);

	for (const name of ['Friend A', 'Friend B', 'Friend C']) {
		const friend = await participant();
		expect(await friend.request.emitWithAck('lobby:join', roomCode, name)).toMatchObject({ success: true });
	}
	expect(await host.request.emitWithAck('lobby:confirmGame', round, 'kings-corner')).toBe(false);
	await expect.poll(host.ballot).toMatchObject({ totals: { 'kings-corner': 1 }, roundId: round });
	expect(await guest.request.emitWithAck('lobby:vote', round, null)).toBe(true);
	await expect.poll(host.ballot).toMatchObject({ totals: {} });
	expect(await host.request.emitWithAck('lobby:confirmGame', round, 'quixx')).toBe(true);
	await expect.poll(guest.ballot).toBeNull();
	expect(await host.request.emitWithAck('lobby:selectGame', null)).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ roundId: expect.any(String), totals: {} });
	expect(guest.ballot()?.roundId).not.toBe(round);
	expect(await guest.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(false);
});

it('keeps a disconnected host vote through migration and drops it on seat expiry', async () => {
	const host = await participant();
	const { roomCode } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant();
	const { playerId } = await guest.request.emitWithAck('lobby:join', roomCode, 'Guest');
	await expect.poll(guest.ballot).toMatchObject({ totals: {} });
	const round = guest.ballot()!.roundId;
	expect(await host.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ totals: { quixx: 1 } });

	const hostChanged = new Promise(resolve => guest.socket.once('lobby:hostChanged', resolve));
	host.socket.close();
	expect(await hostChanged).toBe(playerId);
	expect(guest.ballot()?.totals).toEqual({ quixx: 1 });
	await expect.poll(() => guest.ballot()?.totals).toEqual({});
	expect(await guest.request.emitWithAck('lobby:confirmGame', round, 'quixx')).toBe(true);
});
