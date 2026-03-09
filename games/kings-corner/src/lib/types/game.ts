export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const CARDINAL_POSITIONS = ['north', 'south', 'east', 'west'] as const;
export const CORNER_POSITIONS = ['northeast', 'southeast', 'southwest', 'northwest'] as const;
export const ALL_POSITIONS = [...CARDINAL_POSITIONS, ...CORNER_POSITIONS] as const;
export type PilePosition = (typeof ALL_POSITIONS)[number];

export interface Pile {
  position: PilePosition;
  cards: Card[];
}

export type KingsCornerPhase = 'drawing' | 'playing' | 'game-over';

export type KingsCornerAction =
  | { type: 'play-card'; card: Card; target: PilePosition }
  | { type: 'move-pile'; from: PilePosition; to: PilePosition }
  | { type: 'end-turn' };

export interface KingsCornerPlayerInfo {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
}

export interface PlayableCard {
  card: Card;
  validTargets: PilePosition[];
}

export interface MovablePile {
  from: PilePosition;
  validTargets: PilePosition[];
}

export interface KingsCornerPlayerView {
  myHand: Card[];
  players: KingsCornerPlayerInfo[];
  myIndex: number;
  activePlayerIndex: number;
  isActivePlayer: boolean;
  piles: Pile[];
  drawPileCount: number;
  phase: KingsCornerPhase;
  winner: { id: string; name: string } | null;
  gameOver: boolean;
  playableCards: PlayableCard[];
  movablePiles: MovablePile[];
  canEndTurn: boolean;
  mustPlayKing: boolean;
}

export interface KingsCornerConfig {
  turnTimer: number | null;
}

export const DEFAULT_CONFIG: KingsCornerConfig = {
  turnTimer: null,
};
