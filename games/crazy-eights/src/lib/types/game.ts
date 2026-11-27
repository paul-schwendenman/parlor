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
  isBot: boolean;
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

// Crazy Eights' entries in the `game:state` and `game:action` wire maps (plans 3.1b, 3.5). Players and
// spectators both receive this shape; a spectator's has `myIndex: -1` and an empty hand.
declare module '@parlor/game-types' {
  interface GameViewMap {
    'crazy-eights': CrazyEightsPlayerView;
  }
  interface GameActionMap {
    'crazy-eights': CrazyEightsAction;
  }
}
