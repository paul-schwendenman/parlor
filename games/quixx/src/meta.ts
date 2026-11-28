import type { GameMeta } from '@parlor/game-types';

export const quixxMeta: GameMeta & { id: 'quixx' } = {
  id: 'quixx',
  name: 'Quixx',
  description: 'A fast-paced dice game of marking numbers and strategic choices.',
  minPlayers: 2,
  maxPlayers: 5,
  minutes: { min: 15, max: 20 },
  kind: 'dice',
  weight: 'light',
  format: 'individual',
  tags: ['roll and write'],
  displayModes: ['peer'],
  supportsBots: true,
};
