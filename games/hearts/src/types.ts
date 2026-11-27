import type { Card } from '@parlor/cards';

export type PassDirection = 'left' | 'right' | 'across' | 'hold';
export type HeartsPhase = 'passing' | 'playing' | 'trick-won' | 'round-scoring' | 'game-over';

export type HeartsAction =
  | { type: 'pass-cards'; cards: Card[] }
  | { type: 'play-card'; card: Card };

export interface TrickPlay {
  playerId: string;
  card: Card;
}

export interface HeartsView {
  phase: HeartsPhase;
  round: number;
  trickNumber: number;
  passDirection: PassDirection;
  goal: number;
  heartsBroken: boolean;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    cardCount: number;
    passed: boolean;
    roundScore: number;
    totalScore: number;
  }[];
  activePlayerId: string | null;
  trick: TrickPlay[];
  trickWinnerId: string | null;
  moonShooterId: string | null;
  winnerIds: string[];
  myHand: Card[];
  receivedCards: Card[];
  playableCards: Card[];
  canPass: boolean;
}

declare module '@parlor/game-types' {
  interface GameViewMap {
    hearts: HeartsView;
  }
  interface GameActionMap {
    hearts: HeartsAction;
  }
}
