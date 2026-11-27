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
import { SUITS, type CrazyEightsAction } from '../types/game.js';

const validators: Record<string, (a: Record<string, unknown>) => ActionValidation<CrazyEightsAction>> = {
  'play-card': (a) => {
    if (!hasExactKeys(a, ['type', 'card'])) return invalid('Invalid play');
    const card = parseCard(a.card);
    if (!card) return invalid('Invalid card');
    return valid({ type: 'play-card', card });
  },
  'draw-card': typeOnly('draw-card'),
  pass: typeOnly('pass'),
  'choose-suit': (a) => {
    if (!hasExactKeys(a, ['type', 'suit'])) return invalid('Invalid suit choice');
    if (!isOneOf(a.suit, SUITS)) return invalid('Invalid suit');
    return valid({ type: 'choose-suit', suit: a.suit });
  },
};

export function validateCrazyEightsAction(action: Record<string, unknown>): ActionValidation<CrazyEightsAction> {
  return validateByType(action, validators);
}
