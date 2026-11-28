import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const sushiGoMeta: GameMeta & { id: 'sushi-go' } = {
  id: 'sushi-go',
  name: 'Sushi Go',
  description: 'Everyone picks a sushi card at once and passes the rest. Build sets over three rounds.',
  minPlayers: 2,
  maxPlayers: 5,
  minutes: { min: 15, max: 20 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['drafting', 'family'],
  displayModes: ['peer'],
  supportsBots: true,
};
