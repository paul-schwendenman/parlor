import type { Card } from '@parlor/cards';
import { arrangements, bestArrangement, bestDefense } from '@parlor/cards/melds';
import type { GinOptions, HandResult } from './types.js';

export const DEFAULT_OPTIONS: Readonly<GinOptions> = {
  target: 100, knockLimit: 10, ginBonus: 20, undercutBonus: 10, bigGin: false, boxBonus: true,
};

export function scoreHand(
  knockerId: string, defenderId: string, hand: readonly Card[], defense: readonly Card[],
  options: GinOptions, doubled: boolean,
): HandResult {
  let knocker = bestArrangement(hand);
  let defender = { ...bestArrangement(defense), layoffs: [] as ReturnType<typeof bestDefense>['layoffs'] };
  let outcome: HandResult['outcome'];
  let winnerId = knockerId;
  let points: number;
  if (!knocker.deadwoodCount) {
    outcome = hand.length === 11 ? 'big-gin' : 'gin';
    points = defender.deadwoodCount + (outcome === 'big-gin' ? 31 : options.ginBonus);
  } else {
    let bestResponse: ReturnType<typeof bestDefense> | undefined;
    for (const candidate of arrangements(hand)) {
      if (candidate.deadwoodCount !== knocker.deadwoodCount) continue;
      const response = bestDefense(defense, candidate.melds);
      if (!bestResponse || response.deadwoodCount > bestResponse.deadwoodCount) {
        knocker = candidate;
        bestResponse = response;
      }
    }
    defender = bestResponse!;
    const difference = defender.deadwoodCount - knocker.deadwoodCount;
    outcome = difference > 0 ? 'knock' : 'undercut';
    if (outcome === 'undercut') winnerId = defenderId;
    points = difference > 0 ? difference : options.undercutBonus - difference;
  }
  return { outcome, knockerId, winnerId, points: doubled ? points * 2 : points, knocker, defender };
}
