import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const ohHellMeta: GameMeta & { id: 'oh-hell' } = {
  id: 'oh-hell',
  name: 'Oh Hell',
  description: 'Predict how many tricks you’ll take, then hit your bid exactly as the hands grow and shrink.',
  minPlayers: 3,
  maxPlayers: 6,
  minutes: { min: 15, max: 30 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['trick-taking', 'bidding'],
  displayModes: ['peer'],
  supportsBots: true,
};
