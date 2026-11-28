import type { GameMeta } from '@parlor/game-types';

export const kingsCornerMeta: GameMeta & { id: 'kings-corner' } = {
  id: 'kings-corner',
  name: 'Kings Corner',
  description: 'Build descending sequences of alternating colors — be first to empty your hand.',
  minPlayers: 2,
  maxPlayers: 4,
  minutes: { min: 15, max: 25 },
  kind: 'cards',
  weight: 'light',
  format: 'individual',
  tags: ['shedding', 'classic'],
  displayModes: ['peer', 'jackbox'],
  supportsBots: true,
};
