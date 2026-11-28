export interface FarkleRules {
  target: 5000 | 10000 | 15000;
  opening: 0 | 350 | 500 | 1000;
  threeOnes: 1000 | 300;
  multiples: 'fixed' | 'doubling' | 'adding';
  threePairs: 1500 | 1000 | 750 | 0;
  fourAndPair: 1500 | 0;
  straight: 1500 | 1000 | 2500;
  twoTriplets: 2500 | 0;
  sixDiceNothing: 0 | 500;
  hotDice: 'may-bank' | 'must-roll';
  threeFarkles: 0 | 500 | 1000;
  ending: 'final-round' | 'first-to-target';
}

export type FarkleAction =
  | { type: 'roll' }
  | { type: 'keep'; indices: number[] }
  | { type: 'bank' };

export interface FarkleView {
  phase: 'ready' | 'selecting' | 'bust' | 'banked' | 'game-over';
  rules: FarkleRules;
  players: { id: string; name: string; bot: boolean; connected: boolean; out: boolean; score: number; onBoard: boolean; farkles: number }[];
  penalty: number;
  winnerIds: string[];
  activePlayerId: string;
  nextPlayerId: string | null;
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
