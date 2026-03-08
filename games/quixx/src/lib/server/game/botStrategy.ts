import type { Scoresheet, DiceState, RowColor, QuixxAction, AvailableMove } from '../../types/game.js';
import { getAvailablePhase1Moves, getAvailablePhase2Moves } from '../../game/validation.js';

function scoreMoves(moves: AvailableMove[], sheet: Scoresheet): AvailableMove | null {
  if (moves.length === 0) return null;

  // Score each move: prefer rows with more existing marks (momentum),
  // tiebreak by lower cellIndex (earlier cells preserve flexibility)
  return moves.reduce((best, move) => {
    const bestMarks = sheet[best.row].filter(Boolean).length;
    const moveMarks = sheet[move.row].filter(Boolean).length;
    if (moveMarks > bestMarks) return move;
    if (moveMarks === bestMarks && move.cellIndex < best.cellIndex) return move;
    return best;
  });
}

export function chooseBotPhase1Action(
  sheet: Scoresheet,
  dice: DiceState,
  lockedRows: RowColor[],
): QuixxAction {
  const moves = getAvailablePhase1Moves(sheet, dice, lockedRows);
  const best = scoreMoves(moves, sheet);
  if (best) {
    return { type: 'phase1-mark', row: best.row, cellIndex: best.cellIndex };
  }
  return { type: 'phase1-pass' };
}

export function chooseBotPhase2Action(
  sheet: Scoresheet,
  dice: DiceState,
  lockedRows: RowColor[],
  removedDice: RowColor[],
): QuixxAction {
  const moves = getAvailablePhase2Moves(sheet, dice, lockedRows, removedDice);
  const best = scoreMoves(moves, sheet);
  if (best) {
    return { type: 'phase2-mark', row: best.row, cellIndex: best.cellIndex };
  }
  return { type: 'phase2-pass' };
}
