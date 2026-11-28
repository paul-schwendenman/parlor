import type { Disc } from './types.js';

export const STARTING_DISCS: readonly Disc[] = ['flower', 'flower', 'flower', 'skull'];
export const WIN_POINTS = 2;

export function isDisc(value: unknown): value is Disc {
  return value === 'flower' || value === 'skull';
}

/** Flowers first, so a hand never shows where its skull was. */
export function sortDiscs(discs: readonly Disc[]): Disc[] {
  return [...discs].sort((a, b) => Number(a === 'skull') - Number(b === 'skull'));
}

export function range(from: number, to: number) {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}
