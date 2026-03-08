export type RowColor = 'red' | 'yellow' | 'green' | 'blue';

export const ROW_COLORS: RowColor[] = ['red', 'yellow', 'green', 'blue'];

export const ROW_NUMBERS: Record<RowColor, number[]> = {
  red: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  yellow: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  green: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  blue: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};

export interface Scoresheet {
  red: boolean[];
  yellow: boolean[];
  green: boolean[];
  blue: boolean[];
}

export interface DiceState {
  white1: number;
  white2: number;
  red: number;
  yellow: number;
  green: number;
  blue: number;
  rolled: boolean;
}

export type QuixxPhase = 'rolling' | 'phase1' | 'phase2' | 'turn-end' | 'game-over';

export interface Phase1Choice {
  type: 'mark';
  row: RowColor;
  cellIndex: number;
}

export interface Phase1Pass {
  type: 'pass';
}

export type Phase1Decision = Phase1Choice | Phase1Pass;

export interface QuixxPlayer {
  id: string;
  name: string;
  connected: boolean;
  isBot: boolean;
  sheet: Scoresheet;
  penalties: number;
  phase1Decision: Phase1Decision | null;
  lockedRows: RowColor[];
}

export interface QuixxGameState {
  roomCode: string;
  players: QuixxPlayer[];
  activePlayerIndex: number;
  dice: DiceState;
  lockedRows: RowColor[];
  removedDice: RowColor[];
  phase: QuixxPhase;
  round: number;
  gameOver: boolean;
}

export interface AvailableMove {
  row: RowColor;
  cellIndex: number;
  number: number;
  source: 'white-sum' | 'colored-combo';
  whitedie?: 'white1' | 'white2';
}

export interface QuixxPlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    isBot: boolean;
    sheet: Scoresheet;
    penalties: number;
    phase1Submitted: boolean;
    lockedRows: RowColor[];
  }[];
  activePlayerIndex: number;
  dice: DiceState;
  lockedRows: RowColor[];
  removedDice: RowColor[];
  phase: QuixxPhase;
  round: number;
  gameOver: boolean;
  scores: PlayerScore[] | null;
  myIndex: number;
  isActivePlayer: boolean;
  availableMoves: AvailableMove[];
  activePlayerPhase1Passed: boolean;
}

export interface PlayerScore {
  playerId: string;
  name: string;
  rowScores: Record<RowColor, number>;
  penalties: number;
  total: number;
}

export interface QuixxConfig {
  diceRolling: 'player' | 'auto';
  turnTimer: number | null;
  phase1Timer: number | null;
}

export const DEFAULT_CONFIG: QuixxConfig = {
  diceRolling: 'auto',
  turnTimer: null,
  phase1Timer: null,
};

export type QuixxAction =
  | { type: 'roll-dice' }
  | { type: 'phase1-mark'; row: RowColor; cellIndex: number }
  | { type: 'phase1-pass' }
  | { type: 'phase2-mark'; row: RowColor; cellIndex: number }
  | { type: 'phase2-pass' };
