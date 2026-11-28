import type { CatalogGame } from './catalog.js';

/**
 * Which games the home shelf shows (docs/DISCOVERY-PLAN.md, Phase 4).
 * Up to `showAllUpTo` games, the shelf shows every one. Past that, it shows
 * `limit` of them and links to /games for the rest.
 *
 * Which `limit` games is a strategy, so "new first", "recently played" or
 * "a random few" can replace shelf order later without touching the page.
 */

/** Picks `limit` games to show from the full catalogue. Must be pure. */
export type ShelfStrategy<T> = (games: readonly T[], limit: number) => T[];

/** Catalogue shelf order: the first `limit` games. */
export const shelfOrder = <T>(games: readonly T[], limit: number): T[] => games.slice(0, limit);

// Traditional card games and Parlor originals, in homepage order.
const featuredGameIds = [
  'crazy-eights',
  'word-split',
  'gin-rummy',
  'signal-relay',
  'euchre',
  'night-market',
  'hearts',
  'golf',
];

export const featuredShelfOrder: ShelfStrategy<CatalogGame> = (games, limit) => {
  const byId = new Map(games.map((game) => [game.id, game]));
  return featuredGameIds
    .map((id) => byId.get(id))
    .filter((game): game is CatalogGame => game !== undefined)
    .slice(0, limit);
};

export const SHELF_SHOW_ALL_UP_TO = 12;
export const SHELF_CAPPED_LIMIT = 8;

export interface ShelfOptions<T> {
  /** Show every game while the catalogue has at most this many. */
  showAllUpTo?: number;
  /** How many to show once the catalogue is larger. */
  limit?: number;
  strategy?: ShelfStrategy<T>;
}

export interface ShelfPick<T> {
  shown: T[];
  /** Games not on the shelf; the browse link shows only when this is > 0. */
  hidden: number;
  total: number;
}

export function pickShelfGames<T>(games: readonly T[], options: ShelfOptions<T> = {}): ShelfPick<T> {
  const { showAllUpTo = SHELF_SHOW_ALL_UP_TO, limit = SHELF_CAPPED_LIMIT, strategy = shelfOrder } = options;
  const total = games.length;
  const shown = total <= showAllUpTo ? [...games] : strategy(games, limit).slice(0, limit);
  return { shown, hidden: total - shown.length, total };
}
