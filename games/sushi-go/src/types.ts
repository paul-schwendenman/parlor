import type { PlateCard, RoundScore, SushiCard } from './rules.js';

export type SushiGoPhase = 'picking' | 'reveal' | 'round-scoring' | 'game-over';

export interface SushiGoPlayerView {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  removed: boolean;
  handCount: number;
  locked: boolean;
  plate: PlateCard[];
  puddings: number;
  roundScores: RoundScore[];
  puddingScore: number | null;
  total: number;
  revealed: number[];
  usedChopsticks: boolean;
}

export interface SushiGoView {
  phase: SushiGoPhase;
  round: number;
  rounds: number;
  pick: number;
  handSize: number;
  players: SushiGoPlayerView[];
  winnerIds: string[];
  myHand: SushiCard[];
  myPick: number[] | null;
  pickedForMe: boolean;
  canPick: boolean;
  canUseChopsticks: boolean;
}

export type SushiGoAction = { type: 'pick'; cardIds: number[] } | { type: 'unpick' };

declare module '@parlor/game-types' {
  interface GameViewMap { 'sushi-go': SushiGoView }
  interface GameActionMap { 'sushi-go': SushiGoAction }
}
