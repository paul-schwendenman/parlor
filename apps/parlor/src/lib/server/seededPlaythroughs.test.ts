import { createServer } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import type {
	ClientToServerEvents, GameAction, GameClientEvents, GameId, GameStateEnvelope,
	InterServerEvents, ServerToClientEvents, SocketData,
} from '@parlor/game-types';
import { defineGame, RoomManager } from '@parlor/multiplayer';
import { quixxGame } from '@parlor/quixx/server-definition';
import { QuixxEngine } from '../../../../../games/quixx/src/lib/server/game/QuixxEngine.js';
import { registerGame } from './gameRegistry.js';
import { setupParlorSocketHandlers } from './socketServer.js';

function seededInt(seed: number) {
	return (max: number) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return Math.floor((seed / 0x100000000) * max);
	};
}

let engineInt = seededInt(0);
vi.mock('@parlor/multiplayer/random', async (importOriginal) => ({
	...await importOriginal<typeof import('@parlor/multiplayer/random')>(),
	secureRandomInt: (max: number) => engineInt(max),
}));

type Outbound = ServerToClientEvents & { 'test:drain': (ack: (received: boolean) => void) => void };
type Client = Socket<Outbound, GameClientEvents>;
type Recipient = { socket: Client; id: string | null; received: GameStateEnvelope[] };
type WireServer = Server<ClientToServerEvents, Outbound, InterServerEvents, SocketData>;

let server: WireServer | undefined;
const clients: Client[] = [];

afterEach(async () => {
	for (const client of clients.splice(0)) client.close();
	await server?.close();
	vi.restoreAllMocks();
});

async function table(gameId: GameId) {
	const http = createServer();
	const wire: WireServer = new Server(http);
	server = wire;
	const rooms = new RoomManager(0);
	setupParlorSocketHandlers(wire, rooms);
	if (gameId === 'quixx') {
		// Player-roll mode gives the seeded driver control over roll timing.
		registerGame(defineGame({
			...quixxGame,
			createState: (code, players) => new QuixxEngine(players, code, {
				diceRolling: 'player', phase1Timer: null, turnTimer: null,
			}, engineInt),
		}));
	}

	await new Promise<void>((resolve, reject) => {
		http.once('error', reject);
		http.listen(0, '127.0.0.1', resolve);
	});
	const address = http.address();
	if (!address || typeof address === 'string') throw new Error('Expected TCP address');

	const recipients: Recipient[] = [];
	for (let index = 0; index < (gameId === 'president' ? 9 : gameId === 'golf' ? 7 : gameId === 'hearts' ? 6 : gameId === 'gin-rummy' ? 4 : 5); index++) {
		const socket: Client = io(`http://127.0.0.1:${address.port}`, {
			transports: ['websocket'], autoConnect: false, reconnection: false, timeout: 1000,
		});
		clients.push(socket);
		const recipient: Recipient = { socket, id: null, received: [] };
		recipients.push(recipient);
		socket.on('game:state', (state) => recipient.received.push(state));
		socket.on('test:drain', (ack) => ack(true));
		await new Promise<void>((resolve, reject) => {
			socket.once('connect', resolve);
			socket.once('connect_error', reject);
			socket.connect();
		});
	}

	const [host, ...guests] = recipients.slice(0, -2);
	const [spectator, outsider] = recipients.slice(-2);
	const seat = await host.socket.timeout(1000).emitWithAck('lobby:create', 'Host');
	if (!seat) throw new Error('Could not create playthrough room');
	host.id = seat.playerId;
	expect(await host.socket.timeout(1000).emitWithAck('lobby:selectGame', gameId)).toBe(true);
	for (const [index, guest] of guests.entries()) {
		const joined = await guest.socket.timeout(1000).emitWithAck('lobby:join', seat.roomCode, `Guest ${index}`);
		if (!joined.success || !joined.playerId) throw new Error('Could not seat guest');
		guest.id = joined.playerId;
	}
	expect(await spectator.socket.timeout(1000).emitWithAck('lobby:spectate', seat.roomCode)).toBe(true);
	const players = [host, ...guests];
	for (const { socket } of players) {
		expect(await socket.timeout(1000).emitWithAck('lobby:ready', true)).toBe(true);
	}
	expect(await host.socket.timeout(1000).emitWithAck('lobby:startGame')).toBe(true);

	return {
		players,
		room: () => rooms.getRoom(seat.roomCode)!,
		reset: () => rooms.resetGame(seat.roomCode),
		async collect() {
			// Socket.IO orders packets per connection. Wait for every recipient
			// to acknowledge a marker after the game's own broadcasts.
			expect(await wire.timeout(1000).emitWithAck('test:drain')).toEqual(recipients.map(() => true));
			expect(outsider.received).toEqual([]);
			return [...players, spectator].map(({ id, received }) => ({ id, frames: received.splice(0) }));
		},
	};
}

