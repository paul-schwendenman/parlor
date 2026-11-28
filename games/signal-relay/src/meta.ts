import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const signalRelayMeta: GameMeta & { id: 'signal-relay' } = {
  id: 'signal-relay',
  name: 'Signal Relay',
  description: 'Work together to route private signals through two shared antennas.',
  minPlayers: 2,
  maxPlayers: 4,
  minutes: { min: 3, max: 6 },
  kind: 'cards',
  weight: 'light',
  format: 'coop',
  tags: ['communication'],
  displayModes: ['peer'],
  supportsBots: true,
};
