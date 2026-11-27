import { expect, it } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { spadesGame } from '@parlor/spades/server-definition';
import { SpadesEngine } from '../../../../../games/spades/src/engine.js';
import { legalCards, scoreRound, winningPlay } from '../../../../../games/spades/src/rules.js';

type Card = GameStateEnvelope<'spades'>['view']['myHand'][number];
const club: Card = { suit: 'clubs', rank: 'A' };
const lowClub: Card = { suit: 'clubs', rank: '2' };
const diamond: Card = { suit: 'diamonds', rank: 'A' };
const lowSpade: Card = { suit: 'spades', rank: '2' };
const highSpade: Card = { suit: 'spades', rank: 'A' };
const players = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, bot: false }));

it('follows suit and restricts leading unbroken spades', () => {
	expect(legalCards([club, lowSpade], lowClub, false)).toEqual([club]);
	expect(legalCards([club, lowSpade], diamond, false)).toEqual([club, lowSpade]);
	expect(legalCards([club, lowSpade], undefined, false)).toEqual([club]);
	expect(legalCards([lowSpade, highSpade], undefined, false)).toEqual([lowSpade, highSpade]);
	expect(legalCards([club, lowSpade], undefined, true)).toEqual([club, lowSpade]);
});

it('ranks the led suit ace high, with spades trumping every other suit', () => {
	const plays = [
		{ playerId: 'A', card: lowClub },
		{ playerId: 'B', card: diamond },
		{ playerId: 'C', card: club },
		{ playerId: 'D', card: lowSpade },
	];
	expect(winningPlay(plays.slice(0, 3))?.playerId).toBe('C');
	expect(winningPlay(plays)?.playerId).toBe('D');
	expect(winningPlay([...plays, { playerId: 'E', card: highSpade }])?.playerId).toBe('E');
});

it('scores made and missed bids, nil, and the ten-bag rollover independently', () => {
	expect(scoreRound([{ bid: 4, tricks: 5 }, { bid: 3, tricks: 4 }], 9)).toEqual({
		bidPoints: 70, bagPoints: 2, nilPoints: 0, bagPenalty: -100, total: -28, bags: 1,
	});
	expect(scoreRound([{ bid: 4, tricks: 3 }, { bid: 0, tricks: 2 }], 9)).toEqual({
		bidPoints: -40, bagPoints: 0, nilPoints: -100, bagPenalty: 0, total: -140, bags: 9,
	});
	expect(scoreRound([{ bid: 0, tricks: 0 }, { bid: 0, tricks: 0 }], 0).total).toBe(200);
	expect(scoreRound([{ bid: 3, tricks: 4 }, { bid: 0, tricks: 0 }], 0).total).toBe(131);
});

it('validates bid amounts and card payloads before the engine acts', () => {
	for (const amount of [-1, 14, 2.5, '1', undefined]) {
		expect(spadesGame.validateAction({ type: 'bid', amount })).toMatchObject({ ok: false });
	}
	expect(spadesGame.validateAction({ type: 'bid', amount: 0 })).toEqual({ ok: true, action: { type: 'bid', amount: 0 } });
	expect(spadesGame.validateAction({ type: 'bid', amount: 13 })).toMatchObject({ ok: true });
	expect(spadesGame.validateAction({ type: 'play-card', card: { ...club, extra: true } })).toMatchObject({ ok: false });
});

function playRound(engine: SpadesEngine) {
	for (let trick = 1; trick <= 13; trick++) {
		for (let position = 0; position < 4; position++) {
			const id = engine.view().activePlayerId;
			if (!id) throw new Error('Expected an active player');
			const card = engine.view(id).playableCards[0];
			expect(card).toBeDefined();
			engine.playCard(id, card);
		}
		const reveal = engine.view();
		expect(reveal).toMatchObject({ phase: 'trick-won', trickNumber: trick, activePlayerId: null });
		expect(reveal.trick).toHaveLength(4);
		engine.advanceReveal();
		if (trick < 13) expect(engine.view().activePlayerId).toBe(reveal.trickWinnerId);
	}
}

it('deals private hands, assigns fixed partners, rotates the dealer, and finishes at the goal', () => {
	let seed = 36;
	const engine = new SpadesEngine(players, (max) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return Math.floor((seed / 0x100000000) * max);
	}, 25);
	const initial = engine.view();
	expect(initial).toMatchObject({ dealerId: 'A', activePlayerId: 'B', myHand: [], playableCards: [] });
	expect(initial.players.map((player) => player.team)).toEqual([0, 1, 0, 1]);
	const cards = players.flatMap(({ id }) => {
		const hand = engine.view(id).myHand;
		expect(hand).toHaveLength(13);
		return hand.map((card) => card.suit + card.rank);
	});
	expect(new Set(cards).size).toBe(52);
	expect(() => engine.bid('C', 2)).toThrow('It is not your turn.');
	expect(() => engine.bid('B', 14)).toThrow('Choose a bid from 0 to 13.');
	for (const id of ['B', 'C', 'D', 'A']) engine.bid(id, 1);
	expect(engine.view().activePlayerId).toBe('B');
	playRound(engine);
	const scored = engine.view();
	expect(scored.players.reduce((sum, player) => sum + player.tricks, 0)).toBe(13);
	expect(scored.phase).toBe('game-over');
	const scores = scored.teams.map(({ score }) => score);
	expect(scored.winningTeam).toBe(scores[0] > scores[1] ? 0 : 1);

	const rotating = new SpadesEngine(players, (max) => max - 1, 500);
	for (const id of ['B', 'C', 'D', 'A']) rotating.bid(id, 1);
	playRound(rotating);
	expect(rotating.currentPhase).toBe('round-scoring');
	rotating.advanceReveal();
	expect(rotating.view()).toMatchObject({ phase: 'bidding', round: 2, dealerId: 'B', activePlayerId: 'C' });
});

it('automates an absent seat and gives the turn back on reconnect', () => {
	const engine = new SpadesEngine(players);
	expect(engine.automaticAction()).toBeUndefined();
	engine.setConnected('B', false);
	expect(engine.automaticAction()).toMatchObject({ id: 'B', action: { type: 'bid' } });
	engine.setConnected('B', true);
	expect(engine.automaticAction()).toBeUndefined();
});
