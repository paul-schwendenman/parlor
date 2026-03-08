import { describe, it, expect, vi } from 'vitest';
import { fisherYatesShuffle } from '../shuffle.js';

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

	it('should produce correct result with mocked Math.random', () => {
		// For Fisher-Yates with array [1, 2, 3]:
		// i=2: Math.random() = 0 -> j = floor(0 * 3) = 0, swap(2, 0) -> [3, 2, 1]
		// i=1: Math.random() = 0.5 -> j = floor(0.5 * 2) = 1, swap(1, 1) -> [3, 2, 1]
		const randomValues = [0, 0.5];
		let callIndex = 0;
		vi.spyOn(Math, 'random').mockImplementation(() => randomValues[callIndex++]);

		const result = fisherYatesShuffle([1, 2, 3]);

		expect(result).toEqual([3, 2, 1]);

		vi.restoreAllMocks();
	});
});
