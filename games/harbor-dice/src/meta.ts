import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const harborDiceMeta: GameMeta & { id: 'harbor-dice' } = {
  id: 'harbor-dice',
  name: 'Harbor Dice',
  description: 'Hold and reroll five dice to fill a ten-category scorecard.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 15, max: 25 },
  kind: 'dice',
  weight: 'light',
  format: 'individual',
  tags: ['rerolling', 'scorecard'],
  displayModes: ['peer'],
  supportsBots: true,
};
