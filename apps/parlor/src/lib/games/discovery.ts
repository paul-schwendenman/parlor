/**
 * Filtering, search and sorting for the game catalogue. Pure functions only,
 * so the home shelf, the browse page and the lobby ballot all agree on what
 * "a quick card game for 5" means. See docs/DISCOVERY-PLAN.md.
 */
import {
  GAME_FORMATS,
  GAME_KINDS,
  GAME_WEIGHTS,
  type GameFormat,
  type GameKind,
  type GameMeta,
  type GameWeight,
} from '@parlor/game-types';

export type GameLength = 'quick' | 'medium' | 'long';
export const GAME_LENGTHS: readonly GameLength[] = ['quick', 'medium', 'long'];

export type GameSort = 'shelf' | 'name' | 'shortest' | 'longest';
export const GAME_SORTS: readonly GameSort[] = ['shelf', 'name', 'shortest', 'longest'];

/** The fields discovery reads. `tagline` is optional so plain GameMeta works too. */
export type DiscoverableGame = Pick<
  GameMeta,
  'id' | 'name' | 'description' | 'minPlayers' | 'maxPlayers' | 'minutes' | 'kind' | 'weight' | 'format' | 'tags'
> & { tagline?: string };

export interface GameFilters {
  /** Free text; every word must match somewhere (name, tags, kind, description…). */
  query: string;
  /** Group size the game must seat, or null for any. */
  players: number | null;
  /** Any of these kinds (OR). Empty means any. */
  kinds: GameKind[];
  length: GameLength | null;
  weight: GameWeight | null;
  format: GameFormat | null;
}

export const emptyFilters: Readonly<GameFilters> = Object.freeze({
  query: '',
  players: null,
  kinds: [],
  length: null,
  weight: null,
  format: null,
});

export const kindLabels: Record<GameKind, string> = {
  cards: 'Cards',
  dice: 'Dice',
  board: 'Board',
  word: 'Word',
  drawing: 'Drawing',
  trivia: 'Trivia',
  party: 'Party',
};

/** Plural headings for grouped sections on the browse page. */
export const kindHeadings: Record<GameKind, string> = {
  cards: 'Card games',
  dice: 'Dice games',
  board: 'Board games',
  word: 'Word games',
  drawing: 'Drawing games',
  trivia: 'Trivia games',
  party: 'Party games',
};

export const lengthLabels: Record<GameLength, string> = {
  quick: 'Under 20 min',
  medium: '20–30 min',
  long: '30+ min',
};

export const weightLabels: Record<GameWeight, string> = {
  light: 'Easy to learn',
  medium: 'Some strategy',
  heavy: 'Deep strategy',
};

export const formatLabels: Record<GameFormat, string> = {
  individual: 'Every player for themselves',
  teams: 'Teams',
  coop: 'Co-op',
};

/** Short chip text, where the full label would crowd a phone row. */
export const formatChipLabels: Record<GameFormat, string> = {
  individual: 'Free-for-all',
  teams: 'Teams',
  coop: 'Co-op',
};

export const sortLabels: Record<GameSort, string> = {
  shelf: 'Shelf order',
  name: 'A–Z',
  shortest: 'Shortest first',
  longest: 'Longest first',
};

/** Typical play time: the middle of the game's range. */
export function typicalMinutes(game: Pick<GameMeta, 'minutes'>): number {
  return (game.minutes.min + game.minutes.max) / 2;
}

/**
 * Length bucket by typical play time: quick under 20 minutes, long over 30.
 * Using the middle rather than either end keeps a "15–30" game out of both
 * the quick and the long bucket.
 */
export function lengthOf(game: Pick<GameMeta, 'minutes'>): GameLength {
  const mid = typicalMinutes(game);
  if (mid < 20) return 'quick';
  if (mid <= 30) return 'medium';
  return 'long';
}

/** Whether a group of `players` can sit down to this game without bots or waiting. */
export function seats(game: Pick<GameMeta, 'minPlayers' | 'maxPlayers'>, players: number): boolean {
  return players >= game.minPlayers && players <= game.maxPlayers;
}

