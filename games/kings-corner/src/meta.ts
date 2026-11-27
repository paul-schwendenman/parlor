import type { GameMeta } from '@parlor/game-types';

export const kingsCornerMeta: GameMeta & { id: 'kings-corner' } = {
  id: 'kings-corner',
  name: 'Kings Corner',
  description: 'Build descending sequences of alternating colors — be first to empty your hand.',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '15-25',
  tags: ['cards', 'classic', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
