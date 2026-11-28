import { describe, expect, it } from 'vitest';
import { GAME_KINDS } from '@parlor/game-types';
import { catalog } from './catalog.js';
import {
  activeFilterCount,
  emptyFilters,
  facetCounts,
  filterGames,
  filtersFromParams,
  filtersToParams,
  kindLabels,
  kindsInUse,
  lengthOf,
  normalize,
  playerOptions,
  searchScore,
  type DiscoverableGame,
  type GameFilters,
} from './discovery.js';

const f = (over: Partial<GameFilters> = {}): GameFilters => ({ ...emptyFilters, kinds: [], ...over });
const ids = (games: readonly { id: string }[]) => games.map((g) => g.id);

describe('catalogue metadata', () => {
  it('every game has sane structured fields', () => {
    for (const g of catalog) {
      expect(g.minutes.min, g.id).toBeGreaterThan(0);
      expect(g.minutes.max, g.id).toBeGreaterThanOrEqual(g.minutes.min);
      expect(g.minPlayers, g.id).toBeLessThanOrEqual(g.maxPlayers);
      expect(kindLabels[g.kind], g.id).toBeDefined();
      for (const tag of g.tags) {
        expect(tag, g.id).toBe(tag.toLowerCase());
        // Tags are for what the structured fields don't say.
        expect(GAME_KINDS as readonly string[], `${g.id} tag "${tag}" repeats its kind`).not.toContain(tag);
        expect(['teams', 'quick', 'strategy', 'easy'], `${g.id} tag "${tag}"`).not.toContain(tag);
      }
    }
  });

  it('ids are unique', () => {
    expect(new Set(ids(catalog)).size).toBe(catalog.length);
  });
});

describe('lengthOf', () => {
  it('buckets by the middle of the range', () => {
    expect(lengthOf({ minutes: { min: 10, max: 15 } })).toBe('quick');
    expect(lengthOf({ minutes: { min: 15, max: 25 } })).toBe('medium'); // mid 20
    expect(lengthOf({ minutes: { min: 15, max: 30 } })).toBe('medium');
    expect(lengthOf({ minutes: { min: 20, max: 40 } })).toBe('medium'); // mid 30
    expect(lengthOf({ minutes: { min: 25, max: 40 } })).toBe('long');
  });
});

describe('search', () => {
  it('normalizes apostrophes, accents and punctuation', () => {
    expect(normalize("Liar’s  Dice!")).toBe('liars dice');
    expect(normalize('Café')).toBe('cafe');
  });

  it('matches word prefixes across fields', () => {
    expect(ids(filterGames(catalog, f({ query: 'liars' })))).toEqual(['liars-dice']);
    expect(ids(filterGames(catalog, f({ query: "liar's" })))).toEqual(['liars-dice']);
    expect(ids(filterGames(catalog, f({ query: 'card' })))).toEqual(
      ids(catalog.filter((g) => g.kind === 'cards')),
    );
    expect(ids(filterGames(catalog, f({ query: 'pirate' })))).toEqual(['booty-dice']);
  });

  it('requires every word to match', () => {
    expect(ids(filterGames(catalog, f({ query: 'trick partners' })))).toEqual(['spades', 'euchre']);
    expect(filterGames(catalog, f({ query: 'trick pirates' }))).toEqual([]);
  });

  it('ranks name matches above description matches', () => {
    // "dice" is Liar's Dice's and Booty Dice's name, but only Quixx's kind.
    const result = ids(filterGames(catalog, f({ query: 'dice' })));
    expect(result.slice(0, 2).sort()).toEqual(['booty-dice', 'liars-dice']);
    expect(result).toContain('quixx');
  });

  it('puts a name that starts with the query first', () => {
    expect(ids(filterGames(catalog, f({ query: 'he' })))[0]).toBe('hearts');
  });

  it('an empty query matches everything', () => {
    expect(searchScore(catalog[0], '   ')).toBeGreaterThan(0);
    expect(filterGames(catalog, f())).toHaveLength(catalog.length);
  });
});

