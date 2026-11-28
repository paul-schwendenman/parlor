import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const golfMeta: GameMeta & { id: 'golf' } = {
  id: 'golf',
  name: 'Golf',
  description: 'Swap cards and match columns to finish nine holes with the lowest score.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 20, max: 30 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['classic', 'family'],
  displayModes: ['peer'],
  supportsBots: true,
};
