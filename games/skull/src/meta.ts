import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const skullMeta: GameMeta & { id: 'skull' } = {
  id: 'skull',
  name: 'Skull',
  description: 'Stack flowers and one skull face down, then bid on how many flowers you can turn over.',
  minPlayers: 3,
  maxPlayers: 6,
  minutes: { min: 15, max: 30 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['bluffing', 'bidding'],
  displayModes: ['peer'],
  supportsBots: true,
};
