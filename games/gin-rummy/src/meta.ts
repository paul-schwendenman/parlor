import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ginRummyMeta: GameMeta & { id: 'gin-rummy' } = {
  id: 'gin-rummy',
  name: 'Gin Rummy',
  description: 'Build sets and runs, then knock when you have little deadwood left.',
  minPlayers: 2,
  maxPlayers: 2,
  minutes: { min: 20, max: 40 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['classic', 'melding'],
  displayModes: ['peer'],
  supportsBots: true,
};
