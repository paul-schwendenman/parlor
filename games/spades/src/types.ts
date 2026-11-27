import type { Card } from '@parlor/cards';

export type SpadesAction = { type: 'bid'; amount: number } | { type: 'play-card'; card: Card };
export type SpadesPhase = 'bidding' | 'playing' | 'trick-won' | 'round-scoring' | 'game-over';
export type TeamIndex = 0 | 1;

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface RoundScore {
  bidPoints: number;
  bagPoints: number;
  nilPoints: number;
  bagPenalty: number;
  total: number;
  bags: number;
}

export interface SpadesView {
  phase: SpadesPhase;
  round: number;
  trickNumber: number;
  spadesBroken: boolean;
  goal: number;
  dealerId: string;
  activePlayerId: string | null;
  trickWinnerId: string | null;
  winningTeam: TeamIndex | null;
  trick: TrickPlay[];
  players: {
    id: string;
    name: string;
    team: TeamIndex;
    bid: number | null;
    tricks: number;
  }[];
  teams: {
    team: TeamIndex;
    score: number;
    bags: number;
    bid: number | null;
    tricks: number;
    roundScore: RoundScore | null;
  }[];
  myHand: Card[];
  playableCards: Card[];
}

declare module '@parlor/game-types' {
  interface GameViewMap {
    spades: SpadesView;
  }
  interface GameActionMap {
    spades: SpadesAction;
  }
}
