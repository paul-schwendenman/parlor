import type { Suit } from '@parlor/cards';

export { isRedSuit } from '@parlor/cards';
export type CardSuit = Suit;

export const SUIT_NAMES: Record<CardSuit, string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
};

const RANK_NAMES: Record<string, string> = {
  A: 'Ace',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};

/** "Queen of Spades", "8 of Diamonds": the card's accessible name. */
export function cardName(rank: string, suit: CardSuit): string {
  return `${RANK_NAMES[rank] ?? rank} of ${SUIT_NAMES[suit]}`;
}
