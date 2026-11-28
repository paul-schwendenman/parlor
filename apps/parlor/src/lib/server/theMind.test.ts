import { expect, it } from 'vitest';
import { TheMindEngine } from '../../../../../games/the-mind/src/engine.js';
import { nextReward } from '../../../../../games/the-mind/src/rules.js';

const humans = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot: false }));

function setup(count = 2, settleMs = 150) {
  let clock = 1000;
  let seed = 4;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  const game = new TheMindEngine(humans(count), random, () => clock, { settleMs });
  return {
    game,
    advance(ms: number) { clock += ms; game.tick(); },
    readyAll() {
      for (let i = 0; i < count; i++) game.act(`p${i}`, { type: 'ready', ready: true });
      clock += 1200;
      game.tick();
    },
    hand: (id: string) => game.view(id).myHand,
  };
}

it('sets levels and lives by player count and deals the level number each', () => {
  for (const [count, levels] of [[2, 12], [3, 10], [4, 8]]) {
    const { game } = setup(count);
    expect(game.view()).toMatchObject({ totalLevels: levels, lives: count, stars: 1, level: 1 });
    expect(game.view('p0').myHand).toHaveLength(1);
    expect(game.view().myHand).toEqual([]);
  }
  expect(nextReward(1, 12)).toEqual({ level: 2, reward: 'star' });
});

it('waits for everyone to focus, then a short breath, before plays count', () => {
  const t = setup();
  t.game.act('p0', { type: 'ready', ready: true });
  expect(t.game.currentPhase).toBe('focus');
  expect(() => t.game.act('p0', { type: 'play', card: t.hand('p0')[0] })).toThrow('stopped');
  t.game.act('p1', { type: 'ready', ready: true });
  expect(t.game.currentPhase).toBe('breath');
  t.advance(1199);
  expect(t.game.currentPhase).toBe('breath');
  t.advance(1);
  expect(t.game.currentPhase).toBe('playing');
});

it('lands a correct play at once and clears the level', () => {
  const t = setup();
  t.readyAll();
  const [low, high] = [t.hand('p0')[0], t.hand('p1')[0]].sort((a, b) => a - b);
  const lowId = t.hand('p0')[0] === low ? 'p0' : 'p1';
  const highId = lowId === 'p0' ? 'p1' : 'p0';
  expect(() => t.game.act(lowId, { type: 'play', card: low + 1 })).toThrow('lowest');
  t.game.act(lowId, { type: 'play', card: low });
  expect(t.game.view().pile).toMatchObject({ top: low, count: 1 });
  t.game.act(highId, { type: 'play', card: high });
  expect(t.game.view()).toMatchObject({ phase: 'level-complete', lastEvent: { kind: 'level-complete', level: 1, reward: null } });
  t.advance(3500);
  expect(t.game.view()).toMatchObject({ phase: 'focus', level: 2 });
  expect(t.hand('p0')).toHaveLength(2);
});

it('gives a lower card a short window to land before calling a mistake', () => {
  const rescue = setup();
  rescue.readyAll();
  const [low, high] = [rescue.hand('p0')[0], rescue.hand('p1')[0]].sort((a, b) => a - b);
  const lowId = rescue.hand('p0')[0] === low ? 'p0' : 'p1';
  const highId = lowId === 'p0' ? 'p1' : 'p0';
  rescue.game.act(highId, { type: 'play', card: high });
  expect(rescue.game.view(highId).myInFlight).toEqual([high]);
  expect(rescue.game.view(lowId).myInFlight).toEqual([]);
  expect(rescue.game.view(lowId).players.find(({ id }) => id === highId)?.cardCount).toBe(1);
  rescue.advance(100);
  rescue.game.act(lowId, { type: 'play', card: low });
  expect(rescue.game.view()).toMatchObject({ phase: 'level-complete', lives: 2 });

  const late = setup();
  late.readyAll();
  late.game.act(highId, { type: 'play', card: high });
  late.advance(200);
  expect(late.game.view()).toMatchObject({ phase: 'mistake', lives: 1, lastEvent: { kind: 'mistake', card: high, discarded: [{ playerId: lowId, cards: [low] }] } });
  late.advance(3000);
  // The mistake emptied every hand, so the level still counts.
  expect(late.game.view()).toMatchObject({ phase: 'level-complete' });
});

