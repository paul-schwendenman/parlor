import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const councilLedgerMeta: GameMeta & { id: 'council-ledger' } = {
  id: 'council-ledger',
  name: 'Council Ledger',
  description: 'Claim permits to gain standing. Challenge a rival if you think they are bluffing.',
  minPlayers: 2,
  maxPlayers: 6,
  minutes: { min: 10, max: 20 },
  kind: 'party',
  weight: 'medium',
  format: 'individual',
  tags: ['bluffing', 'resource management'],
  displayModes: ['peer'],
  supportsBots: true,
};
