import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const spadesMeta: GameMeta & { id: 'spades' } = {
  id: 'spades',
  name: 'Spades',
  description: 'Bid with a partner, count your tricks, and make the most of your trump cards.',
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: '30-45',
  tags: ['cards', 'teams', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
