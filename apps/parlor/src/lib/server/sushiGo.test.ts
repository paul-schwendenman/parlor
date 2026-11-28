import { expect, it } from 'vitest';
import { SushiGoEngine } from '../../../../../games/sushi-go/src/engine.js';
import {
  addToPlate, buildDeck, scoreMaki, scorePlate, scorePuddings, type PlateCard, type SushiCard, type SushiFace,
} from '../../../../../games/sushi-go/src/rules.js';

const players = (count: number, bot = false) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot }));
const keepOrder = () => 0;

function plate(...cards: SushiCard[]) {
  const result: PlateCard[] = [];
  cards.forEach((card, turn) => addToPlate(result, card, turn + 1));
  return result;
}

it('builds the 108-card deck and deals by player count', () => {
  const deck = buildDeck();
  expect(deck).toHaveLength(108);
  expect(new Set(deck.map(({ id }) => id)).size).toBe(108);
  expect(deck.filter(({ kind }) => kind === 'maki').length).toBe(26);
  expect(deck.filter(({ kind }) => kind === 'chopsticks').length).toBe(4);
  for (const [count, size] of [[2, 10], [3, 9], [4, 8], [5, 7]]) {
    expect(new SushiGoEngine(players(count), keepOrder).view('p0').myHand).toHaveLength(size);
  }
  expect(() => new SushiGoEngine(players(6))).toThrow();
});

it('scores sets, Wasabi, maki splits and puddings', () => {
  let id = 0;
  const card = (face: SushiFace): SushiCard => ({ ...face, id: id++ });
  const t = () => card({ kind: 'tempura' });
  expect(scorePlate(plate(t(), t(), t())).tempura).toBe(5);
  expect(scorePlate(plate(...Array.from({ length: 6 }, () => card({ kind: 'dumpling' })))).dumpling).toBe(15);
  const nigiriFirst = plate(card({ kind: 'nigiri', value: 3 }), card({ kind: 'wasabi' }), card({ kind: 'nigiri', value: 2 }));
  expect(scorePlate(nigiriFirst).nigiri).toBe(9);
  expect(scoreMaki([5, 5, 2])).toEqual([3, 3, 0]);
  expect(scoreMaki([6, 2, 2, 0])).toEqual([6, 1, 1, 0]);
  expect(scoreMaki([3, 0])).toEqual([6, 0]);
  expect(scorePuddings([3, 1, 1])).toEqual([6, -3, -3]);
  expect(scorePuddings([2, 0])).toEqual([6, 0]);
  expect(scorePuddings([1, 1, 1])).toEqual([0, 0, 0]);
});

it('locks picks in secret, reveals when everyone has picked, and passes left', () => {
  const game = new SushiGoEngine(players(3), keepOrder);
  const hands = ['p0', 'p1', 'p2'].map((id) => game.view(id).myHand);
  game.act('p0', { type: 'pick', cardIds: [hands[0][0].id] });
  expect(game.view('p1').players[0]).toMatchObject({ locked: true, plate: [] });
  expect(game.view('p1').myPick).toBeNull();
  const before = JSON.stringify(game.view('p0'));
  expect(() => game.act('p0', { type: 'pick', cardIds: [hands[0][1].id] })).toThrow('already picked');
  expect(() => game.act('p1', { type: 'pick', cardIds: [hands[0][1].id] })).toThrow('isn’t in your hand');
  expect(() => game.act('p1', { type: 'pick', cardIds: [hands[1][0].id, hands[1][1].id] })).toThrow('chopsticks');
  expect(JSON.stringify(game.view('p0'))).toBe(before);
  game.act('p0', { type: 'unpick' });
  game.act('p0', { type: 'pick', cardIds: [hands[0][1].id] });
  game.act('p1', { type: 'pick', cardIds: [hands[1][0].id] });
  game.act('p2', { type: 'pick', cardIds: [hands[2][0].id] });
  expect(game.view()).toMatchObject({ phase: 'reveal' });
  expect(game.view().players.map(({ plate }) => plate.length)).toEqual([1, 1, 1]);
  expect(() => game.act('p0', { type: 'unpick' })).toThrow('already on the table');
  game.advanceReveal();
  // P1 now holds what P0 passed: P0's hand without the picked card.
  expect(game.view('p1').myHand.map(({ id }) => id)).toEqual(hands[0].filter((_, i) => i !== 1).map(({ id }) => id));
  expect(game.view()).toMatchObject({ phase: 'picking', pick: 2 });
});

