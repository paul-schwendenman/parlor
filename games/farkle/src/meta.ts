import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const farkleMeta: GameMeta & { id: 'farkle' } = {
  id: 'farkle',
  name: 'Farkle',
  description: 'Set aside scoring dice and decide when to bank before a bad roll costs you the turn.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '15-30',
  tags: ['dice', 'classic'],
  displayModes: ['peer'],
  supportsBots: true,
};
