import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const cantStopMeta: GameMeta & { id: 'cant-stop' } = {
  id: 'cant-stop',
  name: "Can't Stop",
  description: 'Pair four dice to push runners up eleven columns. Stop to lock in progress before you bust.',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '15-30',
  tags: ['dice', 'push-your-luck', 'family'],
  displayModes: ['peer'],
  supportsBots: true,
};
