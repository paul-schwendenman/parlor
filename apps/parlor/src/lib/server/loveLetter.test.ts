import { expect, it } from 'vitest';
import { LoveLetterEngine } from '../../../../../games/love-letter/src/engine.js';
import { DECKS, guessable, type CardValue } from '../../../../../games/love-letter/src/rules.js';
import type { LoveLetterAction } from '../../../../../games/love-letter/src/types.js';

const three = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), bot: false }));
/** Seat 0 starts; the shuffle keeps deck order. */
const fixed = () => 0;

function game(hands: Record<string, CardValue[]>, deck?: CardValue[]) {
  const engine = new LoveLetterEngine(three, fixed);
  engine.rig(hands, deck);
  return engine;
}

function rejects(engine: LoveLetterEngine, id: string, action: LoveLetterAction, message?: string) {
  const before = JSON.stringify(['a', 'b', 'c', undefined].map((viewer) => engine.view(viewer)));
  expect(() => engine.act(id, action)).toThrow(message);
  expect(JSON.stringify(['a', 'b', 'c', undefined].map((viewer) => engine.view(viewer)))).toBe(before);
}

it('builds both decks, sets cards aside, and draws for the first player', () => {
  expect(DECKS.standard).toHaveLength(21);
  expect(DECKS.classic).toHaveLength(16);
  expect(guessable('standard')).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(guessable('classic')).toEqual([2, 3, 4, 5, 7, 8, 9]);
  const two = new LoveLetterEngine(three.slice(0, 2), fixed);
  expect(two.view()).toMatchObject({ deckCount: 21 - 1 - 3 - 2 - 1, target: 6 });
  expect(two.view().faceUp).toHaveLength(3);
  expect(two.view('a').myHand).toHaveLength(2);
  expect(two.view('b').myHand).toHaveLength(1);
  expect(() => new LoveLetterEngine(Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `${i}`, bot: false })), fixed, { edition: 'classic' })).toThrow();
});

it('forces the Countess and checks targets and guesses', () => {
  const engine = game({ a: [8, 7], b: [3], c: [2] });
  expect(engine.view('a')).toMatchObject({ forcedCountess: true, moves: [{ card: 8, targets: [] }] });
  rejects(engine, 'a', { type: 'play', card: 7, target: 'b' }, 'Countess');
  rejects(engine, 'b', { type: 'play', card: 3, target: 'a' }, 'not your turn');
  engine.act('a', { type: 'play', card: 8 });
  expect(engine.view().activePlayerId).toBe('b');

  const guard = game({ a: [1, 4], b: [3], c: [2] });
  rejects(guard, 'a', { type: 'play', card: 1, target: 'b', guess: 1 }, 'other than the Guard');
  rejects(guard, 'a', { type: 'play', card: 1, target: 'b' }, 'other than the Guard');
  rejects(guard, 'a', { type: 'play', card: 1, target: 'a', guess: 3 }, 'can be picked');
  rejects(guard, 'a', { type: 'play', card: 4, target: 'b' }, 'no effect');
  guard.act('a', { type: 'play', card: 1, target: 'b', guess: 3 });
  expect(guard.view().players[1]).toMatchObject({ out: true, trail: [{ value: 3, how: 'knocked-out' }] });
  expect(guard.view().events[0]).toMatchObject({ guess: 3, hit: true });
});

it('shows the Priest card and Baron comparison only to the players entitled to them', () => {
  const engine = game({ a: [2, 5], b: [7], c: [4] }, [3, 1]);
  engine.act('a', { type: 'play', card: 2, target: 'b' });
  expect(engine.view('a').events[0].seen).toBe(7);
  for (const viewer of ['b', 'c', undefined]) expect(engine.view(viewer).events[0].seen).toBeUndefined();
  expect(engine.view('a').known).toEqual([{ id: 'b', card: 7, source: 'priest' }]);
  // B drew 3 and compares with C (4): B loses.
  engine.act('b', { type: 'play', card: 3, target: 'c' });
  expect(engine.view('b').events[1].compare).toEqual({ mine: 7, theirs: 4 });
  expect(engine.view('c').events[1].compare).toEqual({ mine: 4, theirs: 7 });
  expect(engine.view('a').events[1].compare).toBeUndefined();
  expect(engine.view('a').events[1].baronResult).toBe('win');
  expect(engine.view().players[2].out).toBe(true);
});

