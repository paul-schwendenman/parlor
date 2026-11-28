import { expect, it } from 'vitest';
import { HarborDiceEngine } from '../../../../../games/harbor-dice/src/engine.js';
import { categories, scores } from '../../../../../games/harbor-dice/src/rules.js';

const players = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];

it('scores the four harbor categories', () => {
  expect(scores([3, 3, 3, 5, 5])['twin-docks']).toBe(24);
  expect(scores([1, 6, 6, 2, 4]).lighthouse).toBe(16);
  expect(scores([6, 4, 5, 3, 2]).channel).toBe(34);
  expect(scores([4, 5, 2, 3, 3]).channel).toBe(22);
  expect(scores([3, 3, 3, 3, 1]).fleet).toBe(30);
  expect(scores([6, 6, 6, 6, 6]).fleet).toBe(45);
});

it('rerolls only unheld dice and rejects illegal moves without changing state', () => {
  const values = [0, 1, 2, 3, 4, 5, 5, 5, ...Array<number>(10).fill(0)];
  const game = new HarborDiceEngine(players, (max) => max === 2 ? 0 : values.shift()!);
  expect(() => game.act('a', { type: 'score', category: 'channel' })).toThrow();
  game.act('a', { type: 'roll', held: [] });
  const before = game.view();
  expect(() => game.act('b', { type: 'roll', held: [] })).toThrow();
  expect(() => game.act('a', { type: 'roll', held: [0, 0] })).toThrow();
  expect(game.view()).toEqual(before);
  game.act('a', { type: 'roll', held: [0, 4] });
  expect(game.view()).toMatchObject({ dice: [1, 6, 6, 6, 5], rollsLeft: 1, preview: { lighthouse: 18 } });
  game.act('a', { type: 'score', category: 'lighthouse' });
  expect(game.view()).toMatchObject({ phase: 'scored', lastScore: { category: 'lighthouse', points: 18 } });
  game.advanceReveal();
  game.act('b', { type: 'roll', held: [] });
  game.act('b', { type: 'score', category: 'ones' });
  expect(game.view().round).toBe(1);
  game.advanceReveal();
  expect(game.view().round).toBe(2);
  game.act('a', { type: 'roll', held: [] });
  expect(() => game.act('a', { type: 'score', category: 'lighthouse' })).toThrow();
});

it('plays ten rounds for six bots and reports shared wins', () => {
  const game = new HarborDiceEngine(Array.from({ length: 6 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), () => 0);
  for (let step = 0; step < 360 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  expect(game.view().winnerIds).toHaveLength(6);
  for (const player of game.view().players) {
    expect(Object.keys(player.scorecard)).toHaveLength(categories.length);
    expect(player.total).toBe(50);
  }
});
