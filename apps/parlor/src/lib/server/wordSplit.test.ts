import { expect, it } from 'vitest';
import { WordSplitEngine } from '../../../../../games/word-split/src/engine.js';

const seats = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }];
const keepOrder = (max: number) => max - 1;

it('keeps lists private, validates tiles and words, and scores words by unique ownership', () => {
  const engine = new WordSplitEngine(seats, keepOrder);
  engine.act('a', { type: 'submit', word: 'ABLE', round: 1 });
  expect(() => engine.act('a', { type: 'submit', word: 'able', round: 1 })).toThrow(/already/);
  expect(() => engine.act('a', { type: 'submit', word: 'babe', round: 1 })).toThrow(/tile/);
  expect(() => engine.act('a', { type: 'submit', word: 'bst', round: 1 })).toThrow(/dictionary/);
  engine.act('a', { type: 'submit', word: 'base', round: 1 });
  engine.act('b', { type: 'submit', word: 'able', round: 1 });
  expect(engine.view('a').myWords).toEqual(['able', 'base']);
  expect(engine.view('b')).toMatchObject({ myWords: ['able'], results: [] });
  expect(engine.view()).toMatchObject({ myWords: [], canWrite: false, results: [] });
  engine.act('a', { type: 'finish', round: 1 });
  expect(() => engine.act('a', { type: 'submit', word: 'bat', round: 1 })).toThrow(/closed/);
  engine.act('b', { type: 'finish', round: 1 });
  expect(engine.view().results).toEqual([
    { word: 'able', playerIds: ['a', 'b'], points: 0 },
    { word: 'base', playerIds: ['a'], points: 4 },
  ]);
  expect(engine.view().players.map(({ score }) => score)).toEqual([4, 0]);
});

it('enforces deadlines, preserves reconnecting lists, and completes three rounds after a removal', () => {
  let now = 0;
  const engine = new WordSplitEngine(seats, keepOrder, () => now);
  engine.act('a', { type: 'submit', word: 'able', round: 1 });
  engine.setConnected('a', false);
  engine.setConnected('a', true);
  expect(engine.view('a').myWords).toEqual(['able']);
  now = engine.deadline;
  expect(() => engine.act('b', { type: 'submit', word: 'base', round: 1 })).toThrow(/closed/);
  engine.advance();
  engine.remove('b');
  now = engine.deadline;
  engine.advance();
  expect(engine.view('a')).toMatchObject({ round: 2, phase: 'writing', myWords: [] });
  expect(() => engine.act('a', { type: 'finish', round: 1 })).toThrow(/closed/);
  engine.act('a', { type: 'finish', round: 2 });
  expect(engine.view().phase).toBe('reveal');
  now = engine.deadline;
  engine.advance();
  engine.act('a', { type: 'finish', round: 3 });
  expect(engine.gameOver).toBe(true);
});