type Move = { player: number; action: GameAction };
type Select = (max: number) => number;

function choose<T>(items: readonly T[], select: Select): T {
	if (!items.length) throw new Error('Expected at least one legal choice');
	return items[select(items.length)];
}

const games = ['crazy-eights', 'kings-corner', 'liars-dice', 'quixx', 'booty-dice'] as const;
type SeededFrame = GameStateEnvelope<(typeof games)[number]>;

function nextMove(views: SeededFrame[], select: Select, engine: unknown): Move | null {
	const first = views[0];
	switch (first.gameId) {
		case 'crazy-eights': {
			const { activePlayerIndex: player, gameOver } = first.view;
			if (gameOver) return null;
			const active = views.find((entry) => entry.gameId === first.gameId && entry.view.isActivePlayer);
			if (active?.gameId !== first.gameId) throw new Error('Missing active Crazy Eights view');
			const view = active.view;
			if (view.phase === 'choosing-suit') {
				return { player, action: { type: 'choose-suit', suit: choose(['hearts', 'diamonds', 'clubs', 'spades'] as const, select) } };
			}
			const cards: GameAction<'crazy-eights'>[] = view.playableCards.map((card) => ({ type: 'play-card', card }));
			if (view.canDraw) cards.push({ type: 'draw-card' });
			if (view.canPass) cards.push({ type: 'pass' });
			return { player, action: choose(cards, select) };
		}
		case 'kings-corner': {
			const { activePlayerIndex: player, gameOver } = first.view;
			if (gameOver) return null;
			const active = views.find((entry) => entry.gameId === first.gameId && entry.view.isActivePlayer);
			if (active?.gameId !== first.gameId) throw new Error('Missing active Kings Corner view');
			const view = active.view;
			if (view.phase === 'drawing') return { player, action: { type: 'draw-card' } };
			const cards = view.mustPlayKing ? view.playableCards.filter(({ card }) => card.rank === 'K') : view.playableCards;
			const plays = cards.flatMap(({ card, validTargets }) =>
				validTargets.map((target) => ({ type: 'play-card', card, target } as const)),
			);
			if (plays.length) return { player, action: choose(plays, select) };
			const moves = view.movablePiles.flatMap(({ from, validTargets }) =>
				validTargets.map((to) => ({ type: 'move-pile', from, to } as const)),
			);
			return { player, action: moves.length && select(3) ? choose(moves, select) : { type: 'end-turn' } };
		}
		case 'liars-dice': {
			const { activePlayerIndex: player, gameOver, phase } = first.view;
			if (gameOver) return null;
			if (phase !== 'bidding') return { player, action: { type: 'nextRound' } };
			const active = views.find((entry) => entry.gameId === first.gameId && entry.view.isMyTurn);
			if (active?.gameId !== first.gameId) throw new Error('Missing active Liar’s Dice view');
			const { canChallenge, canSpotOn, currentBid, totalDiceInPlay } = active.view;
			if (canChallenge && select(3) !== 0) {
				return { player, action: { type: canSpotOn && select(4) === 0 ? 'spot-on' : 'challenge' } };
			}
			const rules = engine as LiarEngine;
			const playerId = active.view.players[player].id;
			const bids = Array.from({ length: totalDiceInPlay }, (_, index) => index + 1)
				.flatMap((quantity) => [1, 2, 3, 4, 5, 6].map((faceValue) => ({ playerId, quantity, faceValue })))
				.filter((bid) => rules.isValidBid(bid, currentBid));
			if (!bids.length) return { player, action: { type: 'challenge' } };
			const { quantity, faceValue } = choose(bids, select);
			return { player, action: { type: 'bid', quantity, faceValue } };
		}
		case 'quixx': {
			const { activePlayerIndex, gameOver, phase, players } = first.view;
			if (gameOver) return null;
			const player = phase === 'phase1'
				? choose(players.flatMap((seat, index) => seat.phase1Submitted ? [] : [index]), select)
				: activePlayerIndex;
			if (phase === 'rolling') return { player, action: { type: 'roll-dice' } };
			const entry = views.find((view) => view.view.myIndex === player);
			if (entry?.gameId !== first.gameId) throw new Error('Missing Quixx player view');
			const move = entry.view.availableMoves.length && select(4) !== 0
				? choose(entry.view.availableMoves, select) : null;
			const action = move
				? { type: phase === 'phase1' ? 'phase1-mark' : 'phase2-mark', row: move.row, cellIndex: move.cellIndex } as const
				: { type: phase === 'phase1' ? 'phase1-pass' : 'phase2-pass' } as const;
			return { player, action };
		}
		case 'booty-dice': {
			const view = first.view;
			const player = view.currentPlayerIndex;
			if (view.phase === 'ended') return null;
			if (view.turnPhase === 'rolling' && view.rollsRemaining > 0
				&& (view.rollsRemaining === 3 || select(2) === 0)) {
				return { player, action: { type: 'roll' } };
			}
			if (view.turnPhase === 'rolling' && view.rollsRemaining > 0) {
				return { player, action: { type: 'finishRolling' } };
			}
			const pending = view.pendingActions.find((action) => !action.resolved);
			if (pending) {
				const target = choose(view.players.filter((seat, index) => index !== player && !seat.isEliminated), select);
				return { player, action: { type: 'selectTarget', dieIndex: pending.dieIndex, targetPlayerId: target.id } };
			}
			return { player, action: { type: 'endTurn' } };
		}
	}
}

