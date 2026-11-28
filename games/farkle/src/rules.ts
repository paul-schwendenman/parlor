import type { FarkleRules } from './types.js';

export const OPENING_SCORE = 500;
export const TARGET_SCORE = 10_000;
export const DICE_PER_ROLL = 6;

export const DEFAULT_RULES: Readonly<FarkleRules> = {
  target: TARGET_SCORE, opening: OPENING_SCORE, threeOnes: 1000, multiples: 'fixed',
  threePairs: 1500, fourAndPair: 1500, straight: 1500, twoTriplets: 2500,
  sixDiceNothing: 0, hotDice: 'may-bank', threeFarkles: 0, ending: 'final-round',
};

/** Score an entire selection. Any die outside a scoring group invalidates it. */
export function scoreDice(dice: readonly number[], rules: Readonly<FarkleRules> = DEFAULT_RULES): number {
  if (!dice.length || dice.length > DICE_PER_ROLL || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) return 0;
  const counts = Array.from({ length: DICE_PER_ROLL }, (_, index) => dice.filter((die) => die === index + 1).length);
  let special = 0;
  if (dice.length === DICE_PER_ROLL) {
    if (counts.filter((count) => count === 3).length === 2) special = rules.twoTriplets;
    if (counts.every((count) => count === 1)) special = rules.straight;
    if (counts.filter((count) => count === 2).length === 3) special = rules.threePairs;
    if (counts.includes(4) && counts.includes(2)) special = rules.fourAndPair;
    if (!special && counts[0] === 0 && counts[4] === 0 && counts.every((count) => count < 3)) {
      special = rules.sixDiceNothing;
    }
  }

  let score = 0;
  for (const [index, count] of counts.entries()) {
    if (!count) continue;
    const face = index + 1;
    const single = face === 1 ? 100 : face === 5 ? 50 : 0;
    if (count < 3) {
      if (!single) return special;
      score += count * single;
      continue;
    }
    const triple = face === 1 ? rules.threeOnes : face * 100;
    let best = Math.max(count * single, triple + (count - 3) * single);
    for (let size = 4; size <= count; size++) {
      if (size < count && !single) continue;
      const multiple = rules.multiples === 'fixed' ? (size - 3) * 1000
        : rules.multiples === 'doubling' ? triple * 2 ** (size - 3)
        : triple * (size - 2);
      best = Math.max(best, multiple + (count - size) * single);
    }
    score += best;
  }
  return Math.max(score, special);
}

export function scoringSelections(dice: readonly number[], rules: Readonly<FarkleRules> = DEFAULT_RULES) {
  const options: { indices: number[]; points: number }[] = [];
  for (let mask = 1; mask < 2 ** dice.length; mask++) {
    const indices = [...dice.keys()].filter((index) => (mask & (1 << index)) !== 0);
    const points = scoreDice(indices.map((index) => dice[index]), rules);
    if (points) options.push({ indices, points });
  }
  return options;
}
