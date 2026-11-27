import { parseCard } from '@parlor/cards';
import {
  hasExactKeys,
  invalid,
  isOneOf,
  typeOnly,
  valid,
  validateByType,
  type ActionValidation,
} from '@parlor/multiplayer';
import { ALL_POSITIONS, type KingsCornerAction } from '../types/game.js';

const validators: Record<string, (a: Record<string, unknown>) => ActionValidation<KingsCornerAction>> = {
  'play-card': (a) => {
    if (!hasExactKeys(a, ['type', 'card', 'target'])) return invalid('Invalid play');
    const card = parseCard(a.card);
    if (!card) return invalid('Invalid card');
    if (!isOneOf(a.target, ALL_POSITIONS)) return invalid('Invalid pile');
    return valid({ type: 'play-card', card, target: a.target });
  },
  'move-pile': (a) => {
    if (!hasExactKeys(a, ['type', 'from', 'to'])) return invalid('Invalid move');
    if (!isOneOf(a.from, ALL_POSITIONS) || !isOneOf(a.to, ALL_POSITIONS)) return invalid('Invalid pile');
    return valid({ type: 'move-pile', from: a.from, to: a.to });
  },
  'draw-card': typeOnly('draw-card'),
  'end-turn': typeOnly('end-turn'),
};

export function validateKingsCornerAction(action: Record<string, unknown>): ActionValidation<KingsCornerAction> {
  return validateByType(action, validators);
}
