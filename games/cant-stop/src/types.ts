import type { Column, ColumnMap, Move, PairingOption } from './rules.js';

export type CantStopPhase = 'first-roll' | 'choosing' | 'deciding' | 'busted' | 'game-over';
export type CantStopAction = { type: 'roll' } | { type: 'place'; columns: Move } | { type: 'stop' };

export interface CantStopPlayerView {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  seat: number;
  markers: ColumnMap<number>;
  claimed: Column[];
}

export interface CantStopView {
  phase: CantStopPhase;
  goal: number;
  players: CantStopPlayerView[];
  activePlayerId: string | null;
  claimedBy: ColumnMap<string>;
  runners: ColumnMap<number>;
  dice: number[] | null;
  rollId: number;
  pairings: PairingOption[] | null;
  lastMove: Move | null;
  canAct: boolean;
  canStop: boolean;
  stopWins: boolean;
  certainBust: boolean;
  winnerId: string | null;
  turn: number;
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'cant-stop': CantStopView }
  interface GameActionMap { 'cant-stop': CantStopAction }
}