/** Lowercase, strip accents and apostrophes, collapse everything else to spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function terms(query: string): string[] {
  const n = normalize(query);
  return n ? n.split(' ') : [];
}

/** Searchable text per field, heaviest first. */
function fields(game: DiscoverableGame): { weight: number; words: string[] }[] {
  const words = (text: string) => normalize(text).split(' ').filter(Boolean);
  return [
    { weight: 8, words: words(game.name) },
    {
      weight: 4,
      words: [
        ...words(game.tags.join(' ')),
        ...words(kindLabels[game.kind]),
        ...words(formatLabels[game.format]),
        ...words(weightLabels[game.weight]),
      ],
    },
    { weight: 1, words: words(`${game.tagline ?? ''} ${game.description}`) },
  ];
}

/**
 * How well a game matches a search, or 0 for no match. Every query word must
 * prefix-match a word somewhere ("card" finds "cards", "liars" finds "Liar's").
 * Each word scores by the heaviest field it hits; a name that starts with the
 * whole query gets a bonus so "he" puts Hearts above games that merely say "the".
 */
export function searchScore(game: DiscoverableGame, query: string): number {
  const qs = terms(query);
  if (!qs.length) return 1;
  const fs = fields(game);
  let score = 0;
  for (const q of qs) {
    let best = 0;
    for (const f of fs) {
      if (f.weight <= best) continue;
      if (f.words.some((w) => w.startsWith(q))) best = f.weight;
    }
    if (!best) return 0;
    score += best;
  }
  if (normalize(game.name).startsWith(normalize(query))) score += 16;
  return score;
}

type Facet = 'players' | 'kinds' | 'length' | 'weight' | 'format';

function matchesExcept(game: DiscoverableGame, f: GameFilters, skip: Facet | null): boolean {
  if (skip !== 'players' && f.players !== null && !seats(game, f.players)) return false;
  if (skip !== 'kinds' && f.kinds.length && !f.kinds.includes(game.kind)) return false;
  if (skip !== 'length' && f.length && lengthOf(game) !== f.length) return false;
  if (skip !== 'weight' && f.weight && game.weight !== f.weight) return false;
  if (skip !== 'format' && f.format && game.format !== f.format) return false;
  return searchScore(game, f.query) > 0;
}

export function matchesFilters(game: DiscoverableGame, filters: GameFilters): boolean {
  return matchesExcept(game, filters, null);
}

/**
 * The games that pass every filter, in the given order. With a search query
 * and the default sort, best matches come first (ties keep shelf order).
 */
export function filterGames<G extends DiscoverableGame>(
  games: readonly G[],
  filters: GameFilters,
  sort: GameSort = 'shelf',
): G[] {
  const hits = games
    .map((game, index) => ({ game, index, score: searchScore(game, filters.query) }))
    .filter(({ game, score }) => score > 0 && matchesExcept(game, filters, null));

  const compare: Record<GameSort, (a: (typeof hits)[number], b: (typeof hits)[number]) => number> = {
    shelf: (a, b) => b.score - a.score || a.index - b.index,
    name: (a, b) => a.game.name.localeCompare(b.game.name) || a.index - b.index,
    shortest: (a, b) => typicalMinutes(a.game) - typicalMinutes(b.game) || a.index - b.index,
    longest: (a, b) => typicalMinutes(b.game) - typicalMinutes(a.game) || a.index - b.index,
  };
  return hits.sort(compare[sort]).map(({ game }) => game);
}

/**
 * How many games each option of one facet would show, given every *other*
 * active filter. Chips use it to show counts and to dim options that would
 * empty the list, without the facet's own selection hiding its siblings.
 */
