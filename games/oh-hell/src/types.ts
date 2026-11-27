import type { Card } from '@parlor/cards';

export type OhHellAction = { type: 'bid'; tricks: number } | { type: 'play-card'; card: Card };
export type OhHellPhase = 'bidding' | 'playing' | 'trick-won' | 'round-scoring' | 'game-over';

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface OhHellView {
  phase: OhHellPhase;
  round: number;
  rounds: number;
  handSize: number;
  dealerId: string;
  activePlayerId: string | null;
  trumpCard: Card;
  trick: TrickPlay[];
  trickWinnerId: string | null;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    bid: number | null;
    tricks: number;
    score: number;
    roundPoints: number | null;
  }[];
  winnerIds: string[];
  myHand: Card[];
  playableCards: Card[];
  legalBids: number[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'oh-hell': OhHellView }
  interface GameActionMap { 'oh-hell': OhHellAction }
}
