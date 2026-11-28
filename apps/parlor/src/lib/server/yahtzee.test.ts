import { expect, it } from 'vitest';
import { YahtzeeEngine } from '../../../../../games/yahtzee/src/engine.js';
import { botStep } from '../../../../../games/yahtzee/src/bot.js';
import { baseScore, CATEGORIES, emptyCard, scoreOptions, totals, type Scorecard } from '../../../../../games/yahtzee/src/rules.js';

const players = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];

function scripted(...dice: number[]) {
  const queue = [...dice];
  return new YahtzeeEngine(players, (max) => max === 6 ? queue.shift()! - 1 : 0);
}

function card(values: Partial<Scorecard>): Scorecard {
  return { ...emptyCard(), ...values };
}

it('scores every box', () => {
  expect(baseScore([3, 3, 3, 2, 2], 'fullHouse')).toBe(25);
  expect(baseScore([4, 4, 4, 4, 4], 'fullHouse')).toBe(0);
  expect(baseScore([1, 2, 3, 4, 6], 'smallStraight')).toBe(30);
  expect(baseScore([2, 3, 4, 5, 5], 'smallStraight')).toBe(30);
  expect(baseScore([1, 2, 3, 5, 6], 'smallStraight')).toBe(0);
  expect(baseScore([2, 3, 4, 5, 6], 'largeStraight')).toBe(40);
  expect(baseScore([6, 6, 6, 6, 6], 'fourKind')).toBe(30);
  expect(baseScore([5, 5, 5, 1, 2], 'threeKind')).toBe(18);
  expect(baseScore([5, 5, 2, 1, 2], 'fives')).toBe(10);
  expect(totals(card({ ones: 0, twos: 6, threes: 9, fours: 16, fives: 15, sixes: 18 }), 1))
    .toMatchObject({ upper: 64, upperBonus: 35, total: 199 });
});

it('applies the forced Joker rule and Yahtzee bonus', () => {
  const five = [4, 4, 4, 4, 4];
  let result = scoreOptions(card({ yahtzee: 50 }), five);
  expect(result).toMatchObject({ bonus: true, jokerActive: true, forced: 'fours' });
  expect(result.options.filter(({ legal }) => legal).map(({ category }) => category)).toEqual(['fours']);
  result = scoreOptions(card({ yahtzee: 0, fours: 12 }), five);
  expect(result.bonus).toBe(false);
  expect(result.options.filter(({ legal }) => legal).map(({ category, points }) => [category, points])).toEqual([
    ['threeKind', 20], ['fourKind', 20], ['fullHouse', 25], ['smallStraight', 30], ['largeStraight', 40], ['chance', 20],
  ]);
  result = scoreOptions(card({ yahtzee: 50, fours: 12, threeKind: 1, fourKind: 1, fullHouse: 1, smallStraight: 1, largeStraight: 1, chance: 1 }), five);
  expect(result.options.every(({ legal, points }) => legal && points === 0)).toBe(true);
  // Five alike with the Yahtzee box still empty is ordinary.
  expect(scoreOptions(card({}), five).options.find(({ category }) => category === 'fullHouse')?.points).toBe(0);
});

it('rolls, holds, and rejects bad moves without changing state', () => {
  const game = scripted(1, 2, 3, 4, 6, 5, 5);
  expect(() => game.act('a', { type: 'score', category: 'chance' })).toThrow('Roll first');
  expect(() => game.act('a', { type: 'hold', held: [true, false, false, false, false] })).toThrow('Roll first');
  expect(() => game.act('b', { type: 'roll' })).toThrow('not your turn');
  game.act('a', { type: 'roll' });
  expect(game.view('a')).toMatchObject({ dice: [1, 2, 3, 4, 6], canRoll: true, canScore: true, rollsLeft: 2 });
  expect(game.view('b')).toMatchObject({ canRoll: false, canScore: false });
  game.act('a', { type: 'hold', held: [true, true, true, true, true] });
  const before = JSON.stringify(game.view('a'));
  expect(() => game.act('a', { type: 'roll' })).toThrow('Release');
  expect(JSON.stringify(game.view('a'))).toBe(before);
  game.act('a', { type: 'hold', held: [false, true, true, true, false] });
  game.act('a', { type: 'roll' });
  expect(game.view().dice).toEqual([5, 2, 3, 4, 5]);
  game.act('a', { type: 'score', category: 'smallStraight' });
  expect(game.view()).toMatchObject({ phase: 'scored', lastScore: { points: 30 } });
  expect(() => game.act('a', { type: 'roll' })).toThrow();
  game.advanceReveal();
  expect(game.view()).toMatchObject({ phase: 'turn', activePlayerId: 'b', dice: null, rollsUsed: 0 });
});

it('rejects a filled box and a third reroll', () => {
  const game = scripted(...Array<number>(40).fill(2));
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'score', category: 'yahtzee' });
  game.advanceReveal();
  game.act('b', { type: 'roll' });
  game.act('b', { type: 'score', category: 'twos' });
  game.advanceReveal();
  game.act('a', { type: 'roll' });
  expect(() => game.act('a', { type: 'score', category: 'yahtzee' })).toThrow('already filled');
  expect(() => game.act('a', { type: 'score', category: 'chance' })).toThrow('Twos');
  game.act('a', { type: 'roll' });
  game.act('a', { type: 'roll' });
  expect(() => game.act('a', { type: 'roll' })).toThrow('No rolls left');
  game.act('a', { type: 'score', category: 'twos' });
  expect(game.view().players[0]).toMatchObject({ yahtzeeBonuses: 1, total: 160 });
});

it('plays a full seeded bot game, shares ties, and scores sensibly', () => {
  let seed = 11;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  };
  let total = 0;
  for (let run = 0; run < 6; run++) {
    const game = new YahtzeeEngine([{ id: 'x', name: 'X', bot: true }, { id: 'y', name: 'Y', bot: true }], random);
    for (let step = 0; step < 500 && game.currentPhase !== 'game-over'; step++) {
      if (game.revealing) game.advanceReveal();
      else game.automaticMove()!();
    }
    const view = game.view();
    expect(view.phase).toBe('game-over');
    expect(view.players.every(({ card }) => CATEGORIES.every((c) => card[c] !== null))).toBe(true);
    const best = Math.max(...view.players.map((p) => p.total));
    expect(view.winnerIds).toEqual(view.players.filter((p) => p.total === best).map(({ id }) => id));
    total += view.players.reduce((sum, p) => sum + p.total, 0);
  }
  expect(total / 12).toBeGreaterThan(170);
});

it('lets a stand-in finish a dropped turn and pauses with no humans', () => {
  const game = scripted(...Array<number>(20).fill(3));
  game.setConnected('a', false);
  expect(game.view('a').canRoll).toBe(false);
  game.automaticMove()!();
  game.automaticMove()!();
  expect(game.view().phase).toBe('scored');
  expect(botStep(card({}), [3, 3, 3, 3, 3], 1, { joker: 'forced', yahtzeeBonus: true })).toEqual({ type: 'score', category: 'yahtzee' });
  game.advanceReveal();
  game.setConnected('b', false);
  expect(game.automaticMove()).toBeUndefined();
});
