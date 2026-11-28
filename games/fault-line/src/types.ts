import type { Cache } from './rules.js';

export type FaultAction =
  | { type: 'plant'; round: number; cache: Cache; bounty: number }
  | { type: 'open'; round: number; target: string | null };

export interface FaultPlayer {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  score: number;
  chips: number;
  bounty: number | null;
  ready: boolean;
  history: Cache[];
}

export interface FaultView {
  phase: 'plant' | 'open' | 'reveal' | 'game-over';
  round: number;
  players: FaultPlayer[];
  myHand: Cache[];
  myCache: Cache | null;
  myTarget: string | null;
  last: { id: string; cache: Cache; target: string | null; points: number }[];
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'fault-line': FaultView }
  interface GameActionMap { 'fault-line': FaultAction }
}
