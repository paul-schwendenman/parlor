import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const boggleMeta: GameMeta & { id: 'boggle' } = {
  id: 'boggle',
  name: 'Boggle',
  description: 'Race the timer to find words in a grid of letter cubes. Only words nobody else found score.',
  minPlayers: 2,
  maxPlayers: 8,
  estimatedMinutes: '10-15',
  tags: ['words', 'party'],
  displayModes: ['peer'],
  supportsBots: true,
};
