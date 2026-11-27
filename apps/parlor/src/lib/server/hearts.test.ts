import { expect, it } from 'vitest';
import { HeartsEngine } from '../../../../../games/hearts/src/engine.js';
import { legalCards, winningPlay } from '../../../../../games/hearts/src/rules.js';
import type { GameStateEnvelope } from '@parlor/game-types';

type Card = GameStateEnvelope<'hearts'>['view']['myHand'][number];
const club: Card = { suit: 'clubs', rank: '2' };
const heart: Card = { suit: 'hearts', rank: 'A' };
const queen: Card = { suit: 'spades', rank: 'Q' };
const safe: Card = { suit: 'diamonds', rank: 'K' };
const players = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, bot: false }));

it('follows suit, applies first-trick and unbroken-hearts restrictions, and ranks ace high', () => {
	expect(legalCards([heart, queen, club], undefined, true, false)).toEqual([club]);
	expect(legalCards([heart, queen, club], club, true, false)).toEqual([club]);
	expect(legalCards([heart, queen, safe], club, true, false)).toEqual([safe]);
	expect(legalCards([heart, queen], club, true, false)).toEqual([heart]);
	expect(legalCards([heart, queen], undefined, false, false)).toEqual([queen]);
	expect(legalCards([heart], undefined, false, false)).toEqual([heart]);
	expect(legalCards([heart, queen], undefined, false, true)).toEqual([heart, queen]);
	expect(winningPlay([
		{ playerId: 'A', card: club },
		{ playerId: 'B', card: { suit: 'clubs', rank: 'K' } },
		{ playerId: 'C', card: { suit: 'clubs', rank: 'A' } },
		{ playerId: 'D', card: heart },
	]).playerId).toBe('C');
});

function selectPasses(engine: HeartsEngine) {
	const initial = players.map(({ id }) => engine.view(id).myHand.slice(0, 3));
	for (const [index, { id }] of players.entries()) engine.passCards(id, initial[index]);
	return initial;
}

function playRound(engine: HeartsEngine) {
	for (let trick = 1; trick <= 13; trick++) {
		for (let index = 0; index < 4; index++) {
			const player = engine.view().activePlayerId;
			if (!player) throw new Error('Expected an active player');
			const card = engine.view(player).playableCards[0];
			expect(card).toBeDefined();
			engine.playCard(player, card);
		}
		expect(engine.currentPhase).toBe('trick-won');
		expect(engine.view().trick).toHaveLength(4);
		engine.advanceReveal();
	}
}

it('cycles pass directions and deals full hands, including a round with no pass', () => {
	const engine = new HeartsEngine(players, (max) => max - 1, 200);
	for (const [direction, offset] of [['left', 1], ['right', 3], ['across', 2], ['hold', 0]] as const) {
		expect(engine.view().passDirection).toBe(direction);
		if (offset) {
			const passes = selectPasses(engine);
			for (const [index, { id }] of players.entries()) {
				expect(engine.view(id).receivedCards).toEqual(passes[(index + 4 - offset) % 4]);
			}
		} else {
			expect(engine.currentPhase).toBe('playing');
		}
		expect(players.every(({ id }) => engine.view(id).myHand.length === 13)).toBe(true);
		playRound(engine);
		expect(engine.currentPhase).toBe('round-scoring');
		engine.advanceReveal();
	}
	expect(engine.view().passDirection).toBe('left');
});

it('scores a moon as 26 points for each opponent and finishes when the target is reached', () => {
	// This deal lets D take all the penalty cards when each seat chooses its first legal play.
	let seed = 15;
	const engine = new HeartsEngine(players, (max) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return Math.floor((seed / 0x100000000) * max);
	}, 26);
	selectPasses(engine);
	playRound(engine);
	const view = engine.view();
	expect(view.phase).toBe('game-over');
	expect(view.moonShooterId).toBe('D');
	expect(view.winnerIds).toEqual([view.moonShooterId]);
	for (const player of view.players) {
		expect(player.totalScore).toBe(player.id === view.moonShooterId ? 0 : 26);
	}
});

it('fills a departed seat without exposing its hand and pauses when all humans leave', () => {
	const engine = new HeartsEngine(players, (max) => max - 1);
	engine.setConnected('D', false);
	engine.automaticMove()?.();
	expect(engine.view().players[3].passed).toBe(true);
	expect(engine.view().myHand).toEqual([]);
	expect(engine.view().receivedCards).toEqual([]);
	for (const { id } of players) engine.setConnected(id, false);
	expect(engine.automaticMove()).toBeUndefined();
});
