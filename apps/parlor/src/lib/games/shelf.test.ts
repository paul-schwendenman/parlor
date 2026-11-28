import { describe, expect, it } from 'vitest';
import { pickShelfGames, SHELF_CAPPED_LIMIT, SHELF_SHOW_ALL_UP_TO, type ShelfStrategy } from './shelf.js';

const games = (n: number) => Array.from({ length: n }, (_, i) => `g${i + 1}`);

describe('pickShelfGames', () => {
  it('shows every game up to the threshold, with nothing hidden', () => {
    expect(SHELF_SHOW_ALL_UP_TO).toBe(12);
    for (const n of [0, 1, 11, 12]) {
      const pick = pickShelfGames(games(n));
      expect(pick.shown).toEqual(games(n));
      expect(pick.hidden).toBe(0);
      expect(pick.total).toBe(n);
    }
  });

  it('past the threshold, shows the first 8 in shelf order and counts the rest', () => {
    expect(SHELF_CAPPED_LIMIT).toBe(8);
    const pick = pickShelfGames(games(13));
    expect(pick.shown).toEqual(games(8));
    expect(pick.hidden).toBe(5);
    expect(pick.total).toBe(13);
  });

  it('does not hand back the caller’s array', () => {
    const all = games(3);
    expect(pickShelfGames(all).shown).not.toBe(all);
  });

  it('takes the threshold and limit as options', () => {
    const pick = pickShelfGames(games(5), { showAllUpTo: 4, limit: 2 });
    expect(pick.shown).toEqual(['g1', 'g2']);
    expect(pick.hidden).toBe(3);
  });

  it('lets a strategy choose which games, and never shows more than the limit', () => {
    const lastFirst: ShelfStrategy = (all) => [...all].reverse();
    const pick = pickShelfGames(games(20), { strategy: lastFirst });
    expect(pick.shown).toEqual(['g20', 'g19', 'g18', 'g17', 'g16', 'g15', 'g14', 'g13']);
    expect(pick.hidden).toBe(12);
  });

  it('only asks the strategy once the shelf is capped', () => {
    let calls = 0;
    const counting: ShelfStrategy = (all, limit) => {
      calls++;
      return all.slice(0, limit);
    };
    pickShelfGames(games(12), { strategy: counting });
    expect(calls).toBe(0);
    pickShelfGames(games(13), { strategy: counting });
    expect(calls).toBe(1);
  });
});
