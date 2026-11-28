import { expect, it } from 'vitest';
import { BoggleEngine } from '../../../../../games/boggle/src/engine.js';
import { solve } from '../../../../../games/boggle/src/lexicon.js';
import { findPath, points } from '../../../../../games/boggle/src/rules.js';

// C A T S
// O R E Q
// D O G E
// X Y Z L
const GRID = ['C', 'A', 'T', 'S', 'O', 'R', 'E', 'Q', 'D', 'O', 'G', 'E', 'X', 'Y', 'Z', 'L'];
const people = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];

function setup() {
  let clock = 0;
  const game = new BoggleEngine(people, () => 0, () => clock, { rounds: 2 });
  game.rig(GRID);
  return { game, advance(ms: number) { clock += ms; game.advance(); } };
}

it('traces words through touching cubes, once each, with Qu as two letters', () => {
  expect(findPath(GRID, 'cats')).toEqual([0, 1, 2, 3]);
  expect(findPath(GRID, 'care')).toEqual([0, 1, 5, 6]);
  expect(findPath(GRID, 'cac')).toBeNull();
  expect(findPath(GRID, 'dog')).toEqual([8, 9, 10]);
  expect(findPath(['Q', 'I', 'T', 'E', ...Array<string>(12).fill('X')], 'quit')).toEqual([0, 1, 2]);
  expect([3, 4, 5, 6, 7, 8, 9].map((length) => points('x'.repeat(length)))).toEqual([1, 1, 2, 3, 5, 11, 11]);
  const words = solve(GRID);
  expect(words).toContain('cats');
  expect(words).toContain('dog');
  expect(words.every((word) => findPath(GRID, word))).toBe(true);
});

it('accepts real words on the grid and rejects the rest', () => {
  const { game } = setup();
  game.act('a', { type: 'submit', round: 1, word: 'Cats' });
  expect(() => game.act('a', { type: 'submit', round: 1, word: 'cats' })).toThrow('already');
  expect(() => game.act('a', { type: 'submit', round: 1, word: 'cab' })).toThrow('isn’t on the grid');
  expect(() => game.act('a', { type: 'submit', round: 1, word: 'tsr' })).toThrow();
  expect(() => game.act('a', { type: 'submit', round: 1, word: 'ca' })).toThrow('at least 3');
  expect(() => game.act('a', { type: 'submit', round: 2, word: 'dog' })).toThrow('Time is up');
  expect(game.view('a').myWords).toEqual(['cats']);
  expect(game.view('b').myWords).toEqual([]);
  expect(game.view('b').players[0].wordCount).toBe(1);
  game.act('a', { type: 'remove', round: 1, word: 'cats' });
  expect(game.view('a').myWords).toEqual([]);
});

it('scores only words nobody else found, then plays the next grid', () => {
  const t = setup();
  t.game.act('a', { type: 'submit', round: 1, word: 'cats' });
  t.game.act('a', { type: 'submit', round: 1, word: 'dog' });
  t.game.act('b', { type: 'submit', round: 1, word: 'dog' });
  t.game.act('b', { type: 'submit', round: 1, word: 'care' });
  expect(t.game.view().results).toEqual([]);
  t.advance(180_000);
  const view = t.game.view();
  expect(view.phase).toBe('reveal');
  expect(view.results.find(({ word }) => word === 'dog')).toMatchObject({ points: 0, playerIds: ['a', 'b'] });
  expect(view.players.map(({ roundScore }) => roundScore)).toEqual([1, 1]);
  expect(view.missed.length).toBeGreaterThan(0);
  t.advance(15_000);
  expect(t.game.view()).toMatchObject({ phase: 'playing', round: 2, myWords: [] });
});

it('ends a round early when everyone is done and shares a tied win', () => {
  const t = setup();
  t.game.act('a', { type: 'done', round: 1, done: true });
  expect(t.game.view().phase).toBe('playing');
  t.game.act('b', { type: 'done', round: 1, done: true });
  expect(t.game.view().phase).toBe('reveal');
  t.advance(15_000);
  t.game.act('a', { type: 'done', round: 2, done: true });
  t.game.remove('b');
  t.advance(15_000);
  expect(t.game.view()).toMatchObject({ phase: 'game-over', winnerIds: ['a', 'b'] });
});

it('lets bots find words over the round', () => {
  let clock = 0;
  const game = new BoggleEngine([{ id: 'a', name: 'Alex', bot: false }, { id: 'bot', name: 'Bot', bot: true }], () => 0, () => clock);
  game.rig(GRID);
  expect(game.view().players[1].wordCount).toBe(0);
  clock = 180_000;
  game.advance();
  expect(game.view().players[1].wordCount).toBeGreaterThan(0);
  expect(game.view().players[1].roundScore).toBeGreaterThan(0);
});
