import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const nightMarketMeta: GameMeta & { id: 'night-market' } = {
  id: 'night-market',
  name: 'Night Market',
  description: 'Draft goods, then sell for coins or display them to build a scoring stall.',
  minPlayers: 2,
  maxPlayers: 5,
  estimatedMinutes: '10-20',
  tags: ['cards', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
