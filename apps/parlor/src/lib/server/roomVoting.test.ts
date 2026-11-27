import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { GameBallotSnapshot } from '@parlor/game-types';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { setupParlorSocketHandlers } from './socketServer.js';

let io: AppServer;
let rm: RoomManager;
let url: string;
const clients: Socket[] = [];

beforeEach(async () => {
	const http = createServer();
	io = new Server(http);
	rm = new RoomManager(500);
	setupParlorSocketHandlers(io, rm);
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
	await expect.poll(watcher.ballot).toMatchObject({ totals: {}, votes: {}, myVote: null, currentGameId: null });
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
	const hostId = Object.keys(guest.ballot()!.votes)[0];
	expect(guest.ballot()!.votes).toEqual({ [hostId]: 'quixx' });

	const hostChanged = new Promise(resolve => guest.socket.once('lobby:hostChanged', resolve));
	host.socket.close();
	expect(await hostChanged).toBe(playerId);
	expect(guest.ballot()?.totals).toEqual({ quixx: 1 });
	await expect.poll(() => guest.ballot()?.totals).toEqual({});
	expect(guest.ballot()?.votes).toEqual({});
	expect(await guest.request.emitWithAck('lobby:confirmGame', round, 'quixx')).toBe(true);
});

it('shows every recipient who voted for what, and only their own vote as theirs', async () => {
	const host = await participant();
	const { roomCode, playerId: hostId } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant();
	const { playerId: guestId } = await guest.request.emitWithAck('lobby:join', roomCode, 'Guest');
	const friend = await participant();
	const { playerId: friendId } = await friend.request.emitWithAck('lobby:join', roomCode, 'Friend');
	const watcher = await participant();
	expect(await watcher.request.emitWithAck('lobby:spectate', roomCode)).toBe(true);
	await expect.poll(watcher.ballot).toMatchObject({ votes: {} });
	const round = watcher.ballot()!.roundId;

	expect(await host.request.emitWithAck('lobby:vote', round, 'hearts')).toBe(true);
	expect(await guest.request.emitWithAck('lobby:vote', round, 'hearts')).toBe(true);
	expect(await friend.request.emitWithAck('lobby:vote', round, 'quixx')).toBe(true);

	const votes = { [hostId]: 'hearts', [guestId]: 'hearts', [friendId]: 'quixx' };
	const totals = { hearts: 2, quixx: 1 };
	await expect.poll(host.ballot).toEqual({ roundId: round, totals, votes, myVote: 'hearts', currentGameId: null });
	await expect.poll(guest.ballot).toEqual({ roundId: round, totals, votes, myVote: 'hearts', currentGameId: null });
	await expect.poll(friend.ballot).toEqual({ roundId: round, totals, votes, myVote: 'quixx', currentGameId: null });
	await expect.poll(watcher.ballot).toEqual({ roundId: round, totals, votes, myVote: null, currentGameId: null });

	// Clearing a vote removes the voter, not just the count.
	expect(await friend.request.emitWithAck('lobby:vote', round, null)).toBe(true);
	await expect.poll(() => watcher.ballot()?.votes).toEqual({ [hostId]: 'hearts', [guestId]: 'hearts' });
	expect(watcher.ballot()?.totals).toEqual({ hearts: 2 });

	// The host can still play a game nobody voted for, which closes the ballot.
	expect(await host.request.emitWithAck('lobby:confirmGame', round, 'quixx')).toBe(true);
	await expect.poll(watcher.ballot).toBeNull();
});

