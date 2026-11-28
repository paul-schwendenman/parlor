import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const faultLineMeta: GameMeta & { id: 'fault-line' } = {
  id: 'fault-line',
  name: 'Fault Line',
  description: 'Post a bounty on a hidden cache, then decide which rival cache to open.',
  minPlayers: 3,
  maxPlayers: 6,
  minutes: { min: 8, max: 15 },
  kind: 'party',
  weight: 'light',
  format: 'individual',
  tags: ['bluffing', 'bounties'],
  displayModes: ['peer'],
  supportsBots: true,
};
