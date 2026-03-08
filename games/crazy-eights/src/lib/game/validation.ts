import type { Card, Suit } from '../types/game.js';

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function canPlayCard(card: Card, topDiscard: Card, declaredSuit: Suit | null): boolean {
  // 8s are always playable
  if (card.rank === '8') return true;
  // If a suit was declared (after an 8), match that suit
  if (declaredSuit) return card.suit === declaredSuit;
  // Otherwise match suit or rank
  return card.suit === topDiscard.suit || card.rank === topDiscard.rank;
}

export function getPlayableCards(hand: Card[], topDiscard: Card, declaredSuit: Suit | null): Card[] {
  return hand.filter((card) => canPlayCard(card, topDiscard, declaredSuit));
}
