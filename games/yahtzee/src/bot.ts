import {
  CATEGORIES, DICE_COUNT, ROLL_LIMIT, scoreOptions, totals, UPPER,
  type Category, type Scorecard, type UpperCategory, type YahtzeeOptions,
} from './rules.js';

const PAR: Record<Category, number> = {
  ones: 2, twos: 5, threes: 8.5, fours: 12, fives: 15.5, sixes: 19, threeKind: 21.5, fourKind: 13,
  fullHouse: 22.5, smallStraight: 29.5, largeStraight: 32.5, yahtzee: 17, chance: 22,
};

export type BotStep = { type: 'score'; category: Category } | { type: 'roll'; held: boolean[] };

function filled(card: Scorecard) {
  return CATEGORIES.filter((category) => card[category] !== null).length;
}

/** The best box for these dice, and how much better it is than par. */
export function bestScore(card: Scorecard, dice: readonly number[], options: YahtzeeOptions) {
  const { options: boxes } = scoreOptions(card, dice, options);
  const roundsLeft = CATEGORIES.length - filled(card);
  const bonusReachable = totals(card, 0).upper < 63;
  let best: { category: Category; value: number } | null = null;
  for (const { category, points, legal } of boxes) {
    if (!legal) continue;
    let value = points - PAR[category];
    const face = UPPER.indexOf(category as UpperCategory) + 1;
    if (face && bonusReachable) value += 0.6 * (points - 3 * face);
    if (category === 'yahtzee' && points === 50) value += 100;
    if (category === 'chance' && roundsLeft >= 5) value -= 4;
    if (category === 'yahtzee' && points === 0 && roundsLeft > 3) value -= 6;
    if (!best || value > best.value) best = { category, value };
  }
  return best!;
}

const OUTCOMES = Array.from({ length: DICE_COUNT + 1 }, (_, k) =>
  Array.from({ length: 6 ** k }, (_, n) => Array.from({ length: k }, (_, i) => Math.floor(n / 6 ** i) % 6 + 1)));

/** Expected best value after rerolling every die not in `mask`. */
function holdValue(value: (dice: number[]) => number, dice: readonly number[], mask: number, rollsLeft: number) {
  const kept = dice.filter((_, i) => mask & (1 << i));
  const rerolled = DICE_COUNT - kept.length;
  const outcomes = OUTCOMES[rerolled];
  let total = 0;
  for (const outcome of outcomes) total += value([...kept, ...outcome]);
  return total / outcomes.length + (rollsLeft > 1 ? 1.5 * rerolled : 0);
}

export function botStep(card: Scorecard, dice: readonly number[] | null, rollsUsed: number, options: YahtzeeOptions): BotStep {
  if (!dice) return { type: 'roll', held: Array<boolean>(DICE_COUNT).fill(false) };
  const now = bestScore(card, dice, options);
  if (rollsUsed >= ROLL_LIMIT) return { type: 'score', category: now.category };
  const seen = new Set<string>();
  // Only 252 distinct rolls exist, so score each one once per decision.
  const memo = new Map<string, number>();
  const value = (roll: number[]) => {
    const key = roll.sort().join('');
    let known = memo.get(key);
    if (known === undefined) memo.set(key, known = bestScore(card, roll, options).value);
    return known;
  };
  let best = { mask: -1, value: now.value };
  for (let mask = 0; mask < (1 << DICE_COUNT) - 1; mask++) {
    const key = dice.filter((_, i) => mask & (1 << i)).sort().join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const expected = holdValue(value, dice, mask, ROLL_LIMIT - rollsUsed);
    if (expected > best.value) best = { mask, value: expected };
  }
  if (best.mask < 0) return { type: 'score', category: now.category };
  return { type: 'roll', held: dice.map((_, i) => Boolean(best.mask & (1 << i))) };
}
