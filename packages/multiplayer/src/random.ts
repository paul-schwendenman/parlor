import { randomInt } from 'node:crypto';

/** Returns a uniformly distributed integer from 0 (inclusive) to max (exclusive). */
export type RandomInt = (max: number) => number;

export const secureRandomInt: RandomInt = (max) => randomInt(max);

export function fisherYatesShuffle<T>(
  items: readonly T[],
  randomInt: RandomInt = secureRandomInt,
): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
