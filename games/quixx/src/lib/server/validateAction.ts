import {
  hasExactKeys,
  invalid,
  isIntInRange,
  isOneOf,
  typeOnly,
  valid,
  validateByType,
  type ActionValidation,
} from '@parlor/multiplayer';
import { ROW_COLORS, ROW_NUMBERS, type QuixxAction } from '../types/game.js';

const LAST_CELL = ROW_NUMBERS.red.length - 1;

function mark(type: 'phase1-mark' | 'phase2-mark') {
  return (a: Record<string, unknown>): ActionValidation<QuixxAction> => {
    if (!hasExactKeys(a, ['type', 'row', 'cellIndex'])) return invalid('Invalid mark');
    if (!isOneOf(a.row, ROW_COLORS)) return invalid('Invalid row');
    // Must be a real integer: a string '10' used to slip past the lock rule (CORE-AUDIT A-08).
    if (!isIntInRange(a.cellIndex, 0, LAST_CELL)) return invalid('Invalid cell');
    return valid({ type, row: a.row, cellIndex: a.cellIndex });
  };
}

const validators: Record<string, (a: Record<string, unknown>) => ActionValidation<QuixxAction>> = {
  'roll-dice': typeOnly('roll-dice'),
  'phase1-mark': mark('phase1-mark'),
  'phase1-pass': typeOnly('phase1-pass'),
  'phase2-mark': mark('phase2-mark'),
  'phase2-pass': typeOnly('phase2-pass'),
};

export function validateQuixxAction(action: Record<string, unknown>): ActionValidation<QuixxAction> {
  return validateByType(action, validators);
}
