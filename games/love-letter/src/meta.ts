import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const loveLetterMeta: GameMeta & { id: 'love-letter' } = {
  id: 'love-letter',
  name: 'Love Letter',
  description: 'Hold one secret card, draw a second, and play one. Knock rivals out or hold the highest card at the end.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 15, max: 25 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['deduction', 'family'],
  displayModes: ['peer'],
  supportsBots: true,
};
