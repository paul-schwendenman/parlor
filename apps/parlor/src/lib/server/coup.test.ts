import { expect, it } from 'vitest';
import { CoupEngine } from '../../../../../games/coup/src/engine.js';
import type { CoupActionMsg } from '../../../../../games/coup/src/types.js';

const three = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), bot: false }));

function setup(hands: Record<string, ('duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa')[]>, coins: Record<string, number> = {}) {
  let clock = 0;
  const game = new CoupEngine(three, () => 0, {}, () => clock);
  game.rig({ hands, coins: { a: 2, b: 2, c: 2, ...coins }, deck: ['duke', 'captain', 'contessa'], active: 'a' });
  return { game, wait(ms: number) { clock += ms; return game.expire(); } };
}

function rejects(game: CoupEngine, id: string, action: CoupActionMsg, message?: string) {
  const before = JSON.stringify(['a', 'b', 'c', undefined].map((viewer) => game.view(viewer)));
  expect(() => game.act(id, action)).toThrow(message);
  expect(JSON.stringify(['a', 'b', 'c', undefined].map((viewer) => game.view(viewer)))).toBe(before);
}

const window = (game: CoupEngine) => game.view().window!.id;

it('deals two cards and two coins, with one coin for the first of two players', () => {
  const game = new CoupEngine(three.slice(0, 2), () => 0);
  expect(game.view()).toMatchObject({ deckCount: 11, players: [{ coins: 1, hiddenCount: 2 }, { coins: 2 }] });
  expect(game.view('a').me!.hand).toHaveLength(2);
  expect(JSON.stringify(game.view('b').players)).not.toContain('"character"');
  expect(() => new CoupEngine(three.slice(0, 1))).toThrow();
});

it('checks turns, costs, targets, and the forced coup', () => {
  const { game } = setup({ a: ['duke', 'captain'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] });
  rejects(game, 'b', { type: 'declare', action: 'income' }, 'not your turn');
  rejects(game, 'a', { type: 'declare', action: 'coup', targetId: 'b' }, '7 coins');
  rejects(game, 'a', { type: 'declare', action: 'steal', targetId: 'a' }, 'still in');
  game.act('a', { type: 'declare', action: 'income' });
  expect(game.view()).toMatchObject({ actorId: 'b', players: [{ coins: 3 }, {}, {}] });

  const rich = setup({ a: ['duke', 'captain'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] }, { a: 10 });
  expect(rich.game.view('a').me).toMatchObject({ mustCoup: true, actions: [{ action: 'coup' }] });
  rejects(rich.game, 'a', { type: 'declare', action: 'income' }, 'must Coup');
  rich.game.act('a', { type: 'declare', action: 'coup', targetId: 'b' });
  expect(rich.game.view()).toMatchObject({ phase: 'expose', awaitingId: 'b', players: [{ coins: 3 }, {}, {}] });
  rich.game.act('b', { type: 'expose', index: 1 });
  expect(rich.game.view().players[1]).toMatchObject({ hiddenCount: 1, exposed: ['duke'] });
});

it('lets anyone challenge a claim, and the loser of the challenge gives up a card', () => {
  // A bluffs Duke and C calls it.
  const bluff = setup({ a: ['captain', 'contessa'], b: ['duke', 'duke'], c: ['assassin', 'ambassador'] });
  bluff.game.act('a', { type: 'declare', action: 'tax' });
  expect(bluff.game.view('b').me!.respond).toEqual({ challenge: true, blocks: [] });
  bluff.game.act('c', { type: 'challenge', windowId: window(bluff.game) });
  rejects(bluff.game, 'b', { type: 'pass', windowId: 1 }, 'Too late');
  expect(bluff.game.view('a').me).toMatchObject({ canProve: false, canExpose: true });
  bluff.game.act('a', { type: 'expose', index: 0 });
  bluff.game.advanceReveal();
  expect(bluff.game.view()).toMatchObject({ actorId: 'b', players: [{ coins: 2, exposed: ['captain'] }, {}, {}] });

  // A really holds the Duke: C loses a card, A draws a new one and gets the coins.
  const honest = setup({ a: ['duke', 'contessa'], b: ['captain', 'captain'], c: ['assassin', 'ambassador'] });
  honest.game.act('a', { type: 'declare', action: 'tax' });
  honest.game.act('c', { type: 'challenge', windowId: window(honest.game) });
  honest.game.act('a', { type: 'prove' });
  expect(honest.game.view().reveal).toMatchObject({ proved: true, shown: 'duke' });
  honest.game.advanceReveal();
  expect(honest.game.view()).toMatchObject({ phase: 'expose', awaitingId: 'c' });
  honest.game.act('c', { type: 'expose', index: 1 });
  expect(honest.game.view()).toMatchObject({ actorId: 'b', players: [{ coins: 5, hiddenCount: 2 }, {}, { exposed: ['ambassador'] }] });
});

