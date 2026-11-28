import type { Face, Seal } from './rules.js';

export type Guess = { target: string; face: Face };
export type CipherAction =
  | { type: 'pass'; round: number; sealId: number }
  | { type: 'expose'; round: number; sealId: number }
  | { type: 'guess'; round: number; target: string; face: Face };

export interface CipherView {
  phase: 'pass' | 'expose' | 'guess' | 'reveal' | 'game-over';
  round: number;
  players: { id: string; name: string; bot: boolean; connected: boolean; exposed: Face | null; ready: boolean; score: number }[];
  hand: Seal[];
  sent: { face: Face; to: string } | null;
  sentTo: string | null;
  choice: number | null;
  myGuess: Guess | null;
  results: { id: string; sealed: Face; guess: Guess; right: boolean; guessed: boolean; points: number }[];
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'cipher-post': CipherView }
  interface GameActionMap { 'cipher-post': CipherAction }
}
