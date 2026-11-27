import { aceLowRankValue, isRedSuit } from '@parlor/cards';
import type { Card, Pile, PilePosition } from '../types/game.js';
import { CORNER_POSITIONS } from '../types/game.js';

export function alternatesColor(cardToPlay: Card, targetCard: Card): boolean {
  return isRedSuit(cardToPlay.suit) !== isRedSuit(targetCard.suit);
}

export function isOneRankLower(card: Card, target: Card): boolean {
  return aceLowRankValue(card.rank) === aceLowRankValue(target.rank) - 1;
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
