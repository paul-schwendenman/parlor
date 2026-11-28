import type { Card } from '@parlor/cards';
import type { Arrangement, Layoff, Meld } from '@parlor/cards/melds';

export type GinPhase = 'upcard' | 'draw' | 'discard' | 'hand-scoring' | 'game-over';

export interface GinOptions {
  target: number;
  knockLimit: number | 'oklahoma';
  ginBonus: number;
  undercutBonus: number;
  bigGin: boolean;
  boxBonus: boolean;
}

export type GinAction =
  | { type: 'take-discard' }
  | { type: 'pass-upcard' }
  | { type: 'draw-stock' }
  | { type: 'discard'; card: Card }
  | { type: 'knock'; card: Card }
  | { type: 'big-gin' };

export interface HandResult {
  outcome: 'knock' | 'gin' | 'big-gin' | 'undercut' | 'void';
  knockerId: string | null;
  winnerId: string | null;
  points: number;
  knocker: Arrangement | null;
  defender: (Arrangement & { layoffs: Layoff[] }) | null;
}

export interface GinView {
  phase: GinPhase;
  handNumber: number;
  target: number;
  knockLimit: number;
  doubled: boolean;
  dealerId: string;
  activePlayerId: string | null;
  players: { id: string; name: string; bot: boolean; connected: boolean; cardCount: number; score: number; handsWon: number }[];
  stockCount: number;
  discardTop: Card | null;
  discardCount: number;
  myHand: Card[];
  myMelds: Meld[];
  myDeadwood: number;
  canTakeDiscard: boolean;
  canDrawStock: boolean;
  canPassUpcard: boolean;
  discardable: Card[];
  knockable: Card[];
  canBigGin: boolean;
  opponentTook: Card[];
  lastResult: HandResult | null;
  final: { id: string; hand: number; box: number; game: number; total: number }[] | null;
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'gin-rummy': GinView }
  interface GameActionMap { 'gin-rummy': GinAction }
}
