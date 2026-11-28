import type { GameMeta } from '@parlor/game-types';
import type {} from './types.js';

export const councilLedgerMeta: GameMeta & { id: 'council-ledger' } = {
  id: 'council-ledger',
  name: 'Council Ledger',
  description: 'Claim permits to gain standing. Challenge a rival if you think they are bluffing.',
  minPlayers: 2,
  maxPlayers: 6,
  estimatedMinutes: '10-20',
  tags: ['bluffing', 'strategy'],
  displayModes: ['peer'],
  supportsBots: true,
};
