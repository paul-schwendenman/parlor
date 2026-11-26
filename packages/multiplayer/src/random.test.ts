import { describe, it, expect, vi } from 'vitest';
import { fisherYatesShuffle } from './random.js';

describe('fisherYatesShuffle', () => {
  it('should return an array with the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(input);

    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    fisherYatesShuffle(input);

    expect(input).toEqual(copy);
  });

  it('should return the correct length', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = fisherYatesShuffle(input);

    expect(result).toHaveLength(6);
  });

  it('should handle empty array', () => {
    const result = fisherYatesShuffle([]);
    expect(result).toEqual([]);
  });

  it('should handle single element', () => {
    const result = fisherYatesShuffle([42]);
    expect(result).toEqual([42]);
  });

  it('uses decreasing exclusive bounds and returns a deterministic permutation', () => {
    const randomInt = vi.fn<(max: number) => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1);

    expect(fisherYatesShuffle([1, 2, 3], randomInt)).toEqual([3, 2, 1]);
    expect(randomInt.mock.calls).toEqual([[3], [2]]);
  });
});
