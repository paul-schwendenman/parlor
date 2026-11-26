import {
  hasExactKeys,
  invalid,
  isOneOf,
  isRecord,
  typeOnly,
  valid,
  validateByType,
  type ActionValidation,
} from '@parlor/multiplayer';
import { RANKS, SUITS, type Card, type CrazyEightsAction } from '../types/game.js';

/** A fresh `{suit, rank}` built from validated fields, or null. */
export function parseCard(value: unknown): Card | null {
  if (!isRecord(value) || !hasExactKeys(value, ['suit', 'rank'])) return null;
  if (!isOneOf(value.suit, SUITS) || !isOneOf(value.rank, RANKS)) return null;
  return { suit: value.suit, rank: value.rank };
}

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
