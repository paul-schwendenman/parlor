import { expect, it } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { euchreGame } from '@parlor/euchre/server-definition';
import { EuchreEngine } from '../../../../../games/euchre/src/engine.js';
import { effectiveSuit, legalCards, scoreRound, winningPlay } from '../../../../../games/euchre/src/rules.js';

type Card = GameStateEnvelope<'euchre'>['view']['myHand'][number];
const right: Card = { suit: 'hearts', rank: 'J' };
const left: Card = { suit: 'diamonds', rank: 'J' };
const ace: Card = { suit: 'hearts', rank: 'A' };
const diamond: Card = { suit: 'diamonds', rank: 'A' };
const players = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, bot: false }));

it('treats the left bower as trump when following suit and ranks it below the right bower', () => {
	expect(effectiveSuit(left, 'hearts')).toBe('hearts');
	expect(legalCards([left, diamond], right, 'hearts')).toEqual([left]);
	expect(legalCards([left, diamond], diamond, 'hearts')).toEqual([diamond]);
	expect(legalCards([diamond, ace], left, 'hearts')).toEqual([ace]);
	const lead = { playerId: 'A', card: diamond };
	const trump = { playerId: 'B', card: ace };
	const leftPlay = { playerId: 'C', card: left };
	const rightPlay = { playerId: 'D', card: right };
	expect(winningPlay([lead, trump], 'hearts')).toBe(trump);
	expect(winningPlay([lead, trump, leftPlay], 'hearts')).toBe(leftPlay);
	expect(winningPlay([lead, trump, leftPlay, rightPlay], 'hearts')).toBe(rightPlay);
});

it('scores made hands, marches, loners, and euchres', () => {
	expect(scoreRound(0, 3, false)).toEqual({ team: 0, points: 1, outcome: 'made' });
	expect(scoreRound(0, 4, true)).toEqual({ team: 0, points: 1, outcome: 'made' });
	expect(scoreRound(1, 5, false)).toEqual({ team: 1, points: 2, outcome: 'march' });
	expect(scoreRound(1, 5, true)).toEqual({ team: 1, points: 4, outcome: 'lone-march' });
	expect(scoreRound(1, 2, true)).toEqual({ team: 0, points: 2, outcome: 'euchred' });
});

it('keeps the 24-card deal private except for the up card and handles dealer pickup and discard', () => {
	const engine = new EuchreEngine(players, (max) => max - 1);
	const initial = engine.view();
	expect(initial).toMatchObject({ phase: 'order-up', dealerId: 'A', activePlayerId: 'B', myHand: [], playableCards: [] });
	expect(initial.players.map(({ team }) => team)).toEqual([0, 1, 0, 1]);
	const dealt = players.flatMap(({ id }) => engine.view(id).myHand);
	expect(dealt).toHaveLength(20);
	expect([...dealt, initial.upCard].every((card) => card && ['9', '10', 'J', 'Q', 'K', 'A'].includes(card.rank))).toBe(true);
	expect(new Set([...dealt, initial.upCard].map((card) => card?.suit + String(card?.rank))).size).toBe(21);

	expect(() => engine.orderUp('C', false)).toThrow('It is not your turn.');
	engine.orderUp('B', false);
	expect(engine.view()).toMatchObject({ phase: 'discard', activePlayerId: 'A', trump: initial.upCard?.suit });
	expect(engine.view('A').myHand).toHaveLength(6);
	expect(engine.view('B').myHand).toHaveLength(5);
	expect(() => engine.discard('A', { suit: 'clubs', rank: '2' })).toThrow('Choose a card from your hand.');
	engine.discard('A', engine.view('A').myHand[0]);
	expect(engine.view()).toMatchObject({ phase: 'playing', upCard: null, activePlayerId: 'B' });
	expect(engine.view('A').myHand).toHaveLength(5);
});

it('excludes the turned suit and makes the dealer name trump after seven passes', () => {
	const engine = new EuchreEngine(players, (max) => max - 1);
	for (const id of ['B', 'C', 'D', 'A']) engine.pass(id);
	const second = engine.view('B');
	expect(second).toMatchObject({ phase: 'name-trump', activePlayerId: 'B', upCard: null, canPass: true });
	expect(() => engine.nameTrump('B', second.turnedSuit, false)).toThrow('different from the turned-down card');
	for (const id of ['B', 'C', 'D']) engine.pass(id);
	expect(engine.view('A').canPass).toBe(false);
	expect(() => engine.pass('A')).toThrow('The dealer must name trump.');
	engine.nameTrump('A', 'hearts', false);
	expect(engine.view()).toMatchObject({ phase: 'playing', makerId: 'A', trump: 'hearts', activePlayerId: 'B' });
});

function playHand(engine: EuchreEngine, seats: number) {
	for (let trick = 1; trick <= 5; trick++) {
		for (let played = 0; played < seats; played++) {
			const id = engine.view().activePlayerId;
			if (!id) throw new Error('Expected an active seat');
			const card = engine.view(id).playableCards[0];
			expect(card).toBeDefined();
			engine.playCard(id, card);
		}
		const table = engine.view();
		expect(table).toMatchObject({ phase: 'trick-won', trickNumber: trick });
		expect(table.trick).toHaveLength(seats);
		engine.advanceReveal();
		if (trick < 5) expect(engine.view().activePlayerId).toBe(table.trickWinnerId);
	}
}

it('skips the loner’s partner, scores five tricks, and ends at the target', () => {
	const engine = new EuchreEngine(players, (max) => max - 1, 1);
	engine.orderUp('B', true);
	engine.discard('A', engine.view('A').myHand[0]);
	const initial = engine.view();
	expect(initial).toMatchObject({ lonerId: 'B', activePlayerId: 'A' });
	expect(initial.players.find(({ id }) => id === 'D')?.sittingOut).toBe(true);
	playHand(engine, 3);
	const scored = engine.view();
	expect(engine.view('D').myHand).toHaveLength(5);
	expect(scored.tricks.reduce((sum, count) => sum + count, 0)).toBe(5);
	expect(scored.phase).toBe('game-over');
	expect(scored.winningTeam).toBe(scored.result?.team);
});

it('rotates the dealer and hands an absent turn back on reconnect', () => {
	const engine = new EuchreEngine(players, (max) => max - 1);
	engine.setConnected('B', false);
	expect(engine.automaticAction()?.id).toBe('B');
	engine.setConnected('B', true);
	expect(engine.automaticAction()).toBeUndefined();
	engine.orderUp('B', false);
	engine.discard('A', engine.view('A').myHand[0]);
	playHand(engine, 4);
	expect(engine.currentPhase).toBe('round-scoring');
	engine.advanceReveal();
	expect(engine.view()).toMatchObject({ phase: 'order-up', round: 2, dealerId: 'B', activePlayerId: 'C', trump: null });
});

it('validates bidding decisions and discard payloads', () => {
	expect(euchreGame.validateAction({ type: 'order-up', alone: 'yes' })).toMatchObject({ ok: false });
	expect(euchreGame.validateAction({ type: 'name-trump', suit: 'stars', alone: false })).toMatchObject({ ok: false });
	expect(euchreGame.validateAction({ type: 'name-trump', suit: 'clubs', alone: true })).toMatchObject({ ok: true });
	expect(euchreGame.validateAction({ type: 'discard', card: { ...ace, extra: true } })).toMatchObject({ ok: false });
});
