import { createServer } from 'node:http';
import { inspect } from 'node:util';
import { afterEach, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import type { GameClientEvents, ServerToClientEvents } from '@parlor/game-types';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { kingsCornerDefinition } from '@parlor/kings-corner/server-definition';
import { AIPlayer } from '../../../../../games/kings-corner/src/lib/server/ai/AIPlayer.js';
import { setupParlorSocketHandlers } from './socketServer.js';

const GRACE_MS = 100;
type Client = Socket<ServerToClientEvents, GameClientEvents>;
const clients: Client[] = [];
let server: AppServer | undefined;

afterEach(async () => {
	await server?.close();
	for (const socket of clients.splice(0)) socket.close();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

async function fixture() {
	const http = createServer();
	const ioServer: AppServer = new Server(http);
	server = ioServer;
	const rooms = new RoomManager(GRACE_MS);
	setupParlorSocketHandlers(ioServer, rooms);
	await new Promise<void>((resolve, reject) => {
		http.once('error', reject);
		http.listen(0, '127.0.0.1', resolve);
	});
	const address = http.address();
	if (!address || typeof address === 'string') throw new Error('Expected TCP address');

	const url = `http://127.0.0.1:${address.port}`;
	async function connect() {
		const client: Client = io(url, {
			autoConnect: false, reconnection: false, transports: ['websocket'],
		});
		clients.push(client);
		await new Promise<void>((resolve, reject) => {
			client.once('connect', resolve);
			client.once('connect_error', reject);
			client.connect();
		});
		return client;
	}

	const host = await connect();
	const guest = await connect();
	const spectator = await connect();
	const seat = await host.timeout(1000).emitWithAck('lobby:create', 'Host');
	if (!seat) throw new Error('Could not create room');
	const { roomCode, playerId: hostId } = seat;
	expect(await host.timeout(1000).emitWithAck('lobby:selectGame', 'kings-corner')).toBe(true);
	const joined = await guest.timeout(1000).emitWithAck('lobby:join', roomCode, 'Guest');
	const { playerId: guestId, reconnectToken } = joined;
	if (!joined.success || !guestId || !reconnectToken) throw new Error('Could not seat guest');
	expect(await spectator.timeout(1000).emitWithAck('lobby:spectate', roomCode)).toBe(true);
	expect(await host.timeout(1000).emitWithAck('lobby:addBot')).toBe(true);
	const bot = rooms.getPlayersInRoom(roomCode).find((player) => player.isBot);
	if (!bot) throw new Error('Could not seat bot');

	async function start(connectedGuest: Client | undefined) {
		expect(await host.timeout(1000).emitWithAck('lobby:ready', true)).toBe(true);
		if (connectedGuest) expect(await connectedGuest.timeout(1000).emitWithAck('lobby:ready', true)).toBe(true);
		expect(await host.timeout(1000).emitWithAck('lobby:startGame')).toBe(true);
	}

	function disconnect(client: Client) {
		const socket = ioServer.sockets.sockets.get(client.id ?? '');
		if (!socket) throw new Error('Expected a connected server socket');
		socket.disconnect(true);
	}

	async function command(client: Client, event: 'lobby:resetGame' | 'lobby:restartGame' | 'room:leave') {
		client.emit(event);
		// The read-only rejection acknowledges after the prior command on this connection.
		expect(await client.timeout(1000).emitWithAck('game:action', { type: 'nextRound' }))
			.toMatchObject({ ok: false });
	}

	await start(guest);
	return { host, hostId, guest, guestId, spectator, botId: bot.id, reconnectToken, roomCode, rooms, connect, start, disconnect, command, ioServer };
}

async function passKingsTurn(game: Awaited<ReturnType<typeof fixture>>, socket: Client, playerId: string) {
	const engine = kingsCornerDefinition.typed.getState(game.rooms, game.roomCode);
	if (!engine) throw new Error('Expected Kings Corner engine');
	expect(await socket.timeout(1000).emitWithAck('game:action', { type: 'draw-card' })).toEqual({ ok: true });
	while (engine.getPlayerView(playerId).mustPlayKing) {
		const king = engine.getPlayerView(playerId).playableCards.find(({ card }) => card.rank === 'K');
		if (!king) throw new Error('Expected mandatory king');
		expect(await socket.timeout(1000).emitWithAck('game:action', {
			type: 'play-card', card: king.card, target: king.validTargets[0],
		})).toEqual({ ok: true });
	}
	expect(await socket.timeout(1000).emitWithAck('game:action', { type: 'end-turn' })).toEqual({ ok: true });
}

const transitions = ['reset', 'restart', 'switch', 'leave', 'expire', 'continue'] as const;
const seeds = [1, 7, 42, 2026, 0x5eed, 0xcafe];
const races = transitions.flatMap((transition) =>
	seeds.map((seed, index) => ({ transition, seed, reconnectFirst: index % 2 === 0 })),
);

it.each(races)('$transition with seed $seed and reconnectFirst=$reconnectFirst', async ({ transition, seed, reconnectFirst }) => {
	// Seed both the deck and the jitter so a failed timing/order can be replayed.
	let random = seed;
	const sample = (max: number) => {
		random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
		return Math.floor((random / 0x100000000) * max);
	};
	deckRandom = sample;
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	let release: () => void = () => { throw new Error('Bot did not start'); };
	const resumed = vi.fn();
	const drawApplied = vi.fn();
	const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn')
		.mockImplementation(() => new Promise<void>(() => undefined))
		.mockImplementationOnce(async ({ onDrawCard }) => {
			await new Promise<void>((resolve) => { release = resolve; });
			resumed();
			drawApplied(onDrawCard());
			if (transition !== 'continue' && seed % 2 === 0) throw new Error('Late bot rejection');
		});

	const game = await fixture();
	const { host, hostId, guest, guestId, roomCode, rooms } = game;
	const room = () => rooms.getRoom(roomCode);
	const oldInstance = rooms.getGameInstance(roomCode);
	if (!oldInstance) throw new Error('Expected started game instance');
	const oldEngine = kingsCornerDefinition.typed.getState(rooms, roomCode);
	if (!oldEngine) throw new Error('Expected Kings Corner engine');
	await passKingsTurn(game, host, hostId);
	await passKingsTurn(game, guest, guestId);
	await vi.advanceTimersByTimeAsync(0);
	expect(takeTurn).toHaveBeenCalledTimes(1);
	expect(oldEngine.getActivePlayerId()).toBe(game.botId);
	expect(resumed).not.toHaveBeenCalled();

	const replacement = await game.connect();
	await vi.advanceTimersByTimeAsync(sample(10));
	game.disconnect(guest);
	expect(room()?.players.get(guestId)?.connected).toBe(false);

	const reconnectAt = GRACE_MS + (reconnectFirst ? -1 - sample(10) : sample(10));
	const transitionAt = seed % 2 ? sample(reconnectAt) : reconnectAt + 1 + sample(10);
	let elapsed = 0;
	async function advanceTo(at: number) {
		await vi.advanceTimersByTimeAsync(at - elapsed);
		elapsed = at;
	}
	async function applyGameTransition() {
		if (transition === 'restart') {
			await game.command(host, 'lobby:restartGame');
		} else if (transition === 'reset' || transition === 'switch') {
			await game.command(host, 'lobby:resetGame');
			expect(room()?.status).toBe('waiting');
			if (transition === 'switch') {
				expect(await host.timeout(1000).emitWithAck('lobby:selectGame', 'quixx')).toBe(true);
			}
		}
	}
	if (transitionAt < reconnectAt) {
		await advanceTo(transitionAt);
		await applyGameTransition();
	}
	await advanceTo(reconnectAt);
	const rejoined = await replacement.timeout(1000).emitWithAck('player:reconnect', roomCode, guestId, game.reconnectToken);
	expect(rejoined).toBe(reconnectFirst);
	if (transitionAt >= reconnectAt) {
		await advanceTo(transitionAt);
		await applyGameTransition();
	}
	await advanceTo(Math.max(GRACE_MS, transitionAt, reconnectAt) + 1);
	expect(room()?.players.has(guestId)).toBe(reconnectFirst);
	if (reconnectFirst) expect(room()?.players.get(guestId)?.connected).toBe(true);

	switch (transition) {
		case 'reset':
			expect(room()?.status).toBe('waiting');
			break;
		case 'restart':
			expect(room()?.status).toBe('playing');
			expect(rooms.getGameInstance(roomCode)).not.toBe(oldInstance);
			expect(room()?.gameParticipants.has(guestId)).toBe(reconnectFirst && transitionAt >= reconnectAt);
			break;
		case 'switch':
			await game.start(reconnectFirst ? replacement : undefined);
			expect(room()?.gameId).toBe('quixx');
			break;
		case 'leave':
			if (reconnectFirst) await game.command(replacement, 'room:leave');
			await game.command(host, 'room:leave');
			expect(room()).toBeUndefined();
			break;
		case 'expire':
			if (reconnectFirst) game.disconnect(replacement);
			game.disconnect(host);
			await vi.advanceTimersByTimeAsync(GRACE_MS);
			expect(room()).toBeUndefined();
			break;
		case 'continue':
			break;
	}

	const live = transition === 'continue';
	expect(oldInstance.signal.aborted).toBe(!live);
	expect(resumed).not.toHaveBeenCalled();
	const oldView = oldEngine.getSpectatorView();
	const currentInstance = rooms.getGameInstance(roomCode);
	const currentData = room()?.gameData;
	const currentStatus = room()?.status;
	const currentSnapshot = inspect(currentData, { depth: null, maxArrayLength: null });
	const broadcast = vi.spyOn(game.ioServer.sockets.adapter, 'broadcast');
	release();
	await vi.advanceTimersByTimeAsync(0);
	expect(resumed).toHaveBeenCalledTimes(1);
	expect(drawApplied).toHaveBeenCalledExactlyOnceWith(live);
	expect(rooms.getGameInstance(roomCode)).toBe(currentInstance);
	expect(room()?.status).toBe(currentStatus);
	expect(room()?.gameData).toBe(currentData);
	if (live) {
		expect(oldEngine.getSpectatorView().drawPileCount).toBe(oldView.drawPileCount - 1);
		expect(broadcast.mock.calls.map(([, options]) => [...options.rooms].at(0)).sort()).toEqual(
			[hostId, ...(reconnectFirst ? [guestId] : []), game.spectator.id].sort(),
		);
	} else {
		expect(oldEngine.getSpectatorView()).toEqual(oldView);
		expect(inspect(room()?.gameData, { depth: null, maxArrayLength: null })).toBe(currentSnapshot);
		expect(broadcast).not.toHaveBeenCalled();
	}

	if (transition === 'reset') await game.start(reconnectFirst ? replacement : undefined);
	if (transition === 'reset' || transition === 'restart') {
		expect(await host.timeout(1000).emitWithAck('game:action', { type: 'draw-card' })).toEqual({ ok: true });
	}
	if (transition === 'switch') {
		expect(await host.timeout(1000).emitWithAck('game:action', { type: 'roll-dice' })).toEqual({ ok: true });
	}
});

let deckRandom = (max: number) => Math.floor(max / 2);
vi.mock('@parlor/multiplayer/random', async (importOriginal) => ({
	...await importOriginal<typeof import('@parlor/multiplayer/random')>(),
	secureRandomInt: (max: number) => deckRandom(max),
}));