export function facetCounts(games: readonly DiscoverableGame[], filters: GameFilters) {
  const tally = <K extends string>(facet: Facet, keys: readonly K[], keyOf: (g: DiscoverableGame) => K) => {
    const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
    for (const g of games) if (matchesExcept(g, filters, facet)) out[keyOf(g)]++;
    return out;
  };

  const playersPool = games.filter((g) => matchesExcept(g, filters, 'players'));
  const players: Record<number, number> = {};
  for (const n of playerOptions(games)) players[n] = playersPool.filter((g) => seats(g, n)).length;

  return {
    kinds: tally('kinds', GAME_KINDS, (g) => g.kind),
    length: tally('length', GAME_LENGTHS, lengthOf),
    weight: tally('weight', GAME_WEIGHTS, (g) => g.weight),
    format: tally('format', GAME_FORMATS, (g) => g.format),
    players,
  };
}

/** Group sizes worth offering as chips: every count some game seats. */
export function playerOptions(games: readonly Pick<GameMeta, 'minPlayers' | 'maxPlayers'>[]): number[] {
  if (!games.length) return [];
  const lo = Math.min(...games.map((g) => g.minPlayers));
  const hi = Math.max(...games.map((g) => g.maxPlayers));
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (games.some((g) => seats(g, n))) out.push(n);
  return out;
}

/** Kinds that at least one game uses, in GAME_KINDS order (no empty "Trivia" chip). */
export function kindsInUse(games: readonly Pick<GameMeta, 'kind'>[]): GameKind[] {
  return GAME_KINDS.filter((k) => games.some((g) => g.kind === k));
}

/** Weights / formats / lengths that at least one game uses. */
export function weightsInUse(games: readonly Pick<GameMeta, 'weight'>[]): GameWeight[] {
  return GAME_WEIGHTS.filter((w) => games.some((g) => g.weight === w));
}
export function formatsInUse(games: readonly Pick<GameMeta, 'format'>[]): GameFormat[] {
  return GAME_FORMATS.filter((f) => games.some((g) => g.format === f));
}
export function lengthsInUse(games: readonly Pick<GameMeta, 'minutes'>[]): GameLength[] {
  return GAME_LENGTHS.filter((l) => games.some((g) => lengthOf(g) === l));
}

/** Number of active filters, not counting the search box (for a "Clear (3)" button). */
export function activeFilterCount(f: GameFilters): number {
  return (f.players !== null ? 1 : 0) + f.kinds.length + (f.length ? 1 : 0) + (f.weight ? 1 : 0) + (f.format ? 1 : 0);
}

export function isEmpty(f: GameFilters): boolean {
  return !f.query.trim() && activeFilterCount(f) === 0;
}

// ---------------------------------------------------------------------------
// URL state: ?q=hearts&players=4&type=cards,dice&length=quick&level=light&play=teams&sort=name
// Unknown or malformed values are dropped, never thrown, since links get edited by hand.

const oneOf = <T extends string>(allowed: readonly T[], v: string | null): T | null =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export function filtersFromParams(params: URLSearchParams): { filters: GameFilters; sort: GameSort } {
  const players = Number.parseInt(params.get('players') ?? '', 10);
  const kinds = (params.get('type') ?? '')
    .split(',')
    .map((k) => oneOf(GAME_KINDS, k))
    .filter((k): k is GameKind => k !== null);
  return {
    filters: {
      query: (params.get('q') ?? '').slice(0, 80),
      players: Number.isInteger(players) && players > 0 && players < 100 ? players : null,
      kinds: [...new Set(kinds)],
      length: oneOf(GAME_LENGTHS, params.get('length')),
      weight: oneOf(GAME_WEIGHTS, params.get('level')),
      format: oneOf(GAME_FORMATS, params.get('play')),
    },
    sort: oneOf(GAME_SORTS, params.get('sort')) ?? 'shelf',
  };
}

export function filtersToParams(filters: GameFilters, sort: GameSort = 'shelf'): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.query.trim()) p.set('q', filters.query.trim());
  if (filters.players !== null) p.set('players', String(filters.players));
  if (filters.kinds.length) p.set('type', filters.kinds.join(','));
  if (filters.length) p.set('length', filters.length);
  if (filters.weight) p.set('level', filters.weight);
  if (filters.format) p.set('play', filters.format);
  if (sort !== 'shelf') p.set('sort', sort);
  return p;
}
