import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const farkleMeta: GameMeta & { id: 'farkle' } = {
  id: 'farkle',
  name: 'Farkle',
  description: 'Set aside scoring dice and decide when to bank before a bad roll costs you the turn.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 15, max: 30 },
  kind: 'dice',
  weight: 'light',
  format: 'individual',
  tags: ['push your luck', 'classic'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