type Card = GameStateEnvelope<'crazy-eights'>['view']['myHand'][number];
type PlayerHand = { id: string; hand: Card[] };
type CardTable = {
	players: PlayerHand[];
	drawPile: Card[];
} & ({ discardPile: Card[] } | { piles: Map<string, Card[]> });

function cardKeys(value: unknown): string[] {
	if (typeof value !== 'object' || value === null) return [];
	if ('suit' in value && 'rank' in value) {
		const { rank, suit } = value;
		if (typeof rank !== 'string' || typeof suit !== 'string') throw new Error('Invalid card shape');
		return [`${rank}|${suit}`];
	}
	return Object.values(value).flatMap(cardKeys);
}

function assertCards(
	view: GameStateEnvelope<'crazy-eights' | 'kings-corner'>['view'],
	engine: CardTable,
	id: string | null,
) {
	const hand = engine.players.find((player) => player.id === id)?.hand ?? [];
	const tableCards = 'discardPile' in engine ? engine.discardPile : [...engine.piles.values()].flat();
	const deck = [...engine.drawPile, ...tableCards, ...engine.players.flatMap((player) => player.hand)];
	expect(deck).toHaveLength(52);
	expect(new Set(cardKeys(deck)).size).toBe(52);
	expect(view.myHand).toEqual(hand);
	expect(view.drawPileCount).toBe(engine.drawPile.length);
	expect(view.players.map((player) => player.cardCount)).toEqual(engine.players.map((player) => player.hand.length));
	const visible = new Set(cardKeys(view));
	// Only the top Crazy Eights discard is public. Kings Corner exposes its piles.
	const publicCards = 'discardPile' in engine ? engine.discardPile.slice(-1) : tableCards;
	const allowed = new Set(cardKeys([...hand, ...publicCards]));
	expect([...visible].filter((card) => !allowed.has(card))).toEqual([]);
}

function numericArrays(value: unknown): unknown[][] {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value) && value.length && value.every((item: unknown) => typeof item === 'number')) {
		return [value];
	}
	return Object.values(value).flatMap(numericArrays);
}

