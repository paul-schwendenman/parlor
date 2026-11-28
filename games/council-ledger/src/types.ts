import type { Permit } from './rules.js';

export type CouncilAction =
  | { type: 'service'; turn: number }
  | { type: 'claim'; turn: number; permit: Permit }
  | { type: 'respond'; turn: number; challenge: boolean };

export interface CouncilView {
  phase: 'proposal' | 'response' | 'reveal' | 'game-over';
  turn: number;
  round: number;
  activePlayerId: string | null;
  deadline: number | null;
  players: { id: string; name: string; bot: boolean; connected: boolean; coins: number; standing: number; answered: boolean }[];
  myPermit: Permit | null;
  canRespond: boolean;
  claim: Permit | null;
  outcome: { accepted: boolean; challengerIds: string[]; shown: Permit | null } | null;
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'council-ledger': CouncilView }
  interface GameActionMap { 'council-ledger': CouncilAction }
}
