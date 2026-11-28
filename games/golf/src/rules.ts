import { aceLowRankValue, type Card, type Rank } from '@parlor/cards';
import type { GolfOptions } from './types.js';

export const DEFAULT_OPTIONS: Readonly<GolfOptions> = {
  holes: 9,
  finalTurns: false,
  flipOnDiscard: false,
  fourOfAKind: false,
};

export const COLUMN_COUNT = 3;
export const SLOT_COUNT = 2 * COLUMN_COUNT;

export function golfValue(rank: Rank): number {
  if (rank === '2') return -2;
  if (rank === 'K') return 0;
  return Math.min(aceLowRankValue(rank), 10);
}

export function columnScore(top: Card | null, bottom: Card | null): number {
  if (top && bottom && top.rank === bottom.rank) return 0;
  return (top ? golfValue(top.rank) : 0) + (bottom ? golfValue(bottom.rank) : 0);
}

export function gridScore(grid: readonly (Card | null)[], fourOfAKind = false): number {
  let score = 0;
  const pairs = new Set<Rank>();
  let bonus = false;
  for (let column = 0; column < COLUMN_COUNT; column++) {
    const top = grid[column];
    const bottom = grid[column + COLUMN_COUNT];
    score += columnScore(top, bottom);
    if (top && bottom && top.rank === bottom.rank) {
      if (pairs.has(top.rank)) bonus = true;
      pairs.add(top.rank);
    }
  }
  return score - (fourOfAKind && bonus ? 10 : 0);
}
