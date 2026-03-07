import type { QuixxPlayer, Scoresheet, QuixxConfig } from '../../../types/game.js';
import { DEFAULT_CONFIG } from '../../../types/game.js';
import { QuixxEngine } from '../QuixxEngine.js';

export function createTestSheet(): Scoresheet {
  return {
    red: Array(11).fill(false),
    yellow: Array(11).fill(false),
    green: Array(11).fill(false),
    blue: Array(11).fill(false),
  };
}

export function createTestPlayer(id: string, name: string): QuixxPlayer {
  return {
    id,
    name,
    connected: true,
    sheet: createTestSheet(),
    penalties: 0,
    phase1Decision: null,
    lockedRows: [],
  };
}

export function createTestEngine(
  playerCount = 2,
  config: Partial<QuixxConfig> = {},
): QuixxEngine {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `player${i + 1}`,
    name: `Player ${i + 1}`,
  }));
  return new QuixxEngine(players, 'TEST', { ...DEFAULT_CONFIG, ...config });
}
