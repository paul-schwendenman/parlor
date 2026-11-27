import { describe, it, expect, vi } from 'vitest';
import { rollAllDice, getWhiteSum, getColoredCombos } from '../dice.js';

describe('rollAllDice', () => {
  it('returns dice values between 1 and 6', () => {
    const dice = rollAllDice([]);
    expect(dice.white1).toBeGreaterThanOrEqual(1);
    expect(dice.white1).toBeLessThanOrEqual(6);
    expect(dice.white2).toBeGreaterThanOrEqual(1);
    expect(dice.white2).toBeLessThanOrEqual(6);
    expect(dice.red).toBeGreaterThanOrEqual(1);
    expect(dice.red).toBeLessThanOrEqual(6);
    expect(dice.yellow).toBeGreaterThanOrEqual(1);
    expect(dice.yellow).toBeLessThanOrEqual(6);
    expect(dice.green).toBeGreaterThanOrEqual(1);
    expect(dice.green).toBeLessThanOrEqual(6);
    expect(dice.blue).toBeGreaterThanOrEqual(1);
    expect(dice.blue).toBeLessThanOrEqual(6);
    expect(dice.rolled).toBe(true);
  });

  it('sets removed dice to 0', () => {
    const dice = rollAllDice(['red', 'blue']);
    expect(dice.red).toBe(0);
    expect(dice.blue).toBe(0);
    expect(dice.white1).toBeGreaterThanOrEqual(1);
    expect(dice.green).toBeGreaterThanOrEqual(1);
  });

  it('uses the injected source only for dice still in play', () => {
    const randomInt = vi.fn<(max: number) => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(2);

    expect(rollAllDice(['red', 'blue'], randomInt)).toEqual({
      white1: 1, white2: 6, red: 0, yellow: 4, green: 3, blue: 0, rolled: true,
    });
    expect(randomInt.mock.calls).toEqual([[6], [6], [6], [6]]);
  });
});

describe('getWhiteSum', () => {
  it('returns sum of white dice', () => {
    expect(getWhiteSum({ white1: 3, white2: 4, red: 1, yellow: 2, green: 3, blue: 4, rolled: true })).toBe(7);
  });
});

describe('getColoredCombos', () => {
  it('returns all possible combos with available colored dice', () => {
    const dice = { white1: 3, white2: 4, red: 5, yellow: 2, green: 3, blue: 4, rolled: true };
    const combos = getColoredCombos(dice, []);
    // 4 colors x 2 whites = 8 combos
    expect(combos).toHaveLength(8);
  });

  it('excludes removed dice', () => {
    const dice = { white1: 3, white2: 4, red: 5, yellow: 2, green: 3, blue: 4, rolled: true };
    const combos = getColoredCombos(dice, ['red', 'blue']);
    // 2 colors x 2 whites = 4 combos
    expect(combos).toHaveLength(4);
  });
});
