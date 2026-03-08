export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type CrazyEightsPhase = 'playing' | 'choosing-suit' | 'game-over';

export type CrazyEightsAction =
  | { type: 'play-card'; card: Card }
  | { type: 'draw-card' }
  | { type: 'pass' }
  | { type: 'choose-suit'; suit: Suit };

export interface CrazyEightsPlayerInfo {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
}

export interface CrazyEightsPlayerView {
  myHand: Card[];
  players: CrazyEightsPlayerInfo[];
  myIndex: number;
  activePlayerIndex: number;
  isActivePlayer: boolean;
  topDiscard: Card | null;
  declaredSuit: Suit | null;
  drawPileCount: number;
  playableCards: Card[];
  canDraw: boolean;
  canPass: boolean;
  drewCard: Card | null;
  phase: CrazyEightsPhase;
  winner: { id: string; name: string } | null;
  gameOver: boolean;
}

export interface CrazyEightsConfig {
  turnTimer: number | null;
}

export const DEFAULT_CONFIG: CrazyEightsConfig = {
  turnTimer: null,
};
