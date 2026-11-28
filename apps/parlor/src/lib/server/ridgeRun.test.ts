import { expect, it } from 'vitest';
import { RidgeRunEngine } from '../../../../../games/ridge-run/src/engine.js';
import { availableMoves } from '../../../../../games/ridge-run/src/rules.js';

const players = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];

it('uses doubles for two steps, caps at the summit, and limits a turn to two routes', () => {
  expect(availableMoves([5, 5, 2], {}, {})).toEqual([{ route: 7, steps: 1 }, { route: 10, steps: 2 }]);
  expect(availableMoves([5, 5, 2], { 10: 4 }, {})).toContainEqual({ route: 10, steps: 1 });
  expect(availableMoves([5, 5, 2], {}, { 10: 1, 9: 2 })).toEqual([{ route: 10, steps: 2 }]);
  expect(availableMoves([5, 5, 2], { 10: 4 }, { 10: 1, 9: 2 })).toEqual([]);
});

it('loses unbanked steps on a bust and awards first and later summit scores', () => {
  const values = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0, 0]).flat();
  const game = new RidgeRunEngine(players, (max) => max === 2 ? 0 : values.shift()!);
  const rollAndClimb = (player: string) => {
    game.act(player, { type: 'roll' });
    game.act(player, { type: 'climb', route: 2 });
  };
  for (const id of ['a', 'b']) {
    rollAndClimb(id);
    expect(() => game.act(id, { type: 'climb', route: 2 })).toThrow();
    rollAndClimb(id);
    game.act(id, { type: 'camp' });
    game.advanceReveal();
  }
  expect(game.view().players.map(({ points }) => points)).toEqual([3, 2]);
  expect(game.view().firstSummits).toEqual({ 2: 'a' });
  values.unshift(5, 5, 5, 2, 2, 2);
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'climb', route: 12 });
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'climb', route: 6 });
  game.act('a', { type: 'roll' });
  expect(game.view().phase).toBe('bust');
  game.advanceReveal();
  expect(game.view().players[0].progress).toEqual({ 2: 3 });

});

it('ends a full four-bot game at seven or more summit points', () => {
  let seed = 83;
  const game = new RidgeRunEngine(Array.from({ length: 4 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  });
  for (let step = 0; step < 2000 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  const view = game.view();
  expect(view.phase).toBe('game-over');
  expect(view.players.find(({ id }) => id === view.winnerId)?.points).toBeGreaterThanOrEqual(7);
});
