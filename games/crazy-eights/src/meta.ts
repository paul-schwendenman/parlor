import type { GameMeta } from '@parlor/game-types';

export const crazyEightsMeta: GameMeta & { id: 'crazy-eights' } = {
  id: 'crazy-eights',
  name: 'Crazy Eights',
  description: 'Classic card game — match suits or ranks, play eights to change the suit.',
  minPlayers: 2,
  maxPlayers: 5,
  minutes: { min: 10, max: 15 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['shedding', 'classic'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
