export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function cardEquals(left: Card, right: Card): boolean {
  return left.suit === right.suit && left.rank === right.rank;
}

/** Returns a fresh card if the input has exactly the suit and rank fields. */
export function parseCard(value: unknown): Card | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes('suit') || !keys.includes('rank')) return null;

  const { suit, rank } = value as Record<string, unknown>;
  const validSuit = SUITS.find((candidate) => candidate === suit);
  const validRank = RANKS.find((candidate) => candidate === rank);
  if (validSuit === undefined || validRank === undefined) return null;

  return { suit: validSuit, rank: validRank };
}

/** Returns 1 through 13, with ace lower than two. */
export function aceLowRankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

/** Returns 2 through 14, with ace higher than king. */
export function aceHighRankValue(rank: Rank): number {
  return rank === 'A' ? 14 : aceLowRankValue(rank);
}