it('loses on the last life', () => {
  const t = setup(2, 0);
  for (let level = 0; level < 2; level++) {
    t.readyAll();
    const lowest = Math.min(...['p0', 'p1'].flatMap((id) => t.hand(id)));
    // Play someone's lowest card while a lower card is still held.
    const offender = ['p0', 'p1'].find((id) => t.hand(id)[0] > lowest)!;
    t.game.act(offender, { type: 'play', card: t.hand(offender)[0] });
    expect(t.game.view().phase).toBe('mistake');
    t.advance(3000);
    if (t.game.view().phase === 'level-complete') t.advance(3500);
  }
  expect(t.game.view()).toMatchObject({ phase: 'game-over', outcome: 'lost', lives: 0 });
});

it('needs everyone to agree to a throwing star', () => {
  const t = setup(3);
  t.game.act('p0', { type: 'propose-star' });
  expect(t.game.view('p1')).toMatchObject({ phase: 'star-vote', canVote: true });
  t.game.act('p1', { type: 'vote-star', agree: false });
  expect(t.game.view()).toMatchObject({ phase: 'focus', stars: 1, lastEvent: { kind: 'star-declined', byId: 'p1' } });
  t.game.act('p2', { type: 'propose-star' });
  t.game.act('p0', { type: 'vote-star', agree: true });
  t.game.act('p1', { type: 'vote-star', agree: true });
  expect(t.game.view()).toMatchObject({ phase: 'star-reveal', stars: 0, lastEvent: { kind: 'star' } });
  t.advance(2500);
  // Level 1 had one card each, so the star cleared it.
  expect(t.game.view().phase).toBe('level-complete');
  t.advance(3500);
  expect(() => t.game.act('p0', { type: 'propose-star' })).toThrow('no throwing stars');
});

it('pauses for a dropped player, lets a removed player be stood in, and plays bots on the clock', () => {
  const t = setup(3);
  t.readyAll();
  t.game.setConnected('p1', false);
  expect(t.game.view()).toMatchObject({ phase: 'focus', lastEvent: { kind: 'paused', waitingForId: 'p1' } });
  t.game.act('p0', { type: 'ready', ready: true });
  t.game.act('p2', { type: 'ready', ready: true });
  expect(t.game.currentPhase).toBe('focus');
  t.game.remove('p1');
  expect(t.game.currentPhase).toBe('breath');
  t.advance(1200);
  const deadline = t.game.nextDeadline();
  expect(deadline).not.toBeNull();
  t.game.setConnected('p0', false);
  expect(t.game.currentPhase).toBe('focus');
});

it('finishes a game with one human and bots following the clock', () => {
  let clock = 0;
  let seed = 7;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  const game = new TheMindEngine([{ id: 'h', name: 'H', bot: false }, { id: 'b1', name: 'B1', bot: true }, { id: 'b2', name: 'B2', bot: true }], random, () => clock);
  for (let step = 0; step < 5000 && !game.gameOver; step++) {
    const view = game.view('h');
    if (view.canReady && !view.players[0].ready) { game.act('h', { type: 'ready', ready: true }); continue; }
    // The human plays as soon as no bot holds a lower card.
    const botLowest = Math.min(...['b1', 'b2'].flatMap((id) => game.view(id).myHand));
    if (view.canPlay && view.nextCard! < botLowest) { game.act('h', { type: 'play', card: view.nextCard! }); continue; }
    const due = game.nextDeadline();
    if (due === null) break;
    clock = Math.max(clock, due);
    game.tick();
  }
  expect(game.gameOver).toBe(true);
  expect(['won', 'lost']).toContain(game.view().outcome);
  game.setConnected('h', false);
  expect(game.nextDeadline()).toBeNull();
});
