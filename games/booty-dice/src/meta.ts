import type { GameMeta } from '@parlor/game-types';

export const bootyDiceMeta: GameMeta & { id: 'booty-dice' } = {
  id: 'booty-dice',
  name: 'Booty Dice',
  description: 'A pirate dice game of treasure, attacks, and survival.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 15, max: 30 },
  kind: 'dice',
  weight: 'light',
  format: 'individual',
  tags: ['pirates', 'take that'],
  displayModes: ['peer'],
  supportsBots: true,
};
