import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const euchreMeta: GameMeta & { id: 'euchre' } = {
  id: 'euchre',
  name: 'Euchre',
  description: 'Call trump with a partner, play the bowers, and take three tricks to make your hand.',
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: '20-35',
  tags: ['cards', 'teams', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
