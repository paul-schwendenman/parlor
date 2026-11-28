import { expect, it } from 'vitest';
import { FaultLineEngine } from '../../../../../games/fault-line/src/engine.js';

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id, bot: false }));

it('hides caches and bounties until their respective reveal phases', () => {
  const game = new FaultLineEngine(players, () => 0);
  game.act('a', { type: 'plant', round: 1, cache: 0, bounty: 2 });
  expect(game.view('a')).toMatchObject({ myCache: 0, myHand: [0, 1, 1, 2, 2] });
  expect(game.view('b')).toMatchObject({ myCache: null, myHand: [0, 0, 1, 1, 2, 2], last: [] });
  expect(game.view().players[0]).toMatchObject({ bounty: null, chips: 4, ready: true, history: [] });
  expect(() => game.act('a', { type: 'plant', round: 1, cache: 1, bounty: 0 })).toThrow();
  game.act('b', { type: 'plant', round: 1, cache: 2, bounty: 1 });
  game.act('c', { type: 'plant', round: 1, cache: 1, bounty: 0 });
  expect(game.view()).toMatchObject({ phase: 'open', myCache: null, last: [] });
  expect(game.view().players.map(({ bounty, chips }) => [bounty, chips])).toEqual([[2, 2], [1, 3], [0, 4]]);
  expect(() => game.act('b', { type: 'open', round: 1, target: 'b' })).toThrow();
  game.act('b', { type: 'open', round: 1, target: 'a' });
  expect(game.view('a').myTarget).toBeNull();
  game.act('c', { type: 'open', round: 1, target: 'b' });
  game.act('a', { type: 'open', round: 1, target: null });
  expect(game.view().last).toEqual([
    { id: 'a', cache: 0, target: null, points: 2 },
    { id: 'b', cache: 2, target: 'a', points: 0 },
    { id: 'c', cache: 1, target: 'b', points: 4 },
  ]);
  game.advanceReveal();
  expect(() => game.act('a', { type: 'plant', round: 1, cache: 1, bounty: 0 })).toThrow();
  expect(game.view().players[0]).toMatchObject({ chips: 2, history: [0] });
});

it('plays six rounds with six bots and preserves the known inventory', () => {
  let seed = 218;
  const game = new FaultLineEngine(Array.from({ length: 6 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  });
  for (let step = 0; step < 100 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  const view = game.view();
  expect(view.phase).toBe('game-over');
  expect(view.winnerIds.length).toBeGreaterThan(0);
  for (const seat of view.players) {
    expect([...seat.history].sort()).toEqual([0, 0, 1, 1, 2, 2]);
    expect(seat.chips).toBeGreaterThanOrEqual(0);
  }
});
