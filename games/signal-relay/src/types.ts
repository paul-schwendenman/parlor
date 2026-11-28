import type { Antenna, Signal } from './rules.js';

export type RelayAction = {
  type: 'send' | 'reroute';
  level: number;
  signal: number;
  antenna: Antenna;
  version: number;
};
export interface RelayView {
  phase: 'playing' | 'clear' | 'game-over';
  level: number;
  deadline: number | null;
  players: { id: string; name: string; bot: boolean; connected: boolean; remaining: number }[];
  hand: Signal[];
  antennas: { signal: Signal; version: number }[];
  rerouteAvailable: boolean;
  won: boolean;
  last: { playerId: string; signal: Signal; antenna: Antenna; rerouted: boolean } | null;
}

declare module '@parlor/game-types' {
  interface GameViewMap { 'signal-relay': RelayView }
  interface GameActionMap { 'signal-relay': RelayAction }
}
