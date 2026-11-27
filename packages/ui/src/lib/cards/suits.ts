export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

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

export function isRedSuit(suit: CardSuit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/** "Queen of Spades", "8 of Diamonds": the card's accessible name. */
export function cardName(rank: string, suit: CardSuit): string {
  return `${RANK_NAMES[rank] ?? rank} of ${SUIT_NAMES[suit]}`;
}
