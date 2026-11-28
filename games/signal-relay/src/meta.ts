import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const signalRelayMeta: GameMeta & { id: 'signal-relay' } = {
  id: 'signal-relay',
  name: 'Signal Relay',
  description: 'Work together to route private signals through two shared antennas.',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '3-6',
  tags: ['cards', 'cooperative'],
  displayModes: ['peer'],
  supportsBots: true,
};
