import type { Category, Scorecard } from './rules.js';

export type HarborAction = { type: 'roll'; held: number[] } | { type: 'score'; category: Category };
export interface HarborView {
  activePlayerId: string | null;
  phase: 'rolling' | 'scored' | 'game-over';
  dice: number[];
  rollsLeft: number;
  rollId: number;
  round: number;
  players: { id: string; name: string; bot: boolean; connected: boolean; scorecard: Scorecard; total: number }[];
  preview: Scorecard;
  lastScore: { category: Category; points: number } | null;
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'harbor-dice': HarborView }
  interface GameActionMap { 'harbor-dice': HarborAction }
}