describe('filters', () => {
  it('player count keeps games that seat the group', () => {
    expect(ids(filterGames(catalog, f({ players: 6 }))).sort()).toEqual(['booty-dice', 'liars-dice', 'oh-hell']);
    expect(filterGames(catalog, f({ players: 4 })).every((g) => g.minPlayers <= 4 && g.maxPlayers >= 4)).toBe(true);
  });

  it('kinds are OR, other facets AND', () => {
    expect(filterGames(catalog, f({ kinds: ['cards', 'dice'] }))).toHaveLength(catalog.length);
    expect(ids(filterGames(catalog, f({ kinds: ['cards'], format: 'teams' })))).toEqual(['spades', 'euchre']);
    expect(ids(filterGames(catalog, f({ kinds: ['dice'], length: 'quick' })))).toEqual(['quixx']);
  });

  it('weight filter', () => {
    const light = filterGames(catalog, f({ weight: 'light' }));
    expect(light.length).toBeGreaterThan(0);
    expect(light.every((g) => g.weight === 'light')).toBe(true);
  });

  it('counts active filters, not the query', () => {
    expect(activeFilterCount(f({ query: 'x', players: 4, kinds: ['cards', 'dice'], format: 'teams' }))).toBe(4);
  });
});

describe('sorting', () => {
  it('shortest and longest use typical time, ties in shelf order', () => {
    const shortest = filterGames(catalog, f(), 'shortest');
    expect(shortest[0].id).toBe('crazy-eights');
    expect(filterGames(catalog, f(), 'longest')[0].id).toBe('spades');
  });

  it('name sort is alphabetical', () => {
    const names = filterGames(catalog, f(), 'name').map((g) => g.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('facetCounts', () => {
  it("ignores the facet's own selection so siblings stay countable", () => {
    const counts = facetCounts(catalog, f({ kinds: ['cards'] }));
    expect(counts.kinds.dice).toBe(catalog.filter((g) => g.kind === 'dice').length);
    expect(counts.kinds.cards).toBe(catalog.filter((g) => g.kind === 'cards').length);
  });

  it('applies the other facets', () => {
    const counts = facetCounts(catalog, f({ format: 'teams' }));
    expect(counts.kinds.dice).toBe(0);
    expect(counts.players[4]).toBe(2);
    expect(counts.players[2]).toBe(0);
  });
});

describe('options in use', () => {
  it('offers only player counts and kinds some game has', () => {
    expect(playerOptions(catalog)).toEqual([2, 3, 4, 5, 6]);
    expect(kindsInUse(catalog)).toEqual(['cards', 'dice']);
    expect(playerOptions([{ minPlayers: 2, maxPlayers: 2 }, { minPlayers: 5, maxPlayers: 6 }])).toEqual([2, 5, 6]);
  });
});

describe('URL params', () => {
  it('round-trips', () => {
    const filters = f({ query: 'trick', players: 4, kinds: ['cards', 'dice'], length: 'long', weight: 'medium', format: 'teams' });
    const params = filtersToParams(filters, 'name');
    expect(params.toString()).toBe('q=trick&players=4&type=cards%2Cdice&length=long&level=medium&play=teams&sort=name');
    expect(filtersFromParams(params)).toEqual({ filters, sort: 'name' });
  });

  it('omits defaults', () => {
    expect(filtersToParams(f()).toString()).toBe('');
  });

  it('drops junk instead of throwing', () => {
    const { filters, sort } = filtersFromParams(
      new URLSearchParams('players=-3&type=cards,nope,cards&length=forever&level=&play=x&sort=random'),
    );
    expect(filters).toEqual(f({ kinds: ['cards'] }));
    expect(sort).toBe('shelf');
  });
});

describe('at scale', () => {
  // A synthetic 40-game shelf, to keep the logic honest beyond today's nine.
  const big: DiscoverableGame[] = Array.from({ length: 40 }, (_, i) => ({
    id: `g${i}`,
    name: `Game ${i}`,
    description: i % 5 === 0 ? 'Draw pictures and guess.' : 'A game.',
    minPlayers: 2 + (i % 3),
    maxPlayers: 4 + (i % 5),
    minutes: { min: 5 + (i % 7) * 5, max: 10 + (i % 7) * 7 },
    kind: GAME_KINDS[i % GAME_KINDS.length],
    weight: (['light', 'medium', 'heavy'] as const)[i % 3],
    format: (['individual', 'teams', 'coop'] as const)[i % 3],
    tags: i % 4 === 0 ? ['bluffing'] : [],
  }));

  it('facet counts agree with filtering for every option', () => {
    const base = f({ players: 5, weight: 'light' });
    const counts = facetCounts(big, base);
    for (const kind of GAME_KINDS) {
      expect(counts.kinds[kind], kind).toBe(filterGames(big, { ...base, kinds: [kind] }).length);
    }
    for (const n of playerOptions(big)) {
      expect(counts.players[n], `players ${n}`).toBe(filterGames(big, { ...base, players: n }).length);
    }
  });

  it('search plus filters narrows', () => {
    const r = filterGames(big, f({ query: 'bluff', kinds: ['cards'] }));
    expect(r.every((g) => g.kind === 'cards' && g.tags.includes('bluffing'))).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
});
