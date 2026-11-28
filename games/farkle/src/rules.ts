export const OPENING_SCORE = 500;
export const TARGET_SCORE = 10_000;
export const DICE_PER_ROLL = 6;

/** Score an entire selection. Any die outside a scoring group invalidates it. */
export function scoreDice(dice: readonly number[]): number {
  if (!dice.length) return 0;
  const counts = [1, 2, 3, 4, 5, 6].map((face) => dice.filter((die) => die === face).length);
  if (dice.length === DICE_PER_ROLL) {
    if (counts.filter((count) => count === 3).length === 2) return 2500;
    if (counts.every((count) => count === 1) || counts.filter((count) => count === 2).length === 3 ||
      (counts.includes(4) && counts.includes(2))) return 1500;
  }
  let score = 0;
  for (const [index, count] of counts.entries()) {
    const face = index + 1;
    const single = face === 1 ? 100 : face === 5 ? 50 : 0;
    if (count >= 3) {
      const triple = face === 1 ? 1000 : face * 100;
      const fixed = (count - 3) * 1000;
      score += Math.max(fixed, triple + single * (count - 3));
    } else if (single) score += count * single;
    else if (count) return 0;
  }
  return score;
}

export function scoringSelections(dice: readonly number[]) {
  const options: { indices: number[]; points: number }[] = [];
  for (let mask = 1; mask < 2 ** dice.length; mask++) {
    const indices = [...dice.keys()].filter((index) => (mask & (1 << index)) !== 0);
    const points = scoreDice(indices.map((index) => dice[index]));
    if (points) options.push({ indices, points });
  }
  return options;
}