type LiarState = {
	players: { id: string; dice: number[] }[];
	revealedDice: Record<string, number[]> | null;
};

type Bid = NonNullable<GameStateEnvelope<'liars-dice'>['view']['currentBid']>;
type LiarEngine = {
	getState(): LiarState;
	isValidBid(bid: Bid, currentBid: Bid | null): boolean;
};

function assertView(
	frame: SeededFrame, gameId: GameId, id: string | null, engine: unknown,
) {
	expect(frame.gameId).toBe(gameId);
	const { view } = frame;
	const seat = id === null ? -1 : view.players.findIndex((player) => player.id === id);
	expect(view.myIndex).toBe(seat);
	if (id !== null) expect(seat).toBeGreaterThanOrEqual(0);
	expect(new Set(view.players.map((player) => player.id)).size).toBe(3);
	const active = 'currentPlayerIndex' in view ? view.currentPlayerIndex : view.activePlayerIndex;
	expect(active).toBeGreaterThanOrEqual(0);
	expect(active).toBeLessThan(view.players.length);
	const isActive = 'isMyTurn' in view ? view.isMyTurn : view.isActivePlayer;
	if (isActive) expect(seat).toBe(active);
	if (id === null) expect(isActive).toBe(false);

	switch (frame.gameId) {
		case 'crazy-eights':
		case 'kings-corner':
			assertCards(frame.view, engine as CardTable, id);
			break;
		case 'liars-dice': {
			const state = (engine as LiarEngine).getState();
			const { myDice, ...rest } = frame.view;
			expect(myDice).toEqual(state.players.find((player) => player.id === id)?.dice ?? []);
			for (const face of myDice) expect(Number.isInteger(face) && face >= 1 && face <= 6).toBe(true);
			expect(rest.revealedDice).toEqual(state.revealedDice);
			for (const player of rest.players) {
				expect(player.dice).toEqual(state.revealedDice?.[player.id] ?? null);
			}
			if (rest.phase === 'bidding') {
				expect(rest.revealedDice).toBeNull();
				expect(numericArrays(rest)).toEqual([]);
				expect(rest.players[active].eliminated).toBe(false);
				if (id !== null && !rest.players[seat].eliminated) {
					expect(myDice).toHaveLength(rest.players[seat].diceCount);
				}
				expect(rest.players.reduce((sum, player) => sum + player.diceCount, 0)).toBe(rest.totalDiceInPlay);
			}
			break;
		}
		case 'quixx': {
			for (const player of frame.view.players) {
				// Submission status is public. The unprocessed choice is private.
				expect(Object.keys(player).sort()).toEqual([
					'connected', 'id', 'isBot', 'lockedRows', 'name', 'penalties', 'phase1Submitted', 'sheet',
				]);
				expect(player.penalties).toBeGreaterThanOrEqual(0);
				expect(player.penalties).toBeLessThanOrEqual(4);
			}
			if (frame.view.dice.rolled) {
				const { rolled, ...dice } = frame.view.dice;
				expect(rolled).toBe(true);
				for (const [color, face] of Object.entries(dice)) {
					const removed = frame.view.removedDice.some((row) => row === color);
					// The roll that locked a row may still show its last face.
					expect(Number.isInteger(face) && face >= (removed ? 0 : 1) && face <= 6).toBe(true);
				}
			}
			if (id === null) expect(frame.view.availableMoves).toEqual([]);
			break;
		}
		case 'booty-dice':
			expect(frame.view.dice).toHaveLength(6);
			expect(new Set(frame.view.dice.map((die) => die.id)).size).toBe(6);
			for (const { face } of frame.view.dice) {
				expect(['doubloon', 'x_marks_spot', 'jolly_roger', 'cutlass', 'walk_plank', 'shield']).toContain(face);
			}
			expect(frame.view.rollsRemaining).toBeGreaterThanOrEqual(0);
			expect(frame.view.rollsRemaining).toBeLessThanOrEqual(3);
			if (frame.view.phase === 'playing') expect(frame.view.players[active].isEliminated).toBe(false);
			break;
	}
}

