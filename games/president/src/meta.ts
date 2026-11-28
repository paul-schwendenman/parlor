import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const presidentMeta: GameMeta & { id: 'president' } = {
  id: 'president',
  name: 'President',
  description: 'Beat the current play with a higher set and empty your hand first.',
  minPlayers: 4,
  maxPlayers: 7,
  minutes: { min: 30, max: 45 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['classic', 'shedding'],
  displayModes: ['peer'],
  supportsBots: true,
};
