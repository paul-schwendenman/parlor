import { bustChance, COLUMNS, HEIGHT, moveKey, tryPlace, type Board, type Column, type Move } from './rules.js';

const WEIGHT: Record<Column, number> = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5, 12: 6 };

function moveScore(move: Move, board: Board) {
  const after = tryPlace(move, board)!;
  let score = 0;
  const placed = Object.keys(board.runners).length;
  for (const column of new Set(move)) {
    const steps = after[column]! - (board.runners[column] ?? board.markers[column] ?? 0);
    score += steps * 12 / HEIGHT[column];
    if (after[column] === HEIGHT[column]) score += 100;
    if (column >= 6 && column <= 8) score += 2 * steps;
    if (board.runners[column] === undefined) score -= 6 + (placed + 1 === 3 ? 6 : 0);
  }
  return score;
}

/** The highest-scoring move; ties go to the one leaving the lowest bust chance. */
export function chooseMove(moves: Move[], board: Board): Move {
  const scored = moves.map((move) => ({ move, score: moveScore(move, board) }))
    .sort((a, b) => b.score - a.score || moveKey(a.move).localeCompare(moveKey(b.move)));
  const best = scored.filter(({ score }) => score === scored[0].score);
  if (best.length === 1) return best[0].move;
  return best.map(({ move }) => ({ move, risk: bustChance({ ...board, runners: tryPlace(move, board)! }) }))
    .sort((a, b) => a.risk - b.risk)[0].move;
}

/** A "Rule of 28" turn score: column weights per step, doubled when a runner enters. */
export function turnScore({ runners, markers }: Board) {
  const columns = COLUMNS.filter((column) => runners[column] !== undefined);
  let score = columns.reduce((sum, column) => sum + WEIGHT[column] * (runners[column]! - (markers[column] ?? 0) + 1), 0);
  if (columns.length === 3 && (columns.every((c) => c >= 8) || columns.every((c) => c <= 6))) score += 4;
  return score;
}

export function shouldStop(board: Board, stopWins: boolean) {
  const columns = COLUMNS.filter((column) => board.runners[column] !== undefined);
  if (stopWins || columns.some((column) => board.runners[column] === HEIGHT[column])) return true;
  if (turnScore(board) >= 28) return true;
  return columns.length === 3 && bustChance(board) > 0.5;
}
