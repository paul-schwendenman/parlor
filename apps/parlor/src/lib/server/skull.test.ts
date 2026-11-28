import { expect, it } from 'vitest';
import { SkullEngine } from '../../../../../games/skull/src/engine.js';
import type { SkullAction, SkullView } from '../../../../../games/skull/src/types.js';

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), bot: false }));
const first = (max: number) => max === 100 ? 99 : 0;

function rejects(game: SkullEngine, id: string, action: SkullAction, message?: string) {
  const before = JSON.stringify([game.view(), game.view('a'), game.view('b'), game.view('c')]);
  expect(() => game.act(id, action)).toThrow(message);
  expect(JSON.stringify([game.view(), game.view('a'), game.view('b'), game.view('c')])).toBe(before);
}

function ante(game: SkullEngine, discs: Record<string, 'flower' | 'skull'>) {
  for (const [id, disc] of Object.entries(discs)) game.act(id, { type: 'ante', disc });
}

const secret = (view: SkullView) => JSON.stringify({ ...view, myHand: [], myStack: [], penalty: null });

it('requires 3 to 6 players and deals three flowers and a skull', () => {
  expect(() => new SkullEngine(players.slice(0, 2))).toThrow();
  const game = new SkullEngine(players, first);
  expect(game.view('a').myHand).toEqual(['flower', 'flower', 'flower', 'skull']);
  expect(game.view().myHand).toEqual([]);
});

it('antes simultaneously and keeps placed discs private', () => {
  const game = new SkullEngine(players, first);
  game.act('b', { type: 'ante', disc: 'skull' });
  rejects(game, 'b', { type: 'ante', disc: 'flower' }, 'already');
  expect(game.view('b').myStack).toEqual(['skull']);
  expect(secret(game.view('a'))).not.toContain('skull"]');
  expect(game.view().players.map(({ anted }) => anted)).toEqual([false, true, false]);
  game.act('a', { type: 'ante', disc: 'flower' });
  expect(game.currentPhase).toBe('ante');
  game.act('c', { type: 'ante', disc: 'flower' });
  expect(game.view()).toMatchObject({ phase: 'placing', activePlayerId: 'a', totalOnMats: 3 });
});

it('places, bids, passes, and makes the high bidder the challenger', () => {
  const game = new SkullEngine(players, first);
  ante(game, { a: 'flower', b: 'flower', c: 'skull' });
  rejects(game, 'b', { type: 'place', disc: 'flower' }, 'not your turn');
  rejects(game, 'a', { type: 'open', amount: 4 });
  game.act('a', { type: 'place', disc: 'flower' });
  game.act('b', { type: 'open', amount: 2 });
  expect(game.view('c')).toMatchObject({ phase: 'bidding', legalBids: [3, 4], canPass: true });
  rejects(game, 'c', { type: 'raise', amount: 2 });
  game.act('c', { type: 'pass' });
  game.act('a', { type: 'raise', amount: 3 });
  game.act('b', { type: 'pass' });
  expect(game.view('a')).toMatchObject({ phase: 'revealing', challengerId: 'a', bid: 3, flipTargets: ['a'] });
  rejects(game, 'a', { type: 'flip', targetId: 'b' }, 'own discs first');
  game.act('a', { type: 'flip', targetId: 'a' });
  game.act('a', { type: 'flip', targetId: 'a' });
  expect(game.view('a').flipTargets).toEqual(['b', 'c']);
  game.act('a', { type: 'flip', targetId: 'b' });
  expect(game.view()).toMatchObject({ phase: 'round-over', result: { success: true, nextStarterId: 'a' } });
  expect(game.view().players[0].points).toBe(1);
  game.advanceReveal();
  expect(game.view()).toMatchObject({ phase: 'ante', round: 2, totalOnMats: 0, flips: [] });
  expect(game.view('a').myHand).toHaveLength(4);
});

it('ends bidding at once on a bid of the total and stops early when the bid is under your stack', () => {
  const game = new SkullEngine(players, first);
  ante(game, { a: 'skull', b: 'flower', c: 'flower' });
  game.act('a', { type: 'place', disc: 'flower' });
  game.act('b', { type: 'place', disc: 'flower' });
  game.act('c', { type: 'open', amount: 1 });
  game.act('a', { type: 'pass' });
  game.act('b', { type: 'pass' });
  game.act('c', { type: 'flip', targetId: 'c' });
  expect(game.view().result).toMatchObject({ success: true, challengerId: 'c' });
  // The skull under A's flower was never shown.
  expect(game.view().flips).toEqual([{ ownerId: 'c', disc: 'flower' }]);
});

