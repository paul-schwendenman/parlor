import {
  hasExactKeys,
  invalid,
  isIntInRange,
  typeOnly,
  valid,
  validateByType,
  type ActionValidation,
} from '@parlor/multiplayer';
import type { BootyDiceAction } from '../types/game.js';

const DICE_COUNT = 6;
const MAX_PLAYER_ID_LENGTH = 64;

const validators: Record<string, (a: Record<string, unknown>) => ActionValidation<BootyDiceAction>> = {
  roll: typeOnly('roll'),
  finishRolling: typeOnly('finishRolling'),
  endTurn: typeOnly('endTurn'),
  lockDice: (a) => {
    if (!hasExactKeys(a, ['type', 'diceIndices'])) return invalid('Invalid lock');
    const raw = a.diceIndices;
    if (!Array.isArray(raw) || raw.length > DICE_COUNT) return invalid('Dice indices must be an array');
    const indices: number[] = [];
    for (const i of raw as unknown[]) {
      if (!isIntInRange(i, 0, DICE_COUNT - 1)) return invalid('Dice indices must be integers between 0 and 5');
      if (indices.includes(i)) return invalid('Dice indices must be unique');
      indices.push(i);
    }
    return valid({ type: 'lockDice', diceIndices: indices });
  },
  selectTarget: (a) => {
    if (!hasExactKeys(a, ['type', 'dieIndex', 'targetPlayerId'])) return invalid('Invalid target');
    if (!isIntInRange(a.dieIndex, 0, DICE_COUNT - 1)) return invalid('Invalid die');
    const target = a.targetPlayerId;
    if (typeof target !== 'string' || target.length === 0 || target.length > MAX_PLAYER_ID_LENGTH) {
      return invalid('Invalid target');
    }
    return valid({ type: 'selectTarget', dieIndex: a.dieIndex, targetPlayerId: target });
  },
};

export function validateBootyDiceAction(action: Record<string, unknown>): ActionValidation<BootyDiceAction> {
  return validateByType(action, validators);
}