it('uses chopsticks from an earlier turn to take two and passes them on', () => {
  const game = new SushiGoEngine(players(2), keepOrder);
  // Find a seat holding chopsticks, or skip if this seed dealt none.
  let seat = ['p0', 'p1'].find((id) => game.view(id).myHand.some(({ kind }) => kind === 'chopsticks'));
  let guard = 0;
  while (!seat && guard++ < 20) {
    const view = game.view();
    if (view.phase !== 'picking') break;
    for (const id of ['p0', 'p1']) game.act(id, { type: 'pick', cardIds: [game.view(id).myHand[0].id] });
    game.advanceReveal();
    seat = ['p0', 'p1'].find((id) => game.view(id).myHand.some(({ kind }) => kind === 'chopsticks'));
  }
  expect(seat).toBeDefined();
  if (!seat) return;
  const other = seat === 'p0' ? 'p1' : 'p0';
  const sticks = game.view(seat).myHand.find(({ kind }) => kind === 'chopsticks')!;
  game.act(seat, { type: 'pick', cardIds: [sticks.id] });
  expect(game.view(seat).canUseChopsticks).toBe(false);
  game.act(other, { type: 'pick', cardIds: [game.view(other).myHand[0].id] });
  game.advanceReveal();
  expect(game.view(seat).myHand.length).toBeGreaterThanOrEqual(2);
  expect(game.view(seat).canUseChopsticks).toBe(true);
  const [a, b] = game.view(seat).myHand;
  const size = game.view(seat).myHand.length;
  game.act(seat, { type: 'pick', cardIds: [a.id, b.id] });
  game.act(other, { type: 'pick', cardIds: [game.view(other).myHand[0].id] });
  const revealed = game.view().players.find(({ id }) => id === seat)!;
  expect(revealed.usedChopsticks).toBe(true);
  expect(revealed.plate.some(({ card }) => card.id === sticks.id)).toBe(false);
  expect(revealed.handCount).toBe(size - 1);
});

it('plays full bot games to the end, scoring puddings and sharing ties', () => {
  let seed = 9;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  for (const count of [2, 3, 4, 5]) {
    const game = new SushiGoEngine(players(count, true), random);
    const dealt = new Set<number>();
    for (let step = 0; step < 2000 && game.currentPhase !== 'game-over'; step++) {
      if (game.currentPhase === 'picking' && game.view().pick === 1 && game.view().players.every(({ locked }) => !locked)) {
        for (const p of game.view().players) for (const id of game.view(p.id).myHand.map((c) => c.id)) {
          expect(dealt.has(id)).toBe(false);
          dealt.add(id);
        }
      }
      if (game.revealing) game.advanceReveal();
      else game.automaticMove()!();
    }
    const view = game.view();
    expect(view.phase).toBe('game-over');
    expect(view.players.every(({ roundScores, puddingScore }) => roundScores.length === 3 && puddingScore !== null)).toBe(true);
    const best = Math.max(...view.players.map(({ total }) => total));
    for (const id of view.winnerIds) expect(view.players.find((p) => p.id === id)!.total).toBe(best);
  }
});

it('lets an absent player’s stand-in pick only after everyone present has picked', () => {
  const game = new SushiGoEngine(players(3), keepOrder);
  game.setConnected('p1', false);
  expect(game.automaticMove()).toBeUndefined();
  game.act('p0', { type: 'pick', cardIds: [game.view('p0').myHand[0].id] });
  expect(game.automaticMove()).toBeUndefined();
  game.act('p2', { type: 'pick', cardIds: [game.view('p2').myHand[0].id] });
  game.automaticMove()!();
  expect(game.view()).toMatchObject({ phase: 'reveal' });
  game.advanceReveal();
  game.act('p0', { type: 'pick', cardIds: [game.view('p0').myHand[0].id] });
  game.act('p2', { type: 'pick', cardIds: [game.view('p2').myHand[0].id] });
  game.automaticMove()!();
  game.setConnected('p0', false);
  game.setConnected('p2', false);
  game.advanceReveal();
  expect(game.automaticMove()).toBeUndefined();
});
