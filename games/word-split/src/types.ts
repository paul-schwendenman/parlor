export type WordSplitAction =
  | { type: 'submit'; round: number; word: string }
  | { type: 'finish'; round: number };

export interface WordSplitView {
  phase: 'writing' | 'reveal' | 'game-over';
  round: number;
  totalRounds: number;
  letters: string[];
  deadline: number;
  serverNow: number;
  players: { id: string; name: string; connected: boolean; ready: boolean; score: number }[];
  myWords: string[];
  canWrite: boolean;
  results: { word: string; playerIds: string[]; points: number }[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'word-split': WordSplitView }
  interface GameActionMap { 'word-split': WordSplitAction }
}
