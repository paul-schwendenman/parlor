import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ridgeRunMeta: GameMeta & { id: 'ridge-run' } = {
  id: 'ridge-run',
  name: 'Ridge Run',
  description: 'Pair dice to climb mountain routes and decide when to camp.',
  minPlayers: 2,
  maxPlayers: 4,
  minutes: { min: 15, max: 25 },
  kind: 'dice',
  weight: 'medium',
  format: 'individual',
  tags: ['push-your-luck'],
  displayModes: ['peer'],
  supportsBots: true,
};
