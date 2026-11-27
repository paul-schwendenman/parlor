import type { Card, Suit } from '@parlor/cards';

export type EuchreAction =
  | { type: 'pass' }
  | { type: 'order-up'; alone: boolean }
  | { type: 'name-trump'; suit: Suit; alone: boolean }
  | { type: 'discard'; card: Card }
  | { type: 'play-card'; card: Card };

export type EuchrePhase = 'order-up' | 'name-trump' | 'discard' | 'playing' | 'trick-won' | 'round-scoring' | 'game-over';
export type Team = 0 | 1;

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface RoundResult {
  team: Team;
  points: number;
  outcome: 'made' | 'march' | 'euchred' | 'lone-march';
}

export interface EuchreView {
  phase: EuchrePhase;
  round: number;
  trickNumber: number;
  dealerId: string;
  activePlayerId: string | null;
  players: { id: string; name: string; team: Team; sittingOut: boolean }[];
  teams: [number, number];
  tricks: [number, number];
  goal: number;
  trump: Suit | null;
  makerId: string | null;
  lonerId: string | null;
  upCard: Card | null;
  turnedSuit: Suit;
  trick: TrickPlay[];
  trickWinnerId: string | null;
  result: RoundResult | null;
  winningTeam: Team | null;
  myHand: Card[];
  playableCards: Card[];
  canPass: boolean;
}

declare module '@parlor/game-types' {
  interface GameViewMap { euchre: EuchreView }
  interface GameActionMap { euchre: EuchreAction }
}
