import { createServer } from 'node:http';
import { inspect } from 'node:util';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Server } from 'socket.io';
import { io as connectSocket, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, CreateRoomResult, ServerToClientEvents } from '@parlor/game-types';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { setupParlorSocketHandlers } from './socketServer.js';

type Event = keyof ClientToServerEvents;
// The emitter must be able to send values outside the typed client contract.
type WireClient = Socket<ServerToClientEvents, Record<Event, (...args: unknown[]) => void>>;

let server: AppServer;
let rooms: RoomManager;
let url: string;
let clients: WireClient[];

beforeEach(async () => {
	const http = createServer();
	server = new Server(http);
	rooms = new RoomManager(0);
	clients = [];
	setupParlorSocketHandlers(server, rooms);
	await new Promise<void>((resolve, reject) => {
		http.once('error', reject);
		http.listen(0, '127.0.0.1', resolve);
	});
	const address = http.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
	url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
	for (const client of clients) client.close();
	await server.close();
});

async function connect(): Promise<WireClient> {
	const client: WireClient = connectSocket(url, {
		transports: ['websocket'],
		reconnection: false,
		timeout: 1000,
		autoConnect: false,
	});
	clients.push(client);
	await new Promise<void>((resolve, reject) => {
		client.once('connect', resolve);
		client.once('connect_error', reject);
		client.connect();
	});
	return client;
}

function request(client: WireClient, event: Event, ...args: unknown[]): Promise<unknown[]> {
	return new Promise((resolve, reject) => {
		client.timeout(1000).emit(event, ...args, (error: Error | null, ...reply: unknown[]) => {
			if (error) reject(new Error(`No acknowledgement for ${event}`, { cause: error }));
			else resolve(reply);
		});
	});
}

async function fixture(playing: boolean) {
	const host = await connect();
	const guest = await connect();
	const [seat] = await request(host, 'lobby:create', 'Host') as [CreateRoomResult];
	const { roomCode } = seat;
	expect(await request(host, 'lobby:selectGame', playing ? 'crazy-eights' : 'liars-dice')).toEqual([true]);
	expect(await request(guest, 'lobby:join', roomCode, 'Guest')).toEqual([
		expect.objectContaining({ success: true }),
	]);
	expect(await request(host, 'lobby:ready', true)).toEqual([true]);
	expect(await request(guest, 'lobby:ready', true)).toEqual([true]);

	let active = host;
	if (playing) {
		host.on('game:state', (state) => {
			if (state.gameId === 'crazy-eights') active = state.view.isActivePlayer ? host : guest;
		});
		expect(await request(host, 'lobby:startGame')).toEqual([true]);
	}

	return { host, active, seat };
}

function snapshot(roomCode: string) {
	const room = rooms.getRoom(roomCode);
	if (!room) throw new Error('Expected the original room to exist');
	const { gameData, ...lobby } = room;
	return {
		lobby: structuredClone(lobby),
		// Include the engine's own fields (including hands, deck order and sets).
		engine: inspect(gameData, { depth: null, maxArrayLength: null, breakLength: Infinity }),
		memberships: structuredClone(server.sockets.adapter.rooms),
		socketData: structuredClone([...server.sockets.sockets.values()].map((socket) => socket.data)),
	};
}

const invalidAction = { ok: false, code: 'INVALID_ACTION', message: expect.any(String) };
const unexpectedArguments = 'Unexpected request arguments';

const cases = {
	'lobby:create': { reply: [null, 'Invalid player name'] },
	'lobby:join': { reply: [{ success: false, error: 'Invalid room code or player name' }] },
	'lobby:spectate': { reply: [false, 'Invalid room code'] },
	'lobby:ready': { reply: [false, 'Invalid ready value'] },
	'lobby:selectGame': { reply: [false, 'Invalid game'] },
	'lobby:vote': { reply: [false, 'This vote has closed. Use the current lobby to vote again.'] },
	'lobby:confirmGame': { reply: [false, 'This vote has closed. Use the current lobby to vote again.'] },
	'lobby:keepGame': { reply: [false, 'This vote has closed. Use the current lobby to vote again.'] },
	'lobby:roomExists': { reply: [false] },
	'lobby:removeBot': { reply: [false, 'Invalid bot id'] },
	'lobby:transferHost': { reply: [false, 'Invalid player id'] },
	'player:reconnect': { reply: [false] },
	'lobby:addBot': {},
	'lobby:startGame': { error: unexpectedArguments },
	'lobby:resetGame': { error: unexpectedArguments, playing: true },
	'lobby:restartGame': { error: unexpectedArguments, playing: true },
	'room:leave': { error: unexpectedArguments, playing: true },
	'game:action': { reply: [invalidAction], playing: true },
} satisfies Record<Event, {
	reply?: unknown[];
	error?: string;
	playing?: boolean;
}>;

// Generate bounded JSON values with a fixed seed so failures replay exactly.
let seed = 0x4a11;
function sample(): number {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	return (seed % 1000) + 1;
}

const fuzzCases = (Object.keys(cases) as Event[]).flatMap((event) => {
	const values: unknown[] = [sample(), [sample()], { value: sample() }];
	if (event === 'game:action') {
		values.push({ type: 'play-card', card: { suit: sample(), rank: 'K' } });
	}
	const positions = event === 'lobby:join' ? [0, 1] : event === 'player:reconnect' ? [0, 1, 2] : [0];
	return positions.flatMap((position) => values.map((value) => ({ event, position, value })));
});

it.each(fuzzCases)('$event rejects $value at argument $position and keeps serving', async ({ event, position, value }) => {
	const testCase = cases[event];
	const playing = 'playing' in testCase && testCase.playing;
	const { host, active, seat } = await fixture(playing);
	const sender = event === 'game:action' ? active : host;
	const before = snapshot(seat.roomCode);
	const instance = rooms.getGameInstance(seat.roomCode);
	const engine = rooms.getRoom(seat.roomCode)?.gameData;
	const errors: string[] = [];
	sender.on('error', (message) => errors.push(message));

	const wireArgs: unknown[] = [];
	if (event === 'lobby:vote' || event === 'lobby:confirmGame') wireArgs.push(null, 'quixx');
	if (event === 'lobby:join') wireArgs.push(seat.roomCode, 'Visitor');
	if (event === 'player:reconnect') wireArgs.push(seat.roomCode, seat.playerId, seat.reconnectToken);
	wireArgs[position] = value;

	if (event === 'lobby:join' && position === 1) {
		expect(await request(sender, event, ...wireArgs)).toEqual([
			{ success: false, error: 'Invalid player name' },
		]);
	} else if ('reply' in testCase) {
		expect(await request(sender, event, ...wireArgs)).toEqual(testCase.reply);
	} else {
		sender.emit(event, ...wireArgs);
		// An acknowledged, read-only rejection on the same socket drains the
		// preceding packet without waiting for an arbitrary delay.
		expect(await request(sender, 'game:action', value)).toEqual([invalidAction]);
	}

	expect(errors).toEqual('error' in testCase ? [testCase.error] : []);
	expect(sender.connected).toBe(true);
	expect(snapshot(seat.roomCode)).toEqual(before);
	expect(rooms.getGameInstance(seat.roomCode)).toBe(instance);
	expect(rooms.getRoom(seat.roomCode)?.gameData).toBe(engine);

	if (playing) {
		expect(await request(active, 'game:action', { type: 'draw-card' })).toEqual([{ ok: true }]);
	} else {
		expect(await request(host, 'lobby:ready', false)).toEqual([true]);
	}
});
