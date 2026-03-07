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

  it('returns deterministic results with mocked Math.random', () => {
    const mockRandom = vi.spyOn(Math, 'random');
    // Each call: Math.floor(random * 6) + 1
    // random=0 -> 1, random=0.5 -> 4, random=0.99 -> 6
    mockRandom
      .mockReturnValueOnce(0) // white1 = 1
      .mockReturnValueOnce(0.5) // white2 = 4
      .mockReturnValueOnce(0.17) // red = 2
      .mockReturnValueOnce(0.34) // yellow = 3
      .mockReturnValueOnce(0.67) // green = 5
      .mockReturnValueOnce(0.84); // blue = 6

    const dice = rollAllDice([]);
    expect(dice.white1).toBe(1);
    expect(dice.white2).toBe(4);
    expect(dice.red).toBe(2);
    expect(dice.yellow).toBe(3);
    expect(dice.green).toBe(5);
    expect(dice.blue).toBe(6);

    mockRandom.mockRestore();
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
