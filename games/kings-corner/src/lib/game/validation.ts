import type { Card, Rank, Pile, PilePosition } from '../types/game.js';
import { CORNER_POSITIONS } from '../types/game.js';

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function alternatesColor(cardToPlay: Card, targetCard: Card): boolean {
  return isRed(cardToPlay) !== isRed(targetCard);
}

const RANK_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

export function getRankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

export function isOneRankLower(card: Card, target: Card): boolean {
  return getRankValue(card.rank) === getRankValue(target.rank) - 1;
}

export function isCornerPosition(pos: PilePosition): boolean {
  return (CORNER_POSITIONS as readonly string[]).includes(pos);
}

export function canPlayCardOnPile(card: Card, pile: Pile, position: PilePosition): boolean {
  if (card.rank === 'K') {
    return isCornerPosition(position) && pile.cards.length === 0;
  }

  if (isCornerPosition(position) && pile.cards.length === 0) {
    return false;
  }

  if (pile.cards.length === 0) {
    return true;
  }

  const topCard = pile.cards[pile.cards.length - 1];
  return alternatesColor(card, topCard) && isOneRankLower(card, topCard);
}

export function canMovePile(
  fromPile: Pile,
  toPile: Pile,
  toPosition: PilePosition,
): boolean {
  if (fromPile.cards.length === 0) return false;

  const bottomOfFrom = fromPile.cards[0];

  if (toPile.cards.length === 0) {
    if (isCornerPosition(toPosition)) {
      return bottomOfFrom.rank === 'K';
    }
    return true;
  }

  const topOfTo = toPile.cards[toPile.cards.length - 1];
  return alternatesColor(bottomOfFrom, topOfTo) && isOneRankLower(bottomOfFrom, topOfTo);
}
