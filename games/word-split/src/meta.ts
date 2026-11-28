import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const wordSplitMeta: GameMeta & { id: 'word-split' } = {
  id: 'word-split',
  name: 'Word Split',
  description: 'Build words from shared letters. Only words you find on your own score.',
  minPlayers: 2,
  maxPlayers: 8,
  minutes: { min: 4, max: 6 },
  kind: 'word',
  weight: 'light',
  format: 'individual',
  tags: ['spelling', 'anagrams', 'unique answers'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: false,
};