const seeds = [1, 7, 42, 2026, 0x5eed, 0xcafe, 0xbeef, 0x123456];
const trials = games.flatMap((gameId) => seeds.map((seed) => ({ gameId, seed })));

it.each(trials)('$gameId seed $seed plays legal moves and delivers recipient-safe views', async ({ gameId, seed }) => {
	engineInt = seededInt(seed);
	const select = seededInt(seed ^ 0x9e3779b9);
	// Model a human-paced request stream while executing the playthrough quickly.
	let clock = 0;
	vi.spyOn(performance, 'now').mockImplementation(() => clock);
	const game = await table(gameId);
	let scoresBeforePhase1: GameStateEnvelope<'quixx'>['view']['players'][number]['sheet'][] = [];

	for (let step = 0; step < 750; step++) {
		const batches = await game.collect();
		const room = game.room();
		const spectatorFrames = batches.at(-1)!.frames;
		expect(spectatorFrames.length, `step ${step}, spectator broadcast count`).toBeGreaterThan(0);
		const views = batches.map(({ id, frames }) => {
			expect(frames, `step ${step}, recipient ${id ?? 'spectator'}`).toHaveLength(spectatorFrames.length);
			const seededFrames = frames.filter((frame): frame is SeededFrame => games.some((id) => id === frame.gameId));
			for (const frame of seededFrames) {
				assertView(frame, gameId, id, room.gameData);
				if (frame.gameId === 'quixx' && frame.view.phase === 'phase1') {
					const sheets = frame.view.players.map(({ sheet }) => sheet);
					if (frame.view.players.every(({ phase1Submitted }) => !phase1Submitted)) {
						if (id === null) scoresBeforePhase1 = sheets;
					} else {
						expect(sheets).toEqual(scoresBeforePhase1);
					}
				}
			}
			expect(seededFrames).toHaveLength(frames.length);
			return seededFrames.at(-1)!;
		});
		const spectator = views.at(-1)!;
		const move = nextMove(views.slice(0, -1), select, room.gameData);
		if (!move) {
			expect(room.status).toBe('finished');
			return;
		}

		expect(room.status).toBe('playing');
		const playerId = spectator.view.players[move.player]?.id;
		const sender = game.players.find(({ id }) => id === playerId);
		if (!sender) throw new Error(`Step ${step} selected an invalid seat ${move.player}`);
		clock += 1000;
		const result = await sender.socket.timeout(1000).emitWithAck('game:action', move.action);
		expect(result, `step ${step}, action ${JSON.stringify(move.action)}`).toEqual({ ok: true });
	}
	throw new Error('Playthrough exceeded 750 moves');
}, 15_000);


it('Hearts sends private passes and hands to their recipients and advances a completed trick', async () => {
	engineInt = seededInt(42);
	const game = await table('hearts');

	async function collect() {
		return (await game.collect()).map(({ id, frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'hearts') throw new Error('Expected a Hearts view');
			return { id, view: frame.view };
		});
	}

	const initial = await collect();
	const submissions = initial.slice(0, 4).map(({ view }) => view.myHand.slice(0, 3));
	for (const [index, { socket }] of game.players.entries()) {
		expect(await socket.timeout(1000).emitWithAck('game:action', {
			type: 'pass-cards', cards: submissions[index],
		})).toEqual({ ok: true });
	}
	let views = await collect();
	for (const [index, { view }] of views.slice(0, 4).entries()) {
		expect(view.receivedCards).toEqual(submissions[(index + 3) % 4]);
		expect(view.myHand).toHaveLength(13);
	}
	expect(cardKeys(views[4].view)).toEqual([]);
	expect(new Set(views.slice(0, 4).flatMap(({ view }) => cardKeys(view.myHand))).size).toBe(52);

	for (let count = 0; count < 4; count++) {
		const active = views[4].view.activePlayerId;
		const player = game.players.find(({ id }) => id === active);
		const card = views.find(({ id }) => id === active)?.view.playableCards[0];
		if (!player || !card) throw new Error('Missing active Hearts card');
		if (count === 0) expect(card).toEqual({ rank: '2', suit: 'clubs' });
		expect(await player.socket.timeout(1000).emitWithAck('game:action', {
			type: 'play-card', card,
		})).toEqual({ ok: true });
		views = await collect();
		expect(views[4].view.trick).toHaveLength(count + 1);
	}
	const revealed = views[4].view;
	expect(revealed.phase).toBe('trick-won');
	expect(revealed.trickWinnerId).toBeTruthy();
	const spectatorStates = await vi.waitFor(async () => {
		const batches = await game.collect();
		const frame = batches[4].frames.at(-1);
		expect(frame?.gameId).toBe('hearts');
		if (frame?.gameId !== 'hearts') throw new Error('Expected the next trick');
		return frame.view;
	}, { timeout: 3000 });
	expect(spectatorStates).toMatchObject({
		phase: 'playing', trickNumber: 2, trick: [], activePlayerId: revealed.trickWinnerId,
	});
});

