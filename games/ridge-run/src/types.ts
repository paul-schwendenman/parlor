import type { Move, Progress, Route } from './rules.js';

export type RidgeAction = { type: 'roll' } | { type: 'climb'; route: Route } | { type: 'camp' };
export interface RidgeView {
  phase: 'ready' | 'choose' | 'bust' | 'camped' | 'game-over';
  activePlayerId: string | null;
  players: { id: string; name: string; bot: boolean; connected: boolean; progress: Progress; points: number }[];
  dice: number[];
  rollId: number;
  climb: Progress;
  moves: Move[];
  firstSummits: Partial<Record<Route, string>>;
  lastPoints: number;
  winnerId: string | null;
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'ridge-run': RidgeView }
  interface GameActionMap { 'ridge-run': RidgeAction }
}
