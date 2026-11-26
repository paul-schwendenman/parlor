/**
 * Regressions for the core `game:action` boundary (plan 3.1a): CORE-AUDIT
 * F-15 (spectators / non-members acting), F-04 depth (B-03 poison payload),
 * F-03 / F-17 (unexpected handler errors), F-22 (raw error text).
 *
 * Real socket.io server + clients over the real parlor wiring (all games
 * registered). State is observed the way clients see it: acks, `game:state`
 * views, `lobby:state`, and whether lobby-only requests are accepted.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { ActionResult, JoinRoomResult } from '@parlor/game-types';
import type { ServerGameDefinition } from '@parlor/multiplayer';

type View = any;

interface Client {
	socket: ClientSocket;
	/** The `view` of every `game:state` envelope received. */
	states: View[];
	/** The `gameId` of every `game:state` envelope received, aligned with `states`. */
	gameIds: string[];
	errors: string[];
	lobbyStates: number;
	last(): View;
}

let http: HttpServer;
let io: Server;
let port: number;
let clients: Client[];
let uncaught: unknown[];
let errorSpy: ReturnType<typeof vi.spyOn>;
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

async function waitFor(pred: () => boolean, what: string, ms = 2000): Promise<void> {
	const start = Date.now();
	while (!pred()) {
		if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
		await new Promise((r) => setTimeout(r, 10));
	}
}

const settle = () => new Promise((r) => setTimeout(r, 80));

async function connect(): Promise<Client> {
	const socket = ioc(`http://localhost:${port}`, { transports: ['websocket'], reconnection: false });
	const c: Client = {
		socket,
		states: [],
		gameIds: [],
		errors: [],
		lobbyStates: 0,
		last: () => c.states[c.states.length - 1]
	};
	socket.on('game:state', (s: { gameId: string; view: View }) => {
		c.gameIds.push(s.gameId);
		c.states.push(s.view);
	});
	socket.on('error', (m: string) => c.errors.push(m));
	socket.on('lobby:state', () => c.lobbyStates++);
	await new Promise<void>((r) => socket.on('connect', () => r()));
	clients.push(c);
	return c;
}

function send(c: Client, action: unknown): Promise<ActionResult> {
	return ackOnce<[ActionResult]>((cb) => c.socket.emit('game:action', action as never, cb)).then(
		([r]) => r
	);
}

async function readyAndStart(host: Client, guest: Client): Promise<void> {
	await ackOnce((cb) => host.socket.emit('lobby:ready', true, cb));
	await ackOnce((cb) => guest.socket.emit('lobby:ready', true, cb));
	const hostStates = host.states.length;
	const guestStates = guest.states.length;
	const [ok] = await ackOnce<[boolean, string?]>((cb) => host.socket.emit('lobby:startGame', cb));
	expect(ok).toBe(true);
	await waitFor(
		() => host.states.length > hostStates && guest.states.length > guestStates,
		'initial game:state'
	);
}

/** Two seated players (+ optional spectator) in a started game of `gameId`. */
async function startGame(gameId: string, withSpectator = false) {
	const host = await connect();
	const guest = await connect();
	const [{ roomCode }] = await ackOnce<[{ roomCode: string }]>((cb) =>
		host.socket.emit('lobby:create', 'Host', cb)
	);
	const [selected] = await ackOnce<[boolean]>((cb) => host.socket.emit('lobby:selectGame', gameId, cb));
	expect(selected).toBe(true);
	await ackOnce((cb) => guest.socket.emit('lobby:join', roomCode, 'Guest', cb));

	let spectator: Client | undefined;
	if (withSpectator) {
		const s = await connect();
		const [ok] = await ackOnce<[boolean]>((cb) => s.socket.emit('lobby:spectate', roomCode, cb));
		expect(ok).toBe(true);
		spectator = s;
	}

	await readyAndStart(host, guest);
	const spec = spectator;
	if (spec) await waitFor(() => spec.states.length > 0, 'spectator game:state');
	return { host, guest, spectator, roomCode };
}