it('Farkle shares the same roll and banked score with players and spectators', async () => {
	engineInt = () => 0;
	const game = await table('farkle');
	const [host] = game.players;
	async function views() {
		return (await game.collect()).map(({ frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'farkle') throw new Error('Expected a Farkle view');
			return frame.view;
		});
	}
	await views();
	expect(await host.socket.timeout(1000).emitWithAck('game:action', { type: 'roll' })).toEqual({ ok: true });
	const rolled = await views();
	expect(rolled.every((view) => view.dice.join('') === '111111')).toBe(true);
	expect(await host.socket.timeout(1000).emitWithAck('game:action', {
		type: 'keep', indices: [0, 1, 2, 3, 4, 5],
	})).toEqual({ ok: true });
	await views();
	expect(await host.socket.timeout(1000).emitWithAck('game:action', { type: 'bank' })).toEqual({ ok: true });
	const banked = await views();
	expect(banked.every((view) => view.players[0].score === 3000 && view.phase === 'banked')).toBe(true);
	game.reset();
});

it('Word Split reveals shared words only after all players finish', async () => {
	engineInt = (max) => max - 1;
	const game = await table('word-split');
	const [host, guest] = game.players;
	async function views() {
		return (await game.collect()).map(({ frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'word-split') throw new Error('Expected a Word Split view');
			return frame.view;
		});
	}
	const initial = await views();
	expect(initial[0].letters).toEqual(initial.at(-1)?.letters);
	expect(await host.socket.timeout(1000).emitWithAck('game:action', {
		type: 'submit', word: 'able', round: 1,
	})).toEqual({ ok: true });
	const privateViews = await views();
	expect(privateViews.map((view) => view.myWords)).toEqual([['able'], [], [], []]);
	expect(privateViews.every((view) => view.results.length === 0)).toBe(true);
	expect(await guest.socket.timeout(1000).emitWithAck('game:action', {
		type: 'submit', word: 'able', round: 1,
	})).toEqual({ ok: true });
	for (const { socket } of game.players) {
		expect(await socket.timeout(1000).emitWithAck('game:action', { type: 'finish', round: 1 })).toEqual({ ok: true });
	}
	const revealed = await views();
	expect(revealed.every((view) => view.phase === 'reveal')).toBe(true);
	expect(revealed.at(-1)?.results).toEqual([{ word: 'able', playerIds: [host.id, guest.id], points: 0 }]);
	game.reset();
});

