import { expect, it } from 'vitest';
import { CantStopEngine } from '../../../../../games/cant-stop/src/engine.js';
import { chooseMove, shouldStop } from '../../../../../games/cant-stop/src/bot.js';
import { legalMoves, pairingOptions, tryPlace, type Board } from '../../../../../games/cant-stop/src/rules.js';

const players = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];
const board = (partial: Partial<Board> = {}): Board => ({ runners: {}, markers: {}, claimed: {}, ...partial });

/** Seat 0 starts; then each roll reads four scripted dice. */
function scripted(...dice: number[]) {
  const queue = [...dice];
  return new CantStopEngine(players, (max) => max === 6 ? queue.shift()! - 1 : 0);
}

it('splits four dice into three pairings and deduplicates moves', () => {
  expect(pairingOptions([1, 2, 3, 6], board()).map(({ sums }) => sums)).toEqual([[3, 9], [4, 8], [7, 5]]);
  expect(legalMoves([1, 1, 6, 6], board())).toEqual([[2, 12], [7, 7]]);
});

it('makes you use both sums when they fit and choose one when only one runner is left', () => {
  expect(pairingOptions([2, 2, 4, 5], board({ runners: { 5: 1, 7: 1 } }))[0].moves).toEqual([[4], [9]]);
  expect(pairingOptions([3, 4, 4, 5], board({ runners: { 7: 1, 5: 1 } }))[0].moves).toEqual([[7, 9]]);
  expect(pairingOptions([3, 3, 3, 3], board({ runners: { 7: 1, 5: 1 } }))[0].moves).toEqual([[6, 6]]);
  expect(pairingOptions([2, 2, 2, 2], board({ runners: { 4: 6 } }))[0].moves).toEqual([[4]]);
  expect(pairingOptions([1, 1, 4, 5], board({ claimed: { 2: 'b' } }))[0]).toMatchObject({ moves: [[9]] });
  expect(pairingOptions([1, 1, 1, 1], board({ claimed: { 2: 'a' } }))[0]).toMatchObject({ moves: [], reason: '2 is claimed' });
});

it('enters a new runner one space above your marker', () => {
  expect(tryPlace([9], board({ markers: { 9: 3 } }))).toEqual({ 9: 4 });
});

it('rejects bad moves without changing state', () => {
  const game = scripted(1, 1, 6, 6);
  const before = JSON.stringify(game.view('a'));
  expect(() => game.act('b', { type: 'roll' })).toThrow('not your turn');
  expect(() => game.act('a', { type: 'stop' })).toThrow();
  expect(() => game.act('a', { type: 'place', columns: [2, 12] })).toThrow();
  expect(JSON.stringify(game.view('a'))).toBe(before);
  game.act('a', { type: 'roll' });
  const rolled = JSON.stringify(game.view('a'));
  expect(() => game.act('a', { type: 'stop' })).toThrow();
  expect(() => game.act('a', { type: 'roll' })).toThrow();
  expect(() => game.act('a', { type: 'place', columns: [2] })).toThrow('not available');
  expect(JSON.stringify(game.view('a'))).toBe(rolled);
});

it('claims a column on stop, removes rival markers, and loses unstopped climbs on a bust', () => {
  const game = scripted(
    1, 1, 4, 5, // Alex: 2 and 9, then stops.
    1, 1, 1, 1, // Blair: 2 twice, then stops on space 2.
    1, 1, 1, 1, // Alex: 2 twice reaches the top, then stops and claims it.
    3, 4, 3, 4, // Blair: 7 twice, stops.
    1, 1, 1, 1, // Alex: only 2s, which are claimed: bust.
  );
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'place', columns: [2, 9] });
  game.act('a', { type: 'stop' });
  game.act('b', { type: 'roll' });
  game.act('b', { type: 'place', columns: [2, 2] });
  game.act('b', { type: 'stop' });
  expect(game.view().players[1].markers).toEqual({ 2: 2 });
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'place', columns: [2, 2] });
  expect(game.view().runners).toEqual({ 2: 3 });
  game.act('a', { type: 'stop' });
  let view = game.view();
  expect(view.claimedBy).toEqual({ 2: 'a' });
  expect(view.players.map(({ markers }) => markers)).toEqual([{ 9: 1 }, {}]);
  expect(view).toMatchObject({ phase: 'first-roll', activePlayerId: 'b', dice: null, runners: {} });
  game.act('b', { type: 'roll' });
  game.act('b', { type: 'place', columns: [7, 7] });
  game.act('b', { type: 'stop' });
  game.act('a', { type: 'roll' });
  view = game.view();
  expect(view.phase).toBe('busted');
  expect(view.pairings!.every(({ moves }) => !moves.length)).toBe(true);
  game.advanceReveal();
  expect(game.view()).toMatchObject({ phase: 'first-roll', activePlayerId: 'b', runners: {} });
});

it('wins on the third claimed column', () => {
  const game = new CantStopEngine(players, (max) => max === 6 ? 0 : 0, { goal: 1 });
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'place', columns: [2, 2] });
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'place', columns: [2] });
  expect(game.view()).toMatchObject({ stopWins: true, certainBust: false });
  game.act('a', { type: 'stop' });
  expect(game.view()).toMatchObject({ phase: 'game-over', winnerId: 'a', activePlayerId: null });
  expect(() => game.act('b', { type: 'roll' })).toThrow('over');
});

it('only lets the connected active human act, and a stand-in banks at once', () => {
  const game = scripted(3, 4, 3, 4);
  expect(game.view('a').canAct).toBe(true);
  expect(game.view('b').canAct).toBe(false);
  expect({ ...game.view(), canAct: true }).toEqual(game.view('a'));
  game.setConnected('a', false);
  game.automaticMove()!();
  game.automaticMove()!();
  game.automaticMove()!();
  expect(game.view()).toMatchObject({ activePlayerId: 'b', players: [{ markers: { 7: 2 } }, {}] });
  game.setConnected('b', false);
  expect(game.automaticMove()).toBeUndefined();
});

it('bot takes a summit when it can and stops on it', () => {
  const near = board({ runners: { 7: 1 }, markers: { 2: 2 } });
  expect(chooseMove([[2], [7, 7]], near)).toEqual([2]);
  expect(shouldStop(board({ runners: { 2: 3 } }), false)).toBe(true);
  expect(shouldStop(board({ runners: { 7: 1 } }), false)).toBe(false);
});

it('plays seeded bot games to the end', () => {
  for (let run = 0; run < 20; run++) {
    let seed = run * 7919 + 1;
    const count = 2 + (run % 3);
    const game = new CantStopEngine(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })), (max) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor(seed / 0x100000000 * max);
    });
    let steps = 0;
    while (game.currentPhase !== 'game-over' && steps++ < 4000) {
      if (game.revealing) game.advanceReveal();
      else (game.automaticMove() ?? (() => { throw new Error('stalled'); }))();
    }
    expect(game.view().winnerId).not.toBeNull();
  }
});
