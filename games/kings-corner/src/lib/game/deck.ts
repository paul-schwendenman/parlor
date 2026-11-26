import type { Card } from '../types/game.js';
import { SUITS, RANKS } from '../types/game.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}
