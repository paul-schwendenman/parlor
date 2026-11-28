import type { Card, Rank } from '@parlor/cards';
import type { LegalPlay, PresidentOptions, Title } from './types.js';

const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;

export const DEFAULT_OPTIONS: Readonly<PresidentOptions> = {
  target: 11, firstLead: 'left-of-dealer', exchange: 'one',
  passIsOut: false, twoClears: false, revolution: false,
};

export const THREE_OF_CLUBS: Card = { rank: '3', suit: 'clubs' };

export function rankValue(rank: Rank) {
  return ranks.indexOf(rank);
}

export function legalPlays(hand: readonly Card[], standing: readonly Card[] | undefined, reversed: boolean, forcedRank?: Rank): LegalPlay[] {
  const ordered = reversed ? [...ranks].reverse() : ranks;
  return ordered.flatMap((rank) => {
    const count = hand.filter((card) => card.rank === rank).length;
    if (!count || (forcedRank && rank !== forcedRank)) return [];
    if (!standing) return [{ rank, counts: Array.from({ length: count }, (_, i) => i + 1) }];
    const diff = rankValue(rank) - rankValue(standing[0].rank);
    return (reversed ? diff < 0 : diff > 0) && count >= standing.length ? [{ rank, counts: [standing.length] }] : [];
  });
}

export function titleFor(place: number, players: number, exchange: PresidentOptions['exchange']): Title {
  if (place === 1) return 'President';
  if (place === 2) return 'Vice President';
  if (place === players) return 'Peasant';
  if (place === players - 1 && exchange === 'two') return 'Vice Peasant';
  return 'Citizen';
}

export function pointsFor(place: number) {
  return Math.max(0, 3 - place);
}
