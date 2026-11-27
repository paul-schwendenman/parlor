import type { GameMeta } from '@parlor/game-types';

export const crazyEightsMeta: GameMeta & { id: 'crazy-eights' } = {
  id: 'crazy-eights',
  name: 'Crazy Eights',
  description: 'Classic card game — match suits or ranks, play eights to change the suit.',
  minPlayers: 2,
  maxPlayers: 5,
  estimatedMinutes: '10-15',
  tags: ['cards', 'classic', 'quick'],
  displayModes: ['peer'],
  supportsBots: true,
};
