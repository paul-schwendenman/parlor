import { expect, it } from 'vitest';
import { CouncilLedgerEngine } from '../../../../../games/council-ledger/src/engine.js';
import { challengeMs, goal } from '../../../../../games/council-ledger/src/rules.js';

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id, bot: false }));

it('keeps permits and responses private, then resolves a genuine claim for all challengers', () => {
  const game = new CouncilLedgerEngine(players, () => 0, () => 0);
  expect(game.view('a').myPermit).toBe('contracts');
  expect(game.view('b').myPermit).toBeNull();
  expect(() => game.act('b', { type: 'claim', turn: 1, permit: 'contracts' })).toThrow();
  game.act('a', { type: 'claim', turn: 1, permit: 'contracts' });
  game.act('b', { type: 'respond', turn: 1, challenge: true });
  expect(game.view()).toMatchObject({ phase: 'response', claim: 'contracts', deadline: challengeMs, myPermit: null, outcome: null });
  expect(() => game.act('b', { type: 'respond', turn: 1, challenge: false })).toThrow();
  game.act('c', { type: 'respond', turn: 1, challenge: true });
  expect(game.view().outcome).toEqual({ accepted: true, challengerIds: ['b', 'c'], shown: 'contracts' });
  expect(game.view().players.map(({ coins }) => coins)).toEqual([7, 2, 2]);
});

it('cancels a caught bluff, but accepts an unchallenged bluff when the timer expires', () => {
  let now = 10;
  const game = new CouncilLedgerEngine(players, () => 0, () => now);
  game.act('a', { type: 'claim', turn: 1, permit: 'outreach' });
  game.act('b', { type: 'respond', turn: 1, challenge: true });
  game.act('c', { type: 'respond', turn: 1, challenge: false });
  expect(game.view().outcome).toEqual({ accepted: false, challengerIds: ['b'], shown: 'contracts' });
  expect(game.view().players.map(({ coins, standing }) => [coins, standing])).toEqual([[2, 0], [3, 1], [3, 0]]);
  game.advanceReveal();
  expect(() => game.act('b', { type: 'service', turn: 1 })).toThrow();
  game.act('b', { type: 'claim', turn: 2, permit: 'works' });
  expect(game.expire()).toBe(false);
  now += challengeMs;
  expect(() => game.act('a', { type: 'respond', turn: 2, challenge: true })).toThrow();
  expect(game.expire()).toBe(true);
  expect(game.view().outcome).toEqual({ accepted: true, challengerIds: [], shown: null });
  expect(game.view().players[1]).toMatchObject({ coins: 1, standing: 4 });
});

it('completes a full six-bot game within the maximum rounds', () => {
  let seed = 690;
  const game = new CouncilLedgerEngine(Array.from({ length: 6 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  }, () => 0);
  for (let step = 0; step < 400 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  const view = game.view();
  expect(view.phase).toBe('game-over');
  expect(view.players.every(({ coins }) => coins >= 0)).toBe(true);
  const best = Math.max(...view.players.map(({ standing }) => standing));
  expect(best >= goal || view.round === 8).toBe(true);
  expect(view.winnerIds).toEqual(view.players.filter(({ standing }) => standing === best).map(({ id }) => id));
});
