export type BogglePhase = 'playing' | 'reveal' | 'game-over';

export interface BoggleResult {
  word: string;
  playerIds: string[];
  points: number;
}

export interface BoggleView {
  phase: BogglePhase;
  round: number;
  rounds: number;
  grid: string[];
  /** Milliseconds left in the current phase when this view was built. */
  endsInMs: number;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    done: boolean;
    wordCount: number;
    roundScore: number;
    score: number;
  }[];
  results: BoggleResult[];
  /** The best words nobody found, once the round is over. */
  missed: string[];
  myWords: string[];
  canSubmit: boolean;
  winnerIds: string[];
}

export type BoggleAction =
  | { type: 'submit'; round: number; word: string }
  | { type: 'remove'; round: number; word: string }
  | { type: 'done'; round: number; done: boolean };

declare module '@parlor/game-types' {
  interface GameViewMap { boggle: BoggleView }
  interface GameActionMap { boggle: BoggleAction }
}
