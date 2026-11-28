import { expect, it } from 'vitest';
import { CipherPostEngine } from '../../../../../games/cipher-post/src/engine.js';

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id, bot: false }));

it('keeps choices private and scores a correct guess against only its target', () => {
  const game = new CipherPostEngine(players, (max) => max - 1);
  const dealt = players.map(({ id }) => game.view(id).hand);
  expect(() => game.act('a', { type: 'pass', round: 1, sealId: dealt[1][0].id })).toThrow();
  game.act('a', { type: 'pass', round: 1, sealId: dealt[0][0].id });
  expect(game.view('a').choice).toBe(dealt[0][0].id);
  expect(game.view('b').choice).toBeNull();
  expect(game.view()).toMatchObject({ hand: [], sent: null, choice: null, results: [] });
  for (const index of [1, 2]) {
    game.act(players[index].id, { type: 'pass', round: 1, sealId: dealt[index][0].id });
  }
  expect(game.view('b').hand).toContainEqual(dealt[0][0]);
  expect(game.view('a').sent).toEqual({ face: dealt[0][0].face, to: 'b' });
  expect(game.view('b').sent).toEqual({ face: dealt[1][0].face, to: 'c' });
  for (const [index, { id }] of players.entries()) {
    game.act(id, { type: 'expose', round: 1, sealId: dealt[index][1].id });
  }
  expect(game.view()).toMatchObject({ phase: 'guess', hand: [], results: [] });
  expect(() => game.act('a', { type: 'guess', round: 1, target: 'a', face: 1 })).toThrow();
  game.act('a', { type: 'guess', round: 1, target: 'b', face: 1 });
  expect(game.view('b').myGuess).toBeNull();
  game.act('b', { type: 'guess', round: 1, target: 'c', face: 6 });
  game.act('c', { type: 'guess', round: 1, target: 'a', face: 6 });
  expect(game.view().results.map(({ points }) => points)).toEqual([6, 0, 1]);
  expect(game.view().results[1]).toMatchObject({ guessed: true, sealed: 1, right: false });
  game.advanceReveal();
  expect(game.view('a')).toMatchObject({ round: 2, phase: 'pass', sentTo: 'c', sent: null, results: [] });
});

it('completes four rounds with six bots', () => {
  const game = new CipherPostEngine(Array.from({ length: 6 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), () => 0);
  for (let step = 0; step < 85 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  expect(game.view()).toMatchObject({ phase: 'game-over', round: 4 });
  expect(game.view().winnerIds.length).toBeGreaterThan(0);
});
