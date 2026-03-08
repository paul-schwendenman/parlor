export function validateDiceIndices(
  indices: unknown,
): { valid: true; indices: number[] } | { valid: false; error: string } {
  if (!Array.isArray(indices)) {
    return { valid: false, error: 'Dice indices must be an array' };
  }

  for (const index of indices) {
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 5) {
      return { valid: false, error: 'Dice indices must be integers between 0 and 5' };
    }
  }

  return { valid: true, indices: indices as number[] };
}
