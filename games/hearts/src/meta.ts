import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const heartsMeta: GameMeta & { id: 'hearts' } = {
  id: 'hearts',
  name: 'Hearts',
  description: 'Pass cards, follow suit, and dodge penalty points in this classic trick-taking game.',
  minPlayers: 4,
  maxPlayers: 4,
  minutes: { min: 25, max: 40 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['trick-taking', 'passing', 'classic'],
  displayModes: ['peer'],
  supportsBots: true,
};
