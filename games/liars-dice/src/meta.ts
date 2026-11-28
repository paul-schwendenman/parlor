import type { GameMeta } from '@parlor/game-types';

export const liarsDiceMeta: GameMeta & { id: 'liars-dice' } = {
  id: 'liars-dice',
  name: "Liar's Dice",
  description: 'Bluff, bid, and call out liars in this classic dice game.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '15-25',
  tags: ['dice', 'bluffing', 'classic'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