/** The room is back in (or still in) the lobby iff the host may change the game. */
async function roomIsWaiting(host: Client, gameId: string): Promise<boolean> {
	const [ok] = await ackOnce<[boolean, string?]>((cb) => host.socket.emit('lobby:selectGame', gameId, cb));
	return ok;
}

function allReceivedText(...cs: Client[]): string {
	return JSON.stringify(cs.map((c) => ({ errors: c.errors, states: c.states })));
}

beforeEach(async () => {
	uncaught = [];
	clients = [];
	errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	process.on('uncaughtException', onUncaught);
	http = createServer();
	io = new Server(http);
	// Fresh module per test: socketServer.ts keeps a module-level RoomManager and
	// caches each game's lobby callbacks bound to the first `io` it saw.
	vi.resetModules();
	const { setupParlorSocketHandlers } = await import('./socketServer.js');
	setupParlorSocketHandlers(io as never);
	// Every real game now validates its actions, so no client payload can make one
	// throw unexpectedly. Inject a fault into a copy of crazy-eights to exercise
	// the INTERNAL → back-to-lobby path through the real wiring.
	const { registerGame } = await import('./gameRegistry.js');
	const { crazyEightsDefinition: c8 } = await import('@parlor/crazy-eights/server-definition');
	type FaultyAction = Parameters<typeof c8.handleGameAction>[3] | { type: 'explode' };
	const faulty: ServerGameDefinition<unknown, FaultyAction> = {
		...c8,
		meta: { ...c8.meta, id: 'faulty-eights' },
		validateAction: (a) => (a.type === 'explode' ? { ok: true, action: { type: 'explode' } } : c8.validateAction(a)),
		handleGameAction(io, socket, rm, action) {
			if (action.type === 'explode') throw new TypeError("Cannot read properties of null (reading 'suit')");
			return c8.handleGameAction(io, socket, rm, action);
		}
	};
	registerGame(faulty);
	await new Promise<void>((r) => http.listen(0, r));
	port = (http.address() as AddressInfo).port;
});

afterEach(async () => {
	process.off('uncaughtException', onUncaught);
	errorSpy.mockRestore();
	for (const c of clients) c.socket.close();
	await io.close();
	expect(uncaught).toEqual([]);
});

// --- Liar's Dice helpers ------------------------------------------------------

function activeAndOther(a: Client, b: Client): [Client, Client] {
	return a.last().isMyTurn ? [a, b] : [b, a];
}

