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
import { ALL_POSITIONS, RANKS, SUITS, type Card, type KingsCornerAction } from '../types/game.js';

/** A fresh `{suit, rank}` built from validated fields, or null. */
export function parseCard(value: unknown): Card | null {
  if (!isRecord(value) || !hasExactKeys(value, ['suit', 'rank'])) return null;
  if (!isOneOf(value.suit, SUITS) || !isOneOf(value.rank, RANKS)) return null;
  return { suit: value.suit, rank: value.rank };
}

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
