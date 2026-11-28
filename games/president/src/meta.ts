import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const presidentMeta: GameMeta & { id: 'president' } = {
  id: 'president',
  name: 'President',
  description: 'Beat the current play with a higher set and empty your hand first.',
  minPlayers: 4,
  maxPlayers: 7,
  estimatedMinutes: '30-45',
  tags: ['cards', 'classic', 'party'],
  displayModes: ['peer'],
  supportsBots: true,
};
