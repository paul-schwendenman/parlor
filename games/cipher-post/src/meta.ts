import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const cipherPostMeta: GameMeta & { id: 'cipher-post' } = {
  id: 'cipher-post',
  name: 'Cipher Post',
  description: 'Pass a seal, reveal a clue, and deduce what your rivals kept.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '8-15',
  tags: ['cards', 'deduction'],
  displayModes: ['peer'],
  supportsBots: true,
};
