import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const nightMarketMeta: GameMeta & { id: 'night-market' } = {
  id: 'night-market',
  name: 'Night Market',
  description: 'Draft goods, then sell for coins or display them to build a scoring stall.',
  minPlayers: 2,
  maxPlayers: 5,
  minutes: { min: 10, max: 20 },
  kind: 'cards',
  weight: 'medium',
  format: 'individual',
  tags: ['drafting', 'set collection'],
  displayModes: ['peer'],
  supportsBots: true,
};
