export type FarkleAction =
  | { type: 'roll' }
  | { type: 'keep'; indices: number[] }
  | { type: 'bank' };

export interface FarkleView {
  phase: 'ready' | 'selecting' | 'bust' | 'banked' | 'game-over';
  players: { id: string; name: string; bot: boolean; connected: boolean; out: boolean; score: number }[];
  activePlayerId: string;
  dice: number[];
  rollNumber: number;
  diceToRoll: number;
  kept: { dice: number[]; points: number }[];
  turnScore: number;
  canBank: boolean;
  finalRound: boolean;
}

declare module '@parlor/game-types' {
  interface GameViewMap { farkle: FarkleView }
  interface GameActionMap { farkle: FarkleAction }
}
