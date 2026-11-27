import { aceHighRankValue, isRedSuit, type Card, type Suit } from '@parlor/cards';
import type { RoundResult, Team, TrickPlay } from './types.js';

export function effectiveSuit(card: Card, trump: Suit): Suit {
  return card.rank === 'J' && isRedSuit(card.suit) === isRedSuit(trump) ? trump : card.suit;
}

export function trumpRank(card: Card, trump: Suit): number {
  if (card.rank === 'J' && effectiveSuit(card, trump) === trump) return card.suit === trump ? 16 : 15;
  return aceHighRankValue(card.rank);
}

export function legalCards(hand: readonly Card[], lead: Card | undefined, trump: Suit): Card[] {
  if (!lead) return [...hand];
  const suit = effectiveSuit(lead, trump);
  const following = hand.filter((card) => effectiveSuit(card, trump) === suit);
  return following.length ? following : [...hand];
}

export function beats(challenger: Card, leader: Card, trump: Suit): boolean {
  const suit = effectiveSuit(challenger, trump);
  const leadSuit = effectiveSuit(leader, trump);
  if (suit === leadSuit) return trumpRank(challenger, trump) > trumpRank(leader, trump);
  return suit === trump;
}

export function winningPlay(trick: readonly [TrickPlay, ...TrickPlay[]], trump: Suit): TrickPlay {
  return trick.reduce((winner, play) => beats(play.card, winner.card, trump) ? play : winner);
}

export function scoreRound(makers: Team, tricks: number, alone: boolean): RoundResult {
  if (tricks < 3) return { team: makers === 0 ? 1 : 0, points: 2, outcome: 'euchred' };
  if (tricks < 5) return { team: makers, points: 1, outcome: 'made' };
  return alone
    ? { team: makers, points: 4, outcome: 'lone-march' }
    : { team: makers, points: 2, outcome: 'march' };
}
