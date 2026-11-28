import type { Reward } from './rules.js';

export type MindPhase = 'focus' | 'breath' | 'playing' | 'star-vote' | 'mistake' | 'star-reveal' | 'level-complete' | 'game-over';

export type MindEvent =
  | { kind: 'mistake'; playerId: string; card: number; livesLost: number; discarded: { playerId: string; cards: number[] }[] }
  | { kind: 'star'; discarded: { playerId: string; card: number | null }[] }
  | { kind: 'star-declined'; byId: string | null }
  | { kind: 'stop'; byId: string }
  | { kind: 'level-complete'; level: number; reward: Reward | null; wasted: boolean }
  | { kind: 'paused'; waitingForId: string };

export interface MindView {
  phase: MindPhase;
  phaseEndsInMs: number | null;
  level: number;
  totalLevels: number;
  lives: number;
  stars: number;
  maxLives: number;
  maxStars: number;
  nextReward: { level: number; reward: Reward } | null;
  pile: { top: number | null; count: number; recent: number[] };
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    standIn: boolean;
    cardCount: number;
    ready: boolean;
    vote: 'yes' | 'no' | null;
  }[];
  starVote: { proposerId: string; endsInMs: number } | null;
  lastEvent: MindEvent | null;
  outcome: 'won' | 'lost' | null;
  levelsCleared: number;
  myHand: number[];
  myInFlight: number[];
  myReturned: number[];
  nextCard: number | null;
  canPlay: boolean;
  canReady: boolean;
  canStop: boolean;
  canProposeStar: boolean;
  canVote: boolean;
}

export type MindAction =
  | { type: 'play'; card: number }
  | { type: 'ready'; ready: boolean }
  | { type: 'stop' }
  | { type: 'propose-star' }
  | { type: 'vote-star'; agree: boolean };

declare module '@parlor/game-types' {
  interface GameViewMap { 'the-mind': MindView }
  interface GameActionMap { 'the-mind': MindAction }
}
