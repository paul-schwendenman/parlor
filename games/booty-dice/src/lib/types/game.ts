// Dice types
export type DiceFace =
  | 'doubloon'
  | 'x_marks_spot'
  | 'jolly_roger'
  | 'cutlass'
  | 'walk_plank'
  | 'shield';

export interface Die {
  id: number;
  face: DiceFace;
  locked: boolean;
  rolling: boolean;
}

export type ComboType = 'mutiny' | 'shipwreck' | 'blackbeards_curse' | null;

export interface DiceResult {
  dice: Die[];
  combo: ComboType;
  bonusCount: number;
}

export const DICE_FACES: DiceFace[] = [
  'doubloon',
  'x_marks_spot',
  'jolly_roger',
  'cutlass',
  'walk_plank',
  'shield',
];

export const FACE_NAMES: Record<DiceFace, string> = {
  doubloon: 'Doubloon',
  x_marks_spot: 'X Marks the Spot',
  jolly_roger: 'Jolly Roger',
  cutlass: 'Cutlass',
  walk_plank: 'Walk the Plank',
  shield: 'Shield',
};

export const FACE_EMOJI: Record<DiceFace, string> = {
  doubloon: '\u{1FA99}',
  x_marks_spot: '\u274C',
  jolly_roger: '\u2620\uFE0F',
  cutlass: '\u2694\uFE0F',
  walk_plank: '\u{1F30A}',
  shield: '\u{1F6E1}\uFE0F',
};

// Player types
export interface BootyDicePlayer {
  id: string;
  name: string;
  doubloons: number;
  lives: number;
  shields: number;
  isAI: boolean;
  isConnected: boolean;
  isEliminated: boolean;
}

export interface PlayerAction {
  type: 'attack' | 'steal';
  targetPlayerId: string;
}

export function createPlayer(id: string, name: string, isAI: boolean = false): BootyDicePlayer {
  return {
    id,
    name,
    doubloons: 5,
    lives: 10,
    shields: 0,
    isAI,
    isConnected: true,
    isEliminated: false,
  };
}

// Game state types
export type GamePhase = 'waiting' | 'playing' | 'ended';

export type TurnPhase = 'rolling' | 'selecting_targets' | 'resolving';

export interface PendingAction {
  dieIndex: number;
  face: 'cutlass' | 'jolly_roger';
  resolved: boolean;
  targetPlayerId?: string;
}

export interface LogEntry {
  timestamp: number;
  playerId: string;
  message: string;
  type: 'roll' | 'action' | 'combo' | 'elimination' | 'win' | 'summary';
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: BootyDicePlayer[];
  currentPlayerIndex: number;
  turnNumber: number;
  rollsRemaining: number;
  dice: Die[];
  turnPhase: TurnPhase;
  pendingActions: PendingAction[];
  gameLog: LogEntry[];
  winnerId: string | null;
}

export interface ResolvedEffect {
  type: 'damage' | 'coins_lost' | 'coins_gained' | 'shield_gained' | 'life_lost' | 'stolen';
  targetId: string;
  sourceId?: string;
  amount: number;
  description: string;
}

export interface TurnResolution {
  effects: ResolvedEffect[];
  eliminations: string[];
  winner: string | null;
}

// Player view type for game:state broadcasts
export interface BootyDicePlayerView {
  roomCode: string;
  phase: GamePhase;
  players: BootyDicePlayer[];
  currentPlayerIndex: number;
  turnNumber: number;
  rollsRemaining: number;
  dice: Die[];
  turnPhase: TurnPhase;
  pendingActions: PendingAction[];
  gameLog: LogEntry[];
  winnerId: string | null;
  myIndex: number;
  isMyTurn: boolean;
}

// Action types for game:action events
export type BootyDiceAction =
  | { type: 'roll' }
  | { type: 'lockDice'; diceIndices: number[] }
  | { type: 'finishRolling' }
  | { type: 'selectTarget'; dieIndex: number; targetPlayerId: string }
  | { type: 'endTurn' };
