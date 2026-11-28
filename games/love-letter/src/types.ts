import type { CardValue, Edition } from './rules.js';

export type LoveLetterPhase = 'turn' | 'chancellor' | 'round-over' | 'game-over';
export interface LoveLetterOptions { edition: Edition; tieBreak: 'share' | 'discards'; hints: boolean }
export type TrailCard = { value: CardValue; how: 'played' | 'discarded' | 'knocked-out' };

export interface PlayEvent {
  seq: number;
  byId: string;
  card: CardValue;
  targetId: string | null;
  noEffect: boolean;
  guess?: CardValue;
  hit?: boolean;
  /** Priest: only for the player who looked. */
  seen?: CardValue;
  /** Baron: only for the two players compared, from the viewer's side. */
  compare?: { mine: CardValue; theirs: CardValue };
  baronResult?: 'win' | 'lose' | 'tie';
  princeDiscard?: CardValue;
  drewSetAside?: boolean;
  returned?: number;
  knockedOut: { id: string; card: CardValue }[];
}

export interface RoundResult {
  reason: 'last-standing' | 'deck-empty';
  hands: { id: string; card: CardValue | null; discardTotal: number }[];
  setAside: CardValue | null;
  winnerIds: string[];
  spyId: string | null;
}

export interface LoveLetterMove { card: CardValue; targets: string[]; guesses: CardValue[] }

export interface LoveLetterView {
  phase: LoveLetterPhase;
  edition: Edition;
  round: number;
  target: number;
  deckCount: number;
  faceUp: CardValue[];
  activePlayerId: string | null;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    left: boolean;
    out: boolean;
    protected: boolean;
    tokens: number;
    cardCount: number;
    trail: TrailCard[];
  }[];
  events: PlayEvent[];
  lastRound: RoundResult | null;
  winnerIds: string[];
  myHand: CardValue[];
  moves: LoveLetterMove[];
  forcedCountess: boolean;
  /** For the Chancellor: how many cards go under the deck. */
  chancellorReturn: number;
  known: { id: string; card: CardValue; source: 'priest' | 'baron' | 'king' }[];
  unseen: Partial<Record<CardValue, number>>;
}

export type LoveLetterAction =
  | { type: 'play'; card: CardValue; target?: string; guess?: CardValue }
  /** `bottom[0]` ends up deepest in the deck. */
  | { type: 'chancellor'; keep: CardValue; bottom: CardValue[] };

declare module '@parlor/game-types' {
  interface GameViewMap { 'love-letter': LoveLetterView }
  interface GameActionMap { 'love-letter': LoveLetterAction }
}
