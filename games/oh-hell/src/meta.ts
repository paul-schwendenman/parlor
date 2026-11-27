import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ohHellMeta: GameMeta & { id: 'oh-hell' } = {
  id: 'oh-hell',
  name: 'Oh Hell',
  description: 'Predict how many tricks you’ll take, then hit your bid exactly as the hands grow and shrink.',
  minPlayers: 3,
  maxPlayers: 6,
  estimatedMinutes: '15-30',
  tags: ['cards', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
