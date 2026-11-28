import type { Pick, Tile } from './rules.js';

export type MarketAction = { type: 'pick'; season: number; pickNumber: number; tileId: number; use: Pick['use'] };
export interface MarketPlayer {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  coins: number;
  stall: Tile[];
  locked: boolean;
  seasonScores: number[];
  total: number;
}
export interface MarketView {
  phase: 'draft' | 'reveal' | 'season-end' | 'game-over';
  season: number;
  pickNumber: number;
  hand: Tile[];
  selection: Pick | null;
  players: MarketPlayer[];
  revealed: { playerId: string; tile: Tile; use: Pick['use'] }[];
  winnerIds: string[];
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'night-market': MarketView }
  interface GameActionMap { 'night-market': MarketAction }
}