it('protects with the Handmaid until the next turn and lets a Prince target only yourself', () => {
  const engine = game({ a: [4, 1], b: [5], c: [6] }, [1, 2, 3]);
  engine.act('a', { type: 'play', card: 4 });
  rejects(engine, 'b', { type: 'play', card: 1, target: 'a', guess: 2 }, 'can be picked');
  engine.act('b', { type: 'play', card: 1, target: 'c', guess: 2 });
  // C drew 2 and holds 6 and 2. Only B can be picked.
  expect(engine.view('c').moves.find(({ card }) => card === 2)?.targets).toEqual(['b']);
  engine.act('c', { type: 'play', card: 2, target: 'b' });
  expect(engine.view('a').players[0].protected).toBe(false);

  const prince = game({ a: [5, 9], b: [4], c: [3] }, [2]);
  expect(prince.view('a').moves.find(({ card }) => card === 5)?.targets).toEqual(['b', 'c', 'a']);
  prince.act('a', { type: 'play', card: 5, target: 'a' });
  expect(prince.view().players[0]).toMatchObject({ out: true, trail: [{ value: 5 }, { value: 9, how: 'discarded' }] });
});

it('returns Chancellor cards to the bottom in the chosen order without shrinking the deck', () => {
  const engine = game({ a: [6, 1], b: [3], c: [2] }, [7, 8]);
  const count = engine.view().deckCount;
  engine.act('a', { type: 'play', card: 6 });
  expect(engine.view('a')).toMatchObject({ phase: 'chancellor', myHand: [1, 7, 8], chancellorReturn: 2 });
  expect(engine.view('b').myHand).toEqual([3]);
  rejects(engine, 'a', { type: 'chancellor', keep: 9, bottom: [1, 7] }, 'Keep one card');
  rejects(engine, 'a', { type: 'chancellor', keep: 8, bottom: [1] }, 'Keep one card');
  engine.act('a', { type: 'chancellor', keep: 8, bottom: [1, 7] });
  // The deck is back to its size, then B draws the top card: 7, since 1 went deepest.
  expect(engine.view()).toMatchObject({ deckCount: count - 1, activePlayerId: 'b' });
  expect(engine.view('a').myHand).toEqual([8]);
  expect(engine.view('b').myHand).toEqual([3, 7]);
});

it('swaps with the King and safely trades the Princess', () => {
  const engine = game({ a: [7, 9], b: [2], c: [3] });
  engine.act('a', { type: 'play', card: 7, target: 'b' });
  expect(engine.view('a').myHand).toEqual([2]);
  expect(engine.view('b').myHand.slice(0, 1)).toEqual([9]);
  expect(engine.view('b').known).toEqual([{ id: 'a', card: 2, source: 'king' }]);
  expect(engine.view().players.every(({ out }) => !out)).toBe(true);
});

it('ends the round on the last player standing, awards the Spy bonus, and starts the next round with the winner', () => {
  const engine = game({ a: [0, 1], b: [3], c: [4] }, [1, 2]);
  engine.act('a', { type: 'play', card: 0 });
  engine.act('b', { type: 'play', card: 1, target: 'c', guess: 4 });
  // C is out. B now holds 3; A draws 2 and holds 1 and 2.
  engine.act('a', { type: 'play', card: 1, target: 'b', guess: 3 });
  expect(engine.view()).toMatchObject({ phase: 'round-over', lastRound: { reason: 'last-standing', winnerIds: ['a'], spyId: 'a' } });
  expect(engine.view().players[0].tokens).toBe(2);
  engine.advanceReveal();
  expect(engine.view()).toMatchObject({ phase: 'turn', round: 2, activePlayerId: 'a' });
});

it('ends after the turn that empties the deck and shares ties', () => {
  const engine = game({ a: [4, 4], b: [7], c: [7] }, []);
  engine.act('a', { type: 'play', card: 4 });
  expect(engine.view()).toMatchObject({ phase: 'round-over', lastRound: { reason: 'deck-empty', winnerIds: ['b', 'c'] } });
});

it('plays seeded bot games to the end at 2, 4 and 6 players', () => {
  let seed = 3;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  for (const count of [2, 4, 6, 3, 5]) {
    for (let run = 0; run < 8; run++) {
      const engine = new LoveLetterEngine(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })), random);
      for (let step = 0; step < 3000 && engine.currentPhase !== 'game-over'; step++) {
        if (engine.revealing) engine.advanceReveal();
        else engine.automaticMove()!();
      }
      const view = engine.view();
      expect(view.phase).toBe('game-over');
      expect(view.winnerIds.length).toBeGreaterThan(0);
      for (const id of view.winnerIds) expect(view.players.find((p) => p.id === id)!.tokens).toBeGreaterThanOrEqual(view.target);
    }
  }
});

it('lets a stand-in play, and ends the game when removals leave one player', () => {
  const engine = game({ a: [4, 2], b: [3], c: [5] });
  engine.setConnected('a', false);
  engine.automaticMove()!();
  expect(engine.view().activePlayerId).toBe('b');
  engine.remove('b');
  expect(engine.view().players[1]).toMatchObject({ left: true, out: true });
  expect(engine.view().activePlayerId).toBe('c');
  engine.remove('c');
  expect(engine.view()).toMatchObject({ phase: 'game-over', winnerIds: ['a'] });
});
