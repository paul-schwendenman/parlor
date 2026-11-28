import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const yahtzeeMeta: GameMeta & { id: 'yahtzee' } = {
  id: 'yahtzee',
  name: 'Yahtzee',
  description: 'Roll five dice up to three times and fill a 13-box scorecard. Most points wins.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '15-35',
  tags: ['dice', 'classic', 'family'],
  displayModes: ['peer'],
  supportsBots: true,
};
