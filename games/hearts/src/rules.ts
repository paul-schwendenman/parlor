import { aceHighRankValue, cardEquals, type Card } from '@parlor/cards';
import type { PassDirection, TrickPlay } from './types.js';

export const OPENING_CARD: Card = { rank: '2', suit: 'clubs' };

/** Seats clockwise from the passer to the player who receives the cards. */
export const PASS_OFFSET: Readonly<Record<PassDirection, number>> = { left: 1, right: 3, across: 2, hold: 0 };

export function penalty(card: Card): number {
  if (card.suit === 'hearts') return 1;
  return card.suit === 'spades' && card.rank === 'Q' ? 13 : 0;
}

export function legalCards(
  hand: Card[],
  lead: Card | undefined,
  firstTrick: boolean,
  heartsBroken: boolean,
): Card[] {
  if (!lead) {
    if (firstTrick) return hand.filter((card) => cardEquals(card, OPENING_CARD));
    const nonHearts = hand.filter((card) => card.suit !== 'hearts');
    return heartsBroken || nonHearts.length === 0 ? hand : nonHearts;
  }

  const following = hand.filter((card) => card.suit === lead.suit);
  if (following.length) return following;
  if (!firstTrick) return hand;

  const safe = hand.filter((card) => penalty(card) === 0);
  if (safe.length) return safe;
  // A void player with only penalty cards must still be able to play.
  return hand.filter((card) => card.suit === 'hearts');
}

export function winningPlay(trick: readonly [TrickPlay, ...TrickPlay[]]): TrickPlay {
  return trick.reduce((best, play) =>
    play.card.suit === best.card.suit && aceHighRankValue(play.card.rank) > aceHighRankValue(best.card.rank)
      ? play
      : best,
  );
}