it('reopens the ballot with the current game kept, and Keep restores the room exactly', async () => {
	const host = await participant();
	const { roomCode } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant();
	expect(await guest.request.emitWithAck('lobby:join', roomCode, 'Guest')).toMatchObject({ success: true });
	const friend = await participant();
	expect(await friend.request.emitWithAck('lobby:join', roomCode, 'Friend')).toMatchObject({ success: true });
	const watcher = await participant();
	expect(await watcher.request.emitWithAck('lobby:spectate', roomCode)).toBe(true);
	expect(await host.request.emitWithAck('lobby:addBot')).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ currentGameId: null });
	const firstRound = guest.ballot()!.roundId;
	expect(await host.request.emitWithAck('lobby:confirmGame', firstRound, 'quixx')).toBe(true);
	await expect.poll(guest.ballot).toBeNull();
	expect(await guest.request.emitWithAck('lobby:ready', true)).toBe(true);
	const confirmed = structuredClone(rm.getRoom(roomCode));
	expect(confirmed).toMatchObject({ gameId: 'quixx', maxPlayers: 5 });
	expect(confirmed?.players.size).toBe(4);

	// Rejected requests leave the confirmed room untouched.
	expect(await guest.request.emitWithAck('lobby:selectGame', null)).toBe(false);
	expect(await watcher.request.emitWithAck('lobby:selectGame', null)).toBe(false);
	expect(await host.request.emitWithAck('lobby:keepGame', firstRound)).toBe(false);
	expect(rm.getRoom(roomCode)).toEqual(confirmed);

	// Change game: the ballot reopens naming the current game; readiness stays.
	expect(await host.request.emitWithAck('lobby:selectGame', null)).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ currentGameId: 'quixx', totals: {}, votes: {} });
	await expect.poll(watcher.ballot).toMatchObject({ currentGameId: 'quixx', myVote: null });
	const round = guest.ballot()!.roundId;
	expect(round).not.toBe(firstRound);
	expect(rm.getRoom(roomCode)?.gameId).toBeNull();
	expect(rm.getPlayersInRoom(roomCode).find(p => p.name === 'Guest')?.isReady).toBe(true);
	expect(await friend.request.emitWithAck('lobby:vote', round, 'kings-corner')).toBe(true);
	await expect.poll(host.ballot).toMatchObject({ totals: { 'kings-corner': 1 } });

	// Only the host, on this round, can keep it.
	const reopened = structuredClone(rm.getRoom(roomCode));
	expect(await guest.request.emitWithAck('lobby:keepGame', round)).toBe(false);
	expect(await watcher.request.emitWithAck('lobby:keepGame', round)).toBe(false);
	expect(await host.request.emitWithAck('lobby:keepGame', firstRound)).toBe(false);
	expect(await host.request.emitWithAck('lobby:keepGame', 42)).toBe(false);
	expect(rm.getRoom(roomCode)).toEqual(reopened);
	expect(host.ballot()?.roundId).toBe(round);

	const state = new Promise<boolean>(resolve => guest.socket.once('lobby:state', (_players, canStart) => resolve(canStart)));
	expect(await host.request.emitWithAck('lobby:keepGame', round)).toBe(true);
	expect(await state).toBe(false);
	await expect.poll(guest.ballot).toBeNull();
	await expect.poll(watcher.ballot).toBeNull();
	expect(rm.getRoom(roomCode)).toEqual(confirmed);
	expect(await host.request.emitWithAck('lobby:keepGame', round)).toBe(false);
	expect(rm.getRoom(roomCode)).toEqual(confirmed);

	// A valid change afterwards still works; a different game asks guests to ready again.
	expect(await host.request.emitWithAck('lobby:selectGame', null)).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ currentGameId: 'quixx' });
	expect(await host.request.emitWithAck('lobby:confirmGame', guest.ballot()!.roundId, 'kings-corner')).toBe(true);
	await expect.poll(guest.ballot).toBeNull();
	expect(rm.getRoom(roomCode)?.gameId).toBe('kings-corner');
	expect(Object.fromEntries(rm.getPlayersInRoom(roomCode).map(p => [p.isBot ? 'bot' : p.name, p.isReady])))
		.toEqual({ Host: false, Guest: false, Friend: false, bot: true });
});

it('keeps readiness when the host plays the current game from a reopened ballot', async () => {
	const host = await participant();
	const { roomCode } = await host.request.emitWithAck('lobby:create', 'Host');
	const guest = await participant();
	expect(await guest.request.emitWithAck('lobby:join', roomCode, 'Guest')).toMatchObject({ success: true });
	await expect.poll(guest.ballot).toMatchObject({ currentGameId: null });
	expect(await host.request.emitWithAck('lobby:confirmGame', guest.ballot()!.roundId, 'quixx')).toBe(true);
	expect(await guest.request.emitWithAck('lobby:ready', true)).toBe(true);
	await expect.poll(guest.ballot).toBeNull();
	const confirmed = structuredClone(rm.getRoom(roomCode));

	expect(await host.request.emitWithAck('lobby:selectGame', null)).toBe(true);
	await expect.poll(guest.ballot).toMatchObject({ currentGameId: 'quixx' });
	expect(await host.request.emitWithAck('lobby:confirmGame', guest.ballot()!.roundId, 'quixx')).toBe(true);
	await expect.poll(guest.ballot).toBeNull();
	expect(rm.getRoom(roomCode)).toEqual(confirmed);
});