/** Bid then challenge, leaving the game in the round-1 reveal. */
async function toReveal(host: Client, guest: Client) {
	const [bidder, challenger] = activeAndOther(host, guest);
	expect(await send(bidder, { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
	await waitFor(() => challenger.last().isMyTurn, 'turn to pass');
	expect(await send(challenger, { type: 'challenge' })).toEqual({ ok: true });
	await waitFor(() => host.last().phase === 'challenge' && guest.last().phase === 'challenge', 'reveal');
	expect(host.last().round).toBe(1);
}

describe("game:action membership (F-15): Liar's Dice nextRound", () => {
	it('a spectator cannot advance the reveal; a seated player still can', async () => {
		const { host, guest, spectator } = await startGame('liars-dice', true);
		await toReveal(host, guest);
		await settle();
		const before = { host: host.states.length, guest: guest.states.length, spec: spectator!.states.length };

		const result = await send(spectator!, { type: 'nextRound' });
		expect(result).toEqual({ ok: false, code: 'NOT_A_PLAYER', message: expect.any(String) });
		await settle();

		// State unchanged: no broadcast, still the round-1 reveal.
		expect(host.states.length).toBe(before.host);
		expect(guest.states.length).toBe(before.guest);
		expect(spectator!.states.length).toBe(before.spec);
		expect(spectator!.last().phase).toBe('challenge');
		expect(spectator!.last().round).toBe(1);
		expect(spectator!.last().revealedDice).not.toBeNull();

		// A real player's nextRound afterward succeeds.
		expect(await send(guest, { type: 'nextRound' })).toEqual({ ok: true });
		await waitFor(() => host.last().round === 2 && spectator!.last().round === 2, 'round 2');
		expect(host.last().phase).toBe('bidding');
	});

	it('a seated player cannot call nextRound outside the reveal', async () => {
		const { host, guest } = await startGame('liars-dice');
		await settle();
		const before = host.states.length;

		const result = await send(guest, { type: 'nextRound' });
		expect(result).toEqual({
			ok: false,
			code: 'RULE_VIOLATION',
			message: 'Cannot start next round from this phase'
		});
		expect(guest.errors).toContain('Cannot start next round from this phase');
		await settle();
		expect(host.states.length).toBe(before);
		expect(host.last().phase).toBe('bidding');
		expect(host.last().round).toBe(1);

		// The game keeps going: a valid bid succeeds.
		const [bidder] = activeAndOther(host, guest);
		expect(await send(bidder, { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
		await waitFor(() => host.last().currentBid?.quantity === 1, 'bid broadcast');
	});

	it('a socket that never joined is NOT_IN_ROOM', async () => {
		const { host, guest } = await startGame('liars-dice');
		const stranger = await connect();
		expect(await send(stranger, { type: 'nextRound' })).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
		const [bidder] = activeAndOther(host, guest);
		expect(await send(bidder, { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
	});
});

// --- Crazy Eights -------------------------------------------------------------

function c8ActiveAndOther(a: Client, b: Client): [Client, Client] {
	return a.last().isActivePlayer ? [a, b] : [b, a];
}

describe('game:action envelope (F-04 / B-03 poison payload)', () => {
	it('a too-deep action is INVALID_ACTION and the room keeps receiving game:state', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active] = c8ActiveAndOther(host, guest);
		const card = active.last().playableCards[0] ?? active.last().myHand[0];
		const before = { host: host.states.length, guest: guest.states.length };

		const deep = { type: 'play-card', card: { ...card, junk: [[[[1]]]] } };
		expect(await send(active, deep)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
		await settle();
		expect(host.states.length).toBe(before.host);

		// A valid action afterward is applied and broadcast to both players.
		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(
			() => host.states.length > before.host && guest.states.length > before.guest,
			'game:state after valid action'
		);
	});

	it('the raw 20k-deep packet from crash/poison.mjs is dropped and broadcasts keep working', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active] = c8ActiveAndOther(host, guest);
		const card = active.last().playableCards[0] ?? active.last().myHand[0];
		const before = { host: host.states.length, guest: guest.states.length };

		// Written straight to the transport: socket.io-client itself would blow its
		// stack (hasBinary) trying to encode this. Ack id 77 so we see the verdict.
		const D = 20_000;
		const nestedStr = '['.repeat(D) + ']'.repeat(D);
		const raw =
			'277["game:action",{"type":"play-card","card":{"suit":' +
			JSON.stringify(card.suit) +
			',"rank":' +
			JSON.stringify(card.rank) +
			',"junk":' +
			nestedStr +
			'}}]';
		const ackPacket = new Promise<string>((resolve) => {
			active.socket.io.engine.on('packet', (p: { type: string; data?: unknown }) => {
				if (p.type === 'message' && typeof p.data === 'string' && p.data.startsWith('377')) resolve(p.data);
			});
		});
		active.socket.io.engine.write(raw);
		const ack = await ackPacket;
		expect(JSON.parse(ack.slice(3))).toEqual([
			{ ok: false, code: 'INVALID_ACTION', message: expect.any(String) }
		]);
		await settle();
		expect(host.states.length).toBe(before.host);
		expect(host.errors.concat(guest.errors).join()).not.toMatch(/call stack/i);

		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(
			() => host.states.length > before.host && guest.states.length > before.guest,
			'game:state after valid action'
		);
	});
});

describe('lobby transitions over the real parlor wiring (F-11, F-12)', () => {
	it('keeps the original game broadcasting when a restart has too few connected seats', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const disconnected = host.lobbyStates;
		guest.socket.disconnect();
		await waitFor(() => host.lobbyStates > disconnected, 'guest disconnect');

		const returns = vi.fn();
		host.socket.on('lobby:returned', returns);
		const before = host.last();
		const stateCount = host.states.length;
		host.socket.emit('lobby:restartGame');
		await waitFor(() => host.errors.length > 0, 'restart error');
		expect(host.errors.at(-1)).toBe('Cannot restart the game yet');
		expect(returns).not.toHaveBeenCalled();
		expect(host.states).toHaveLength(stateCount);
		expect(host.last()).toEqual(before);
		expect(await roomIsWaiting(host, 'crazy-eights')).toBe(false);

		expect(await send(host, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(() => host.states.length > stateCount, 'view from original game');
		expect(host.last().drawPileCount).toBe(before.drawPileCount - 1);
	});

	it('restarts with connected seats and sends a returning excluded seat only spectator views', async () => {
		const host = await connect();
		const guest = await connect();
		const away = await connect();
		const [{ roomCode }] = await ackOnce<[{ roomCode: string }]>((cb) =>
			host.socket.emit('lobby:create', 'Host', cb)
		);
		await ackOnce((cb) => host.socket.emit('lobby:selectGame', 'crazy-eights', cb));
		await ackOnce((cb) => guest.socket.emit('lobby:join', roomCode, 'Guest', cb));
		const [{ playerId, reconnectToken }] = await ackOnce<[JoinRoomResult]>((cb) =>
			away.socket.emit('lobby:join', roomCode, 'Away', cb)
		);
		await ackOnce((cb) => away.socket.emit('lobby:ready', true, cb));
		await readyAndStart(host, guest);
		expect(host.last().players).toHaveLength(3);

		const disconnected = host.lobbyStates;
		away.socket.disconnect();
		await waitFor(() => host.lobbyStates > disconnected, 'third seat disconnect');
		host.socket.emit('lobby:restartGame');
		await waitFor(() => host.last().players.length === 2, 'restart view');

		const returned = await connect();
		const [ok] = await ackOnce<[boolean]>((cb) =>
			returned.socket.emit('player:reconnect', roomCode, playerId, reconnectToken, cb)
		);
		expect(ok).toBe(true);
		await waitFor(() => returned.states.length > 0, 'returned seat view');
		expect(returned.last()).toMatchObject({ myHand: [], myIndex: -1 });
		expect(await send(returned, { type: 'draw-card' })).toMatchObject({ ok: false, code: 'NOT_A_PLAYER' });

		const stateCount = returned.states.length;
		const [active] = c8ActiveAndOther(host, guest);
		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(() => returned.states.length > stateCount, 'subsequent spectator view');
		expect(returned.states.every((view) => view.myHand.length === 0)).toBe(true);
	});

	it('rejects a game selection below the current occupancy and accepts a valid selection', async () => {
		const host = await connect();
		const [{ roomCode }] = await ackOnce<[{ roomCode: string }]>((cb) =>
			host.socket.emit('lobby:create', 'Host', cb)
		);
		for (const name of ['A', 'B', 'C', 'D']) {
			const guest = await connect();
			const [result] = await ackOnce<[JoinRoomResult]>((cb) =>
				guest.socket.emit('lobby:join', roomCode, name, cb)
			);
			expect(result.success).toBe(true);
		}

		const selected = vi.fn();
		host.socket.on('lobby:gameSelected', selected);
		const rejected = await ackOnce<[boolean, string]>((cb) =>
			host.socket.emit('lobby:selectGame', 'kings-corner', cb)
		);
		expect(rejected).toEqual([false, 'This game supports up to 4 players']);
		expect(selected).not.toHaveBeenCalled();

		const sixth = await connect();
		const [joined] = await ackOnce<[JoinRoomResult]>((cb) => sixth.socket.emit('lobby:join', roomCode, 'E', cb));
		expect(joined.success).toBe(true);
		expect(await roomIsWaiting(host, 'liars-dice')).toBe(true);
		expect(selected).toHaveBeenCalledWith('liars-dice');
	});
});

describe('game:action errors (F-03 / F-17 / F-22)', () => {
	it('acting out of turn → NOT_YOUR_TURN with the engine message, state unchanged', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active, other] = c8ActiveAndOther(host, guest);
		const before = host.states.length;

		expect(await send(other, { type: 'draw-card' })).toEqual({
			ok: false,
			code: 'NOT_YOUR_TURN',
			message: 'Not your turn'
		});
		expect(other.errors).toEqual(['Not your turn']);
		await settle();
		expect(host.states.length).toBe(before);
		expect(other.last().isActivePlayer).toBe(false);

		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
	});

	it('an unknown action type is INVALID_ACTION and the game keeps going', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active] = c8ActiveAndOther(host, guest);
		expect(await send(active, { type: 'win-instantly' })).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
	});

	it('a malformed card (the old TypeError probe) is now INVALID_ACTION, game keeps running', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active] = c8ActiveAndOther(host, guest);
		const before = host.states.length;
		for (const card of [null, undefined, 'x', { suit: 'hearts' }, { suit: 'hearts', rank: 'K', junk: 1 }]) {
			expect(await send(active, { type: 'play-card', card })).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
		}
		await settle();
		expect(host.states.length).toBe(before);
		expect(allReceivedText(host, guest)).not.toMatch(/Cannot read|TypeError/);
		expect(await roomIsWaiting(host, 'crazy-eights')).toBe(false);
		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
	});

	it('a TypeError inside a game → INTERNAL generic message, room back in the lobby', async () => {
		const { host, guest } = await startGame('faulty-eights');
		const [active, other] = c8ActiveAndOther(host, guest);
		const lobbyBefore = { host: host.lobbyStates, guest: guest.lobbyStates };

		const result = await send(active, { type: 'explode' });
		expect(result).toEqual({ ok: false, code: 'INTERNAL', message: 'Something went wrong' });
		expect(active.errors).toEqual(['Something went wrong']);
		expect(other.errors).toEqual([]);
		expect(allReceivedText(host, guest)).not.toMatch(/Cannot read|TypeError|null \(reading/);
		expect(errorSpy).toHaveBeenCalled();

		await waitFor(
			() => host.lobbyStates > lobbyBefore.host && guest.lobbyStates > lobbyBefore.guest,
			'lobby:state after room failure'
		);
		expect(await roomIsWaiting(host, 'faulty-eights')).toBe(true);
		// No more game actions on the dead game.
		expect(await send(other, { type: 'draw-card' })).toMatchObject({ ok: false, code: 'NO_ACTIVE_GAME' });

		// A valid request afterward succeeds: the room can start a fresh game.
		await readyAndStart(host, guest);
		const [active2] = c8ActiveAndOther(host, guest);
		expect(await send(active2, { type: 'draw-card' })).toEqual({ ok: true });
	});

	it('works for clients that send no ack (existing GameViews)', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const [active, other] = c8ActiveAndOther(host, guest);
		const before = other.states.length;
		active.socket.emit('game:action', { type: 'draw-card' });
		await waitFor(() => other.states.length > before, 'game:state');
		// And a rejected no-ack action still reports through the error event.
		const [, waiting] = c8ActiveAndOther(host, guest);
		waiting.socket.emit('game:action', { type: 'pass' });
		await waitFor(() => waiting.errors.length > 0, 'error event');
		expect(waiting.errors[0]).toBe('Not your turn');
	});
});

describe('per-game validateAction over the real wiring (F-05)', () => {
	it("Kings Corner: a bogus pile target is INVALID_ACTION and the game keeps running", async () => {
		const { host, guest } = await startGame('kings-corner');
		const [active] = c8ActiveAndOther(host, guest);
		const card = active.last().myHand[0];
		const before = host.states.length;

		for (const action of [
			{ type: 'play-card', card, target: 'nowhere' },
			{ type: 'play-card', card, target: 7 },
			{ type: 'move-pile', from: 'north', to: '__proto__x' },
			{ type: 'play-card', card },
		]) {
			expect(await send(active, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
		}
		await settle();
		expect(host.states.length).toBe(before);
		expect(await roomIsWaiting(host, 'kings-corner')).toBe(false);
		expect(active.errors).toEqual([]);

		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(() => host.states.length > before, 'game:state after draw');
	});

	it('Quixx: a bad row or a string cellIndex is INVALID_ACTION and the game keeps running', async () => {
		const { host, guest } = await startGame('quixx');
		// Quixx auto-rolls shortly after start.
		await waitFor(() => host.last().phase === 'phase1' && guest.last().phase === 'phase1', 'phase1');
		const before = host.states.length;

		for (const action of [
			{ type: 'phase1-mark', row: 'purple', cellIndex: 0 },
			{ type: 'phase1-mark', row: 'red', cellIndex: '10' },
			{ type: 'phase1-mark', row: 'red', cellIndex: 11 },
			{ type: 'phase1-mark', row: 'red', cellIndex: 1.5 },
			{ type: 'phase1-pass', extra: true },
		]) {
			expect(await send(host, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
		}
		await settle();
		expect(host.states.length).toBe(before);
		expect(await roomIsWaiting(host, 'quixx')).toBe(false);

		expect(await send(host, { type: 'phase1-pass' })).toEqual({ ok: true });
		await waitFor(() => guest.states.length > before, 'game:state after pass');
	});
});

describe('lobby:startGame preconditions (F-11)', () => {
	it('rejects a start without a game selection before changing the room', async () => {
		const host = await connect();
		const guest = await connect();
		const [{ roomCode }] = await ackOnce<[{ roomCode: string }]>((cb) =>
			host.socket.emit('lobby:create', 'Host', cb)
		);
		await ackOnce((cb) => guest.socket.emit('lobby:join', roomCode, 'Guest', cb));
		await ackOnce((cb) => host.socket.emit('lobby:ready', true, cb));
		await ackOnce((cb) => guest.socket.emit('lobby:ready', true, cb));
		let starting = 0;
		guest.socket.on('lobby:gameStarting', () => starting++);
		const returned = vi.fn();
		guest.socket.on('lobby:returned', returned);

		const [ok, message] = await ackOnce<[boolean, string?]>((cb) => host.socket.emit('lobby:startGame', cb));
		expect(ok).toBe(false);
		expect(message).toBe('Cannot start the game yet');
		await settle();
		expect(starting).toBe(0);
		expect(returned).not.toHaveBeenCalled();

		// Still in the lobby: a game can be selected and started.
		expect(await roomIsWaiting(host, 'liars-dice')).toBe(true);
		await readyAndStart(host, guest);
		expect(host.last().phase).toBe('bidding');
	});
});

describe('game:state envelopes over the real parlor wiring (plan 3.1b)', () => {
	it('crazy-eights: every recipient gets a crazy-eights envelope, and the spectator never gets a hand', async () => {
		const { host, guest, spectator } = await startGame('crazy-eights', true);
		const spec = spectator!;
		const [active] = c8ActiveAndOther(host, guest);
		const before = spec.states.length;
		expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
		await waitFor(() => spec.states.length > before, 'spectator view after draw');

		for (const c of [host, guest, spec]) {
			expect(c.gameIds.length).toBeGreaterThan(0);
			expect(new Set(c.gameIds)).toEqual(new Set(['crazy-eights']));
		}
		expect(host.last().myHand.length).toBeGreaterThan(0);
		expect(guest.last().myHand.length).toBeGreaterThan(0);
		expect(host.last().myIndex).not.toBe(guest.last().myIndex);
		for (const view of spec.states) {
			expect(view).toMatchObject({ myHand: [], myIndex: -1, playableCards: [], drewCard: null });
		}
	});

	it('liars-dice (a bot game) reaches players and spectators in its own envelope', async () => {
		const { host, guest, spectator } = await startGame('liars-dice', true);
		for (const c of [host, guest, spectator!]) {
			expect(new Set(c.gameIds)).toEqual(new Set(['liars-dice']));
			expect(c.last().phase).toBe('bidding');
		}
	});

	it('after returning to the lobby and switching game, only the new game is sent', async () => {
		const { host, guest } = await startGame('crazy-eights');
		const returned = new Promise<void>((resolve) => host.socket.once('lobby:returned', () => resolve()));
		host.socket.emit('lobby:resetGame');
		await returned;
		expect(await roomIsWaiting(host, 'liars-dice')).toBe(true);

		const seen = { host: host.gameIds.length, guest: guest.gameIds.length };
		await readyAndStart(host, guest);
		await settle();
		expect(new Set(host.gameIds.slice(seen.host))).toEqual(new Set(['liars-dice']));
		expect(new Set(guest.gameIds.slice(seen.guest))).toEqual(new Set(['liars-dice']));
		expect(host.last().phase).toBe('bidding');
	});
});