it('lets the skull owner pick a blind disc, and hides the lost disc from everyone else', () => {
  const game = new SkullEngine(players, first);
  ante(game, { a: 'flower', b: 'skull', c: 'flower' });
  game.act('a', { type: 'place', disc: 'flower' });
  game.act('b', { type: 'open', amount: 4 });
  expect(game.view()).toMatchObject({ phase: 'revealing', challengerId: 'b' });
  game.act('b', { type: 'flip', targetId: 'b' });
  expect(game.view('b').penalty).toEqual({ kind: 'choose', discs: ['flower', 'flower', 'flower', 'skull'] });
  expect(game.view('a').penalty).toBeNull();
  game.act('b', { type: 'lose-disc', index: 3 });
  expect(game.view('b').myHand).toEqual(['flower', 'flower', 'flower']);
  const views = [game.view(), game.view('a'), game.view('c')].map((view) => JSON.stringify({ ...view, myHand: [], myStack: [], flips: [] }));
  // Only the flipped skull is public; nothing says which disc B lost.
  for (const view of views) expect(view).not.toContain('"skull"');
  expect(game.view().players[1].discCount).toBe(3);

  game.advanceReveal();
  ante(game, { a: 'skull', b: 'flower', c: 'flower' });
  game.act('b', { type: 'place', disc: 'flower' });
  game.act('c', { type: 'open', amount: 3 });
  game.act('a', { type: 'pass' });
  game.act('b', { type: 'pass' });
  game.act('c', { type: 'flip', targetId: 'c' });
  game.act('c', { type: 'flip', targetId: 'a' });
  expect(game.view()).toMatchObject({ phase: 'penalty', activePlayerId: 'a', skullOwnerId: 'a' });
  expect(game.view('a').penalty).toEqual({ kind: 'blind', slots: 4, challengerId: 'c' });
  expect(game.view('c').penalty).toBeNull();
  rejects(game, 'c', { type: 'lose-disc', index: 0 }, 'not your turn');
  game.act('a', { type: 'lose-disc', index: 2 });
  expect(game.view()).toMatchObject({ phase: 'round-over', result: { nextStarterId: 'c', lostDisc: true } });
  expect(game.view().players[2].discCount).toBe(3);
});

it('eliminates a challenger with no discs left and lets them pick the next starter after their own skull', () => {
  const game = new SkullEngine(players, first);
  ante(game, { a: 'flower', b: 'skull', c: 'flower' });
  game.act('a', { type: 'place', disc: 'flower' });
  for (let round = 0; round < 4; round++) {
    game.act('b', { type: 'open', amount: game.view().totalOnMats });
    game.act('b', { type: 'flip', targetId: 'b' });
    if (round === 3) break;
    game.act('b', { type: 'lose-disc', index: 0 });
    expect(game.view('b').myHand).toEqual([...Array<string>(2 - round).fill('flower'), 'skull']);
    game.advanceReveal();
    ante(game, { a: 'flower', b: 'skull', c: 'flower' });
  }
  expect(game.view()).toMatchObject({ phase: 'choose-starter', activePlayerId: 'b', result: { eliminatedId: 'b' } });
  expect(game.view('b').starterChoices).toEqual(['a', 'c']);
  rejects(game, 'b', { type: 'choose-starter', playerId: 'b' }, 'still in');
  rejects(game, 'a', { type: 'choose-starter', playerId: 'a' }, 'not your turn');
  game.act('b', { type: 'choose-starter', playerId: 'c' });
  game.advanceReveal();
  expect(game.view()).toMatchObject({ phase: 'ante', starterId: 'c' });
  expect(game.view('b').canAnte).toBe(false);
  rejects(game, 'b', { type: 'ante', disc: 'skull' }, 'out of this game');
});

it('ends the game for the last player standing and at two points', () => {
  let seed = 5;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  for (let run = 0; run < 60; run++) {
    const count = 3 + (run % 4);
    const game = new SkullEngine(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })), random);
    let steps = 0;
    while (game.currentPhase !== 'game-over' && steps++ < 5000) {
      if (game.revealing) game.advanceReveal();
      else game.automaticMove()!();
    }
    const view = game.view();
    expect(view.phase).toBe('game-over');
    const winner = view.players.find(({ id }) => id === view.winnerId)!;
    expect(winner.points === 2 || view.players.filter(({ eliminated }) => !eliminated).length === 1).toBe(true);
  }
});

it('lets a stand-in act for a dropped seat and pauses with no humans', () => {
  const game = new SkullEngine(players, first);
  game.act('a', { type: 'ante', disc: 'flower' });
  game.setConnected('b', false);
  game.automaticMove()!();
  expect(game.view().players[1].anted).toBe(true);
  expect(game.automaticMove()).toBeUndefined();
  game.setConnected('a', false);
  game.setConnected('c', false);
  expect(game.automaticMove()).toBeUndefined();
});
