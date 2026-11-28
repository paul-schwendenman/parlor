import type { GameMeta } from '@parlor/game-types';
import { quixxMeta } from '@parlor/quixx/meta';
import { crazyEightsMeta } from '@parlor/crazy-eights/meta';
import { bootyDiceMeta } from '@parlor/booty-dice/meta';
import { liarsDiceMeta } from '@parlor/liars-dice/meta';
import { kingsCornerMeta } from '@parlor/kings-corner/meta';
import { heartsMeta } from '@parlor/hearts/meta';
import { spadesMeta } from '@parlor/spades/meta';
import { euchreMeta } from '@parlor/euchre/meta';
import { farkleMeta } from '@parlor/farkle/meta';
import { wordSplitMeta } from '@parlor/word-split/meta';
import { ohHellMeta } from '@parlor/oh-hell/meta';

/**
 * A game's fixed shelf colour (DESIGN.md: Game shelf, Game boards). It is the
 * same block on the home shelf and in the lobby, and matches the game's pieces.
 */
export type ShelfColour = 'felt' | 'mustard' | 'clay' | 'ink' | 'linen';

export interface CatalogGame extends GameMeta {
  shelf: ShelfColour;
  /**
   * The description cut to one short line (about 35 characters) for phone
   * rows, where the full description would be clipped mid-sentence. Plain
   * words, and only what the description or the rules already say.
   */
  tagline: string;
}

/**
 * Every game in Parlor, in shelf order. The trick-taking four have no board
 * colour of their own (they play on felt with the default ink card back), so
 * theirs are chosen by suit and so that neighbouring shelf blocks differ in
 * both the one-column and two-column shelf.
 */
export const catalog: readonly CatalogGame[] = [
  { ...quixxMeta, shelf: 'felt', tagline: 'Roll dice and cross off numbers' },
  { ...crazyEightsMeta, shelf: 'mustard', tagline: 'Match suit or rank. Eights are wild.' },
  { ...bootyDiceMeta, shelf: 'clay', tagline: 'Pirate dice of treasure and attacks' },
  { ...liarsDiceMeta, shelf: 'ink', tagline: 'Bid on hidden dice and call out liars' },
  { ...kingsCornerMeta, shelf: 'linen', tagline: 'Stack cards down, red on black' },
  { ...heartsMeta, shelf: 'clay', tagline: 'Pass cards and dodge penalty points' },
  { ...spadesMeta, shelf: 'ink', tagline: 'Team up and win the tricks you bid' },
  { ...euchreMeta, shelf: 'felt', tagline: 'Team up, call trump, take 3 tricks' },
  { ...ohHellMeta, shelf: 'mustard', tagline: 'Bid your tricks, then hit it exactly' },
  { ...farkleMeta, shelf: 'linen', tagline: 'Bank your dice points or roll again' },
  { ...wordSplitMeta, shelf: 'ink', tagline: 'Find words only you thought of' },
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