it('runs the block window after the challenge window and lets a block be challenged', () => {
  const t = setup({ a: ['captain', 'duke'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] }, { b: 5 });
  t.game.act('a', { type: 'declare', action: 'steal', targetId: 'b' });
  const challengeWindow = window(t.game);
  t.game.act('b', { type: 'pass', windowId: challengeWindow });
  t.game.act('c', { type: 'pass', windowId: challengeWindow });
  expect(t.game.view('b').me!.respond).toEqual({ challenge: false, blocks: [{ character: 'captain', bluff: true }, { character: 'ambassador', bluff: true }] });
  expect(t.game.view('c').me!.respond).toBeNull();
  t.game.act('b', { type: 'block', windowId: window(t.game), character: 'ambassador' });
  expect(t.game.view().phase).toBe('challenge-block');
  t.game.act('a', { type: 'challenge', windowId: window(t.game) });
  t.game.act('b', { type: 'expose', index: 0 });
  t.game.advanceReveal();
  // The block failed, so the steal happens.
  expect(t.game.view().players.map(({ coins }) => coins)).toEqual([4, 3, 2]);
});

it('closes a window when time runs out, and refunds a failed Assassin claim', () => {
  const t = setup({ a: ['captain', 'duke'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] }, { a: 3 });
  t.game.act('a', { type: 'declare', action: 'assassinate', targetId: 'c' });
  expect(t.game.view().players[0].coins).toBe(0);
  expect(t.wait(15000)).toBe(false);
  expect(t.wait(600)).toBe(true);
  expect(t.game.view()).toMatchObject({ phase: 'block', window: { eligibleIds: ['c'] } });
  t.game.act('c', { type: 'pass', windowId: window(t.game) });
  expect(t.game.view()).toMatchObject({ phase: 'expose', awaitingId: 'c' });

  const refund = setup({ a: ['captain', 'duke'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] }, { a: 3 });
  refund.game.act('a', { type: 'declare', action: 'assassinate', targetId: 'c' });
  refund.game.act('b', { type: 'challenge', windowId: window(refund.game) });
  refund.game.act('a', { type: 'expose', index: 0 });
  refund.game.advanceReveal();
  expect(refund.game.view().players[0].coins).toBe(3);
});

it('exchanges with the deck, keeping as many cards as are hidden', () => {
  const t = setup({ a: ['ambassador', 'contessa'], b: ['captain', 'duke'], c: ['assassin', 'duke'] });
  t.game.act('a', { type: 'declare', action: 'exchange' });
  t.wait(16000);
  const options = t.game.view('a').me!.exchangeOptions!;
  expect(options).toHaveLength(4);
  expect(t.game.view('b').me!.exchangeOptions).toBeNull();
  rejects(t.game, 'a', { type: 'keep', indices: [0] }, 'Keep exactly 2');
  t.game.act('a', { type: 'keep', indices: [0, 1] });
  expect(t.game.view('a').me!.hand.map(({ character }) => character)).toEqual(options.slice(0, 2));
  expect(t.game.view().deckCount).toBe(3);
});

it('ends when one player is left, and a removed player is out', () => {
  const t = setup({ a: ['duke', 'captain'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] }, { a: 7 });
  t.game.removePlayer('c');
  expect(t.game.view()).toMatchObject({ outOrder: ['c'], players: [{}, {}, { out: true, exposed: ['assassin', 'ambassador'] }] });
  t.game.act('a', { type: 'declare', action: 'coup', targetId: 'b' });
  t.game.act('b', { type: 'expose', index: 0 });
  t.game.act('b', { type: 'declare', action: 'income' });
  t.game.removePlayer('b');
  expect(t.game.view()).toMatchObject({ phase: 'game-over', winnerId: 'a' });
});

it('plays seeded bot games to the end', () => {
  let seed = 21;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  for (const count of [2, 3, 4, 5, 6]) {
    for (let run = 0; run < 10; run++) {
      const game = new CoupEngine(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: true })), random);
      for (let step = 0; step < 3000 && game.currentPhase !== 'game-over'; step++) {
        if (game.revealing) game.advanceReveal();
        else game.automaticMove()!();
      }
      const view = game.view();
      expect(view.phase).toBe('game-over');
      expect(view.players.filter(({ out }) => !out).map(({ id }) => id)).toEqual([view.winnerId]);
    }
  }
});

it('stands in honestly for a dropped player', () => {
  const t = setup({ a: ['duke', 'captain'], b: ['contessa', 'duke'], c: ['assassin', 'ambassador'] });
  t.game.setConnected('a', false);
  t.game.automaticMove()!();
  // Holding the Duke, the stand-in takes Tax; everyone else is human and present.
  expect(t.game.view()).toMatchObject({ phase: 'challenge-action', pending: { action: 'tax' } });
  expect(t.game.automaticMove()).toBeUndefined();
  t.game.setConnected('b', false);
  t.game.automaticMove()!();
  expect(t.game.view().window!.passedIds).toEqual(['b']);
});
