import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const theMindMeta: GameMeta & { id: 'the-mind' } = {
  id: 'the-mind',
  name: 'The Mind',
  description: 'Play your numbers low to high together, without a word.',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '15-25',
  tags: ['cards', 'cooperative', 'party'],
  displayModes: ['peer'],
  supportsBots: true,
};
