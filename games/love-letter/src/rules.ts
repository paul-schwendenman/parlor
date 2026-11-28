export type CardValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Edition = 'standard' | 'classic';

export const CARD_INFO: Record<CardValue, { name: string; effect: string }> = {
  0: { name: 'Spy', effect: 'No effect now. Still in with the only Spy at round end: +1 token.' },
  1: { name: 'Guard', effect: 'Name a card other than Guard. If they hold it, they are out.' },
  2: { name: 'Priest', effect: 'Secretly look at another player’s card.' },
  3: { name: 'Baron', effect: 'Compare cards in secret. Lower card is out.' },
  4: { name: 'Handmaid', effect: 'Nobody can pick you until your next turn.' },
  5: { name: 'Prince', effect: 'Anyone, even you, discards their card and draws.' },
  6: { name: 'Chancellor', effect: 'Draw 2, keep 1, put the rest under the deck.' },
  7: { name: 'King', effect: 'Trade cards with another player.' },
  8: { name: 'Countess', effect: 'Must be played if you also hold the King or a Prince.' },
  9: { name: 'Princess', effect: 'If she leaves your hand, you are out.' },
};

const STANDARD: CardValue[] = [0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9];
const CLASSIC: CardValue[] = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 7, 8, 9];
export const DECKS: Record<Edition, readonly CardValue[]> = { standard: STANDARD, classic: CLASSIC };

export function isCardValue(value: unknown): value is CardValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9;
}

export function guessable(edition: Edition): CardValue[] {
  return [...new Set(DECKS[edition])].filter((value) => value !== 1);
}

export function targetTokens(players: number): number {
  return ({ 2: 6, 3: 5, 4: 4 } as Record<number, number>)[players] ?? 3;
}

export function mustPlayCountess(hand: readonly CardValue[]) {
  return hand.includes(8) && (hand.includes(7) || hand.includes(5));
}

/** Copies of each value in the deck that `visible` does not account for. */
export function unseenCounts(edition: Edition, visible: readonly CardValue[]) {
  const counts: Partial<Record<CardValue, number>> = {};
  for (const value of DECKS[edition]) counts[value] = (counts[value] ?? 0) + 1;
  for (const value of visible) counts[value] = Math.max(0, (counts[value] ?? 0) - 1);
  return counts;
}
