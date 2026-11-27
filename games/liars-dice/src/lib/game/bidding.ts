import type { Bid } from '../types/game.js';

type BidShape = Pick<Bid, 'quantity' | 'faceValue'>;

/**
 * Whether `next` beats `current`. Shared by the engine (the rule) and the
 * board (so an illegal bid is never offered).
 */
export function isValidBid(next: BidShape, current: BidShape | null, wildOnes = true): boolean {
  if (next.faceValue < 1 || next.faceValue > 6) return false;
  if (next.quantity < 1) return false;

  if (!current) return true;

  if (wildOnes) {
    // Bidding on 1s from another number: quantity is halved (round up)
    if (next.faceValue === 1 && current.faceValue !== 1) {
      return next.quantity >= Math.ceil(current.quantity / 2);
    }
    // From 1s to another number: quantity doubled + 1
    if (next.faceValue !== 1 && current.faceValue === 1) {
      return next.quantity >= current.quantity * 2 + 1;
    }
  }

  // Standard: higher quantity, or same quantity with higher face
  if (next.quantity > current.quantity) return true;
  if (next.quantity === current.quantity && next.faceValue > current.faceValue) return true;
  return false;
}
