import type { Category, Scorecard, ScoreOption, YahtzeeOptions } from './rules.js';

export interface LastScore {
  playerId: string;
  category: Category;
  points: number;
  bonus: boolean;
  joker: boolean;
  upperBonusEarned: boolean;
}

export interface YahtzeePlayerView {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  card: Scorecard;
  yahtzeeBonuses: number;
  upper: number;
  upperBonus: number;
  upperNeeded: number;
  lower: number;
  total: number;
}

export interface YahtzeeView {
  phase: 'turn' | 'scored' | 'game-over';
  round: number;
  totalRounds: number;
  players: YahtzeePlayerView[];
  activePlayerId: string | null;
  myId: string | null;
  dice: number[] | null;
  held: boolean[];
  rollId: number;
  rollsUsed: number;
  rollsLeft: number;
  scoreOptions: ScoreOption[];
  yahtzeeRoll: { bonus: boolean; joker: boolean; forced: Category | null } | null;
  canRoll: boolean;
  canScore: boolean;
  lastScore: LastScore | null;
  options: YahtzeeOptions;
  winnerIds: string[];
}

export type YahtzeeAction =
  | { type: 'hold'; held: boolean[] }
  | { type: 'roll' }
  | { type: 'score'; category: Category };

declare module '@parlor/game-types' {
  interface GameViewMap { yahtzee: YahtzeeView }
  interface GameActionMap { yahtzee: YahtzeeAction }
}
