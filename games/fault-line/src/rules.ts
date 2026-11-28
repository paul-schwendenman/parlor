export const cacheSupply = [0, 0, 1, 1, 2, 2] as const;
export type Cache = (typeof cacheSupply)[number];
export const cacheName: Record<Cache, string> = { 0: 'Fault', 1: 'Silver', 2: 'Gold' };
export const startingBounties = 4;
export const maxBounty = 2;

export function openingScore(cache: Cache, bounty: number) {
  return cache === 0 ? -1 : cache + bounty;
}

export function ownerScore(cache: Cache, openers: number) {
  if (!openers) return cache;
  return openers * (cache === 0 ? 2 : 1);
}
