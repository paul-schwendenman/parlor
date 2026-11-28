import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ginRummyMeta: GameMeta & { id: 'gin-rummy' } = {
  id: 'gin-rummy',
  name: 'Gin Rummy',
  description: 'Build sets and runs, then knock when you have little deadwood left.',
  minPlayers: 2,
  maxPlayers: 2,
  estimatedMinutes: '20-40',
  tags: ['cards', 'classic', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
