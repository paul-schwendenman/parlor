import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ridgeRunMeta: GameMeta & { id: 'ridge-run' } = {
  id: 'ridge-run',
  name: 'Ridge Run',
  description: 'Pair dice to climb mountain routes and decide when to camp.',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '15-25',
  tags: ['dice', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