it('Golf redacts every hidden slot through a five-seat hole over the socket', async () => {
	engineInt = seededInt(530);
	const game = await table('golf');
	async function views() {
		return (await game.collect()).map(({ frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'golf') throw new Error('Expected a Golf view');
			return frame.view;
		});
	}
	async function move(index: number, action: GameAction<'golf'>) {
		expect(await game.players[index].socket.timeout(1000).emitWithAck('game:action', action)).toEqual({ ok: true });
	}
	const initial = await views();
	expect(initial[0].stockCount).toBe(73);
	for (const view of initial) expect(view.players.every(({ grid }) => grid.every((card) => card === null))).toBe(true);
	for (const index of game.players.keys()) {
		await move(index, { type: 'reveal', slot: 0 });
		await move(index, { type: 'reveal', slot: 3 });
	}
	let current = await views();
	const first = game.players.findIndex(({ id }) => id === current[0].activePlayerId);
	for (let turn = 0; turn <= 15; turn++) {
		const index = (first + turn) % game.players.length;
		expect(current.map(({ canTakeDiscard }) => canTakeDiscard)).toEqual(current.map((_, viewer) => viewer === index));
		await move(index, { type: 'take-discard', slot: index === first ? [1, 2, 4, 5][Math.floor(turn / 5)] : 0 });
		current = await views();
		const spectator = current.at(-1)!;
		expect(current.every((view) => JSON.stringify(view.players) === JSON.stringify(spectator.players))).toBe(true);
		if (turn < 15) expect(spectator.players.filter(({ grid }) => grid.filter(Boolean).length === 2)).toHaveLength(4);
	}
	expect(current.at(-1)?.phase).toBe('hole-scoring');
	expect(current.at(-1)?.players.every(({ grid }) => grid.every(Boolean))).toBe(true);
	game.reset();
});

it('President sends seven private hands and a public play, then clears after all other seats pass', async () => {
	engineInt = seededInt(420);
	const game = await table('president');
	async function views() {
		return (await game.collect()).map(({ frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'president') throw new Error('Expected a President view');
			return frame.view;
		});
	}
	const dealt = await views();
	const spectator = dealt.at(-1)!;
	expect(spectator).toMatchObject({ myHand: [], legalPlays: [], received: [], mustReturn: 0 });
	const hands = dealt.slice(0, -1).flatMap(({ myHand }) => myHand);
	expect(new Set(hands.map(({ rank, suit }) => rank + suit)).size).toBe(52);
	const first = game.players.findIndex(({ id }) => id === spectator.activePlayerId);
	const card = dealt[first].myHand[0];
	expect(await game.players[first].socket.timeout(1000).emitWithAck('game:action', { type: 'play', cards: [card] }))
		.toEqual({ ok: true });
	const played = await views();
	expect(played.every(({ trick }) => trick[0].cards[0].rank === card.rank && trick[0].cards[0].suit === card.suit)).toBe(true);
	for (let offset = 1; offset < 7; offset++) {
		const { socket } = game.players[(first + offset) % 7];
		expect(await socket.timeout(1000).emitWithAck('game:action', { type: 'pass' })).toEqual({ ok: true });
	}
	expect((await views()).at(-1)?.phase).toBe('trick-cleared');
	game.reset();
});

it('Gin Rummy redacts the stock draw until a player knocks and reveals both spreads', async () => {
	engineInt = (max) => max - 1;
	const game = await table('gin-rummy');
	const [host, guest] = game.players;
	async function views() {
		return (await game.collect()).map(({ frames }) => {
			const frame = frames.at(-1);
			if (frame?.gameId !== 'gin-rummy') throw new Error('Expected a Gin Rummy view');
			return frame.view;
		});
	}
	expect((await views())[2].myHand).toEqual([]);
	expect(await host.socket.timeout(1000).emitWithAck('game:action', { type: 'pass-upcard' })).toEqual({ ok: true });
	expect(await guest.socket.timeout(1000).emitWithAck('game:action', { type: 'pass-upcard' })).toEqual({ ok: true });
	expect(await host.socket.timeout(1000).emitWithAck('game:action', { type: 'draw-stock' })).toEqual({ ok: true });
	const [drawing, waiting, watching] = await views();
	expect(drawing.myHand).toHaveLength(11);
	expect(waiting.myHand).toHaveLength(10);
	expect(watching).toMatchObject({ myHand: [], knockable: [], discardable: [], lastResult: null });
	const card = drawing.knockable.at(-1);
	expect(card).toBeTruthy();
	expect(await host.socket.timeout(1000).emitWithAck('game:action', { type: 'knock', card })).toEqual({ ok: true });
	const revealed = await views();
	for (const view of revealed) {
		expect(view.phase).toBe('hand-scoring');
		expect(view.lastResult).toEqual(revealed[2].lastResult);
		expect(view.lastResult?.knocker?.deadwoodCount).toBe(0);
	}
	game.reset();
});
