export const seasons = 3;
export const handSize = 5;
export const picksPerSeason = 4;

export const goods = {
  lantern: { label: 'Lantern', sale: 2, detail: 'Pairs with silk' },
  silk: { label: 'Silk', sale: 3, detail: 'Pairs with lantern' },
  tea: { label: 'Tea', sale: 2, detail: 'Pairs with pottery' },
  pottery: { label: 'Pottery', sale: 3, detail: 'Pairs with tea' },
  spice: { label: 'Spice', sale: 1, detail: 'Pays for variety' },
} as const;
export type Good = keyof typeof goods;
export interface Tile { id: number; good: Good }
export interface Pick { tileId: number; use: 'sell' | 'display' }
export const goodKinds = Object.keys(goods) as Good[];

export function displayScore(tiles: readonly Tile[]) {
  const count = (good: Good) => tiles.filter((tile) => tile.good === good).length;
  const lanterns = count('lantern');
  const silks = count('silk');
  const teas = count('tea');
  const pottery = count('pottery');
  const variety = [lanterns, silks, teas, pottery].filter(Boolean).length;
  return tiles.length + 5 * (Math.min(lanterns, silks) + Math.min(teas, pottery)) + count('spice') * variety;
}
