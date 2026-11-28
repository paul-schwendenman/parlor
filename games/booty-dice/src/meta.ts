import type { GameMeta } from '@parlor/game-types';

export const bootyDiceMeta: GameMeta & { id: 'booty-dice' } = {
  id: 'booty-dice',
  name: 'Booty Dice',
  description: 'A pirate dice game of treasure, attacks, and survival.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '15-30',
  tags: ['dice', 'pirates', 'competitive'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
