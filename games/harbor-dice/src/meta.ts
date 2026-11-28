import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const harborDiceMeta: GameMeta & { id: 'harbor-dice' } = {
  id: 'harbor-dice',
  name: 'Harbor Dice',
  description: 'Hold and reroll five dice to fill a ten-category scorecard.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '15-25',
  tags: ['dice', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
