import type { GameMeta } from '@parlor/game-types';

export const quixxMeta: GameMeta & { id: 'quixx' } = {
  id: 'quixx',
  name: 'Quixx',
  description: 'A fast-paced dice game of marking numbers and strategic choices.',
  minPlayers: 2,
  maxPlayers: 5,
  estimatedMinutes: '15-20',
  tags: ['dice', 'strategy', 'quick'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
