import type { Card } from '@parlor/cards';

export type GolfPhase = 'setup' | 'turn' | 'drawn' | 'flip' | 'hole-scoring' | 'game-over';

export interface GolfOptions {
  holes: number;
  finalTurns: boolean;
  flipOnDiscard: boolean;
  fourOfAKind: boolean;
}

export type GolfAction =
  | { type: 'draw-stock' }
  | { type: 'discard-drawn' }
  | { type: 'reveal'; slot: number }
  | { type: 'take-discard'; slot: number }
  | { type: 'swap-drawn'; slot: number }
  | { type: 'flip'; slot: number };

export interface GolfView {
  phase: GolfPhase;
  hole: number;
  holes: number;
  dealerId: string;
  activePlayerId: string | null;
  wentOutId: string | null;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    grid: (Card | null)[];
    showing: number;
    holeScores: number[];
    total: number;
    setupDone: boolean;
  }[];
  stockCount: number;
  discardTop: Card | null;
  drawn: Card | null;
  setupFlipsLeft: number;
  canDrawStock: boolean;
  canTakeDiscard: boolean;
  canDiscardDrawn: boolean;
  targetSlots: number[];
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { golf: GolfView }
  interface GameActionMap { golf: GolfAction }
}
