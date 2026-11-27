import type { GameMeta } from '@parlor/game-types';
import { quixxMeta } from '@parlor/quixx/meta';
import { crazyEightsMeta } from '@parlor/crazy-eights/meta';
import { bootyDiceMeta } from '@parlor/booty-dice/meta';
import { liarsDiceMeta } from '@parlor/liars-dice/meta';
import { kingsCornerMeta } from '@parlor/kings-corner/meta';
import { heartsMeta } from '@parlor/hearts/meta';
import { spadesMeta } from '@parlor/spades/meta';
import { euchreMeta } from '@parlor/euchre/meta';
import { ohHellMeta } from '@parlor/oh-hell/meta';

/**
 * A game's fixed shelf colour (DESIGN.md: Game shelf, Game boards). It is the
 * same block on the home shelf and in the lobby, and matches the game's pieces.
 */
export type ShelfColour = 'felt' | 'mustard' | 'clay' | 'ink' | 'linen';

export interface CatalogGame extends GameMeta {
  shelf: ShelfColour;
}

/**
 * Every game in Parlor, in shelf order. The trick-taking four have no board
 * colour of their own (they play on felt with the default ink card back), so
 * theirs are chosen by suit and so that neighbouring shelf blocks differ in
 * both the one-column and two-column shelf.
 */
export const catalog: readonly CatalogGame[] = [
  { ...quixxMeta, shelf: 'felt' },
  { ...crazyEightsMeta, shelf: 'mustard' },
  { ...bootyDiceMeta, shelf: 'clay' },
  { ...liarsDiceMeta, shelf: 'ink' },
  { ...kingsCornerMeta, shelf: 'linen' },
  { ...heartsMeta, shelf: 'clay' },
  { ...spadesMeta, shelf: 'ink' },
  { ...euchreMeta, shelf: 'felt' },
  { ...ohHellMeta, shelf: 'mustard' },
];

export function findGame(id: string | null | undefined): CatalogGame | undefined {
  return id ? catalog.find((game) => game.id === id) : undefined;
}

/** "4" for a fixed count, "2–5" for a range. */
export function playerRange(game: Pick<GameMeta, 'minPlayers' | 'maxPlayers'>): string {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}`
    : `${game.minPlayers}–${game.maxPlayers}`;
}

/** "4 players" for a fixed count, "2–5 players" for a range. */
export function playerCount(game: Pick<GameMeta, 'minPlayers' | 'maxPlayers'>): string {
  return `${playerRange(game)} players`;
}

/** "Needs 1 more player", "Needs 2 more players". */
export function playersNeeded(count: number): string {
  return `Needs ${count} more ${count === 1 ? 'player' : 'players'}`;
}

/** "15–20" from the meta's "15-20", with a real en dash. */
export function minutesRange(game: Pick<GameMeta, 'estimatedMinutes'>): string {
  return game.estimatedMinutes.replace('-', '–');
}
