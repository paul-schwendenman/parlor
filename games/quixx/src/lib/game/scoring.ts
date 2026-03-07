import type { QuixxPlayer, PlayerScore, RowColor } from '../types/game.js';
import { ROW_COLORS } from '../types/game.js';

export function scoreRow(marks: boolean[], hasLock = false): number {
  let count = marks.filter(Boolean).length;
  if (hasLock) count += 1;
  return (count * (count + 1)) / 2;
}

export function totalScore(player: QuixxPlayer): number {
  let total = 0;
  for (const row of ROW_COLORS) {
    const hasLock = player.lockedRows.includes(row);
    total += scoreRow(player.sheet[row], hasLock);
  }
  total -= player.penalties * 5;
  return total;
}

export function computeAllScores(players: QuixxPlayer[]): PlayerScore[] {
  return players
    .map((player) => {
      const rowScores = {} as Record<RowColor, number>;
      for (const row of ROW_COLORS) {
        const hasLock = player.lockedRows.includes(row);
        rowScores[row] = scoreRow(player.sheet[row], hasLock);
      }
      return {
        playerId: player.id,
        name: player.name,
        rowScores,
        penalties: player.penalties,
        total: totalScore(player),
      };
    })
    .sort((a, b) => b.total - a.total);
}
