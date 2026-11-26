import {
  hasExactKeys,
  invalid,
  isIntInRange,
  typeOnly,
  valid,
  validateByType,
  type ActionValidation,
} from '@parlor/multiplayer';
import type { LiarsDiceAction } from '../types/game.js';

/** 6 players × 5 dice: no table ever has more dice in play. */
export const MAX_DICE_IN_PLAY = 30;

const validators: Record<string, (a: Record<string, unknown>) => ActionValidation<LiarsDiceAction>> = {
  bid: (a) => {
    if (!hasExactKeys(a, ['type', 'quantity', 'faceValue'])) return invalid('Invalid bid');
    if (!isIntInRange(a.quantity, 1, MAX_DICE_IN_PLAY)) return invalid('Invalid bid quantity');
    if (!isIntInRange(a.faceValue, 1, 6)) return invalid('Invalid bid face value');
    return valid({ type: 'bid', quantity: a.quantity, faceValue: a.faceValue });
  },
  challenge: typeOnly('challenge'),
  'spot-on': typeOnly('spot-on'),
  nextRound: typeOnly('nextRound'),
};

export function validateLiarsDiceAction(action: Record<string, unknown>): ActionValidation<LiarsDiceAction> {
  return validateByType(action, validators);
}
