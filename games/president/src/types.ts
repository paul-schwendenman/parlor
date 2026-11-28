import type { Card, Rank } from '@parlor/cards';

export type PresidentPhase = 'exchange' | 'playing' | 'trick-cleared' | 'hand-scoring' | 'game-over';
export type Title = 'President' | 'Vice President' | 'Citizen' | 'Vice Peasant' | 'Peasant';

export interface PresidentOptions {
  target: number;
  firstLead: 'left-of-dealer' | 'three-of-clubs';
  exchange: 'one' | 'two';
  passIsOut: boolean;
  twoClears: boolean;
  revolution: boolean;
}

export type PresidentAction =
  | { type: 'play'; cards: Card[] }
  | { type: 'return-cards'; cards: Card[] }
  | { type: 'pass' };

export interface Play { playerId: string; cards: Card[] }
export interface LegalPlay { rank: Rank; counts: number[] }

export interface PresidentView {
  phase: PresidentPhase;
  hand: number;
  target: number;
  reversed: boolean;
  activePlayerId: string | null;
  players: {
    id: string; name: string; bot: boolean; connected: boolean;
    cardCount: number; score: number; title: Title | null; finishedAt: number | null; passed: boolean;
  }[];
  trick: Play[];
  myHand: Card[];
  received: Card[];
  legalPlays: LegalPlay[];
  requiredCard: Card | null;
  canPass: boolean;
  mustReturn: number;
  exchanges: { from: string; to: string; count: number }[];
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { president: PresidentView }
  interface GameActionMap { president: PresidentAction }
}
