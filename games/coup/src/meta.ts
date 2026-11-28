import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const coupMeta: GameMeta & { id: 'coup' } = {
  id: 'coup',
  name: 'Coup',
  description: 'Claim any character, call out bluffs, and be the last with a secret left.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 10, max: 15 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['bluffing', 'deduction'],
  displayModes: ['peer'],
  supportsBots: true,
};
