import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const heartsMeta: GameMeta & { id: 'hearts' } = {
  id: 'hearts',
  name: 'Hearts',
  description: 'Pass cards, follow suit, and dodge penalty points in this classic trick-taking game.',
  minPlayers: 4,
  maxPlayers: 4,
  estimatedMinutes: '25-40',
  tags: ['cards', 'classic', 'strategy'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
