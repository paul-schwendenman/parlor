// Player types
export interface LiarsDicePlayer {
  id: string;
  name: string;
  connected: boolean;
  dice: number[];
  diceCount: number;
  eliminated: boolean;
  isAI: boolean;
}

export function createPlayer(id: string, name: string, isAI: boolean = false): LiarsDicePlayer {
  return {
    id,
    name,
    connected: true,
    dice: [],
    diceCount: 5,
    eliminated: false,
    isAI,
  };
}

// Bid type
export interface Bid {
  playerId: string;
  quantity: number;
  faceValue: number; // 1-6
}

// Game phases
export type LiarsDicePhase =
  | 'rolling'
  | 'bidding'
  | 'challenge'
  | 'spot-on'
  | 'round-result'
  | 'game-over';

// Challenge result
export interface ChallengeResult {
  challengerId: string;
  bidderId: string;
  bidWasCorrect: boolean;
  loserId: string;
  actualCount: number;
}

// Spot-on result
export interface SpotOnResult {
  callerId: string;
  wasExact: boolean;
  actualCount: number;
  losers: string[]; // player IDs who lose a die
}

// Log entries
export interface LogEntry {
  timestamp: number;
  playerId: string;
  message: string;
  type: 'bid' | 'challenge' | 'spot-on' | 'round' | 'elimination' | 'win';
}

// Full game state (server-side)
export interface LiarsDiceGameState {
  roomCode: string;
  players: LiarsDicePlayer[];
  activePlayerIndex: number;
  phase: LiarsDicePhase;
  currentBid: Bid | null;
  previousBidderId: string | null;
  totalDiceInPlay: number;
  round: number;
  gameOver: boolean;
  winner: string | null;
  wildOnes: boolean;
  spotOnEnabled: boolean;
  revealedDice: Record<string, number[]> | null;
  challengeResult: ChallengeResult | null;
  spotOnResult: SpotOnResult | null;
  gameLog: LogEntry[];
  bidHistory: Bid[];
}

// Player view (what gets sent to each client)
export interface LiarsDicePlayerView {
  players: {
    id: string;
    name: string;
    connected: boolean;
    diceCount: number;
    eliminated: boolean;
    dice: number[] | null; // only visible during reveal
  }[];
  myDice: number[];
  myIndex: number;
  activePlayerIndex: number;
  phase: LiarsDicePhase;
  currentBid: Bid | null;
  totalDiceInPlay: number;
  minimumBid: { quantity: number; faceValue: number } | null;
  canChallenge: boolean;
  canSpotOn: boolean;
  revealedDice: Record<string, number[]> | null;
  actualCount: number | null;
  challengeResult: ChallengeResult | null;
  spotOnResult: SpotOnResult | null;
  round: number;
  gameOver: boolean;
  winner: string | null;
  bidHistory: Bid[];
  gameLog: LogEntry[];
  isMyTurn: boolean;
}

// Actions
export type LiarsDiceAction =
  | { type: 'bid'; quantity: number; faceValue: number }
  | { type: 'challenge' }
  | { type: 'spot-on' }
  | { type: 'nextRound' };
