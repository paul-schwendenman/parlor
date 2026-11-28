export const DICE_COUNT = 5;
export const ROLL_LIMIT = 3;
export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'] as const;
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'] as const;
export type UpperCategory = (typeof UPPER)[number];
export type Category = UpperCategory | (typeof LOWER)[number];
export const CATEGORIES: readonly Category[] = [...UPPER, ...LOWER];
export const ROUNDS = CATEGORIES.length;
export const UPPER_BONUS = 35;
export const UPPER_TARGET = 63;
export const YAHTZEE_BONUS = 100;

export const LABELS: Record<Category, string> = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: '3 of a kind', fourKind: '4 of a kind', fullHouse: 'Full house', smallStraight: 'Small straight',
  largeStraight: 'Large straight', yahtzee: 'Yahtzee', chance: 'Chance',
};

export type Scorecard = Record<Category, number | null>;
export interface YahtzeeOptions { joker: 'forced' | 'free' | 'off'; yahtzeeBonus: boolean }
export const DEFAULT_OPTIONS: YahtzeeOptions = { joker: 'forced', yahtzeeBonus: true };

export interface ScoreOption { category: Category; points: number; legal: boolean; joker: boolean }

export function emptyCard(): Scorecard {
  return Object.fromEntries(CATEGORIES.map((category) => [category, null])) as Scorecard;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

function counts(dice: readonly number[]) {
  return [1, 2, 3, 4, 5, 6].map((face) => dice.filter((die) => die === face).length);
}

function longestRun(dice: readonly number[]) {
  let run = 0;
  let longest = 0;
  for (const count of counts(dice)) {
    run = count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function baseScore(dice: readonly number[], category: Category): number {
  const tally = counts(dice);
  const sum = dice.reduce((total, die) => total + die, 0);
  const upper = UPPER.indexOf(category as UpperCategory);
  if (upper >= 0) return (upper + 1) * tally[upper];
  const max = Math.max(...tally);
  switch (category) {
    case 'threeKind': return max >= 3 ? sum : 0;
    case 'fourKind': return max >= 4 ? sum : 0;
    case 'fullHouse': return tally.includes(3) && tally.includes(2) ? 25 : 0;
    case 'smallStraight': return longestRun(dice) >= 4 ? 30 : 0;
    case 'largeStraight': return longestRun(dice) === 5 ? 40 : 0;
    case 'yahtzee': return max === 5 ? 50 : 0;
    default: return sum;
  }
}

const JOKER_POINTS: Partial<Record<Category, number>> = { fullHouse: 25, smallStraight: 30, largeStraight: 40 };

/** Every empty box's points for these dice, with the Joker rule applied. */
export function scoreOptions(card: Scorecard, dice: readonly number[], options: YahtzeeOptions = DEFAULT_OPTIONS) {
  const five = dice.length === DICE_COUNT && dice.every((die) => die === dice[0]);
  const jokerActive = five && card.yahtzee !== null && options.joker !== 'off';
  const bonus = five && card.yahtzee === 50 && options.yahtzeeBonus;
  const upperBox = five ? UPPER[dice[0] - 1] : null;
  const empty = CATEGORIES.filter((category) => card[category] === null);
  let forced: Category | null = null;
  let legal = (_: Category) => true;
  if (jokerActive && options.joker === 'forced') {
    const lowerOpen = LOWER.some((category) => card[category] === null);
    if (upperBox && card[upperBox] === null) {
      forced = upperBox;
      legal = (category) => category === upperBox;
    } else if (lowerOpen) legal = (category) => (LOWER as readonly string[]).includes(category);
  }
  const jokerUsable = jokerActive && (options.joker === 'forced' || (upperBox !== null && card[upperBox] !== null));
  const list: ScoreOption[] = empty.map((category) => {
    const joker = jokerUsable && JOKER_POINTS[category] !== undefined;
    let points = joker ? JOKER_POINTS[category]! : baseScore(dice, category);
    // With the matching upper box and every lower box filled, an upper box takes zero.
    if (jokerActive && options.joker === 'forced' && !forced && !LOWER.some((c) => card[c] === null)) points = 0;
    return { category, points, legal: legal(category), joker };
  });
  return { options: list, bonus, jokerActive, forced };
}

export function totals(card: Scorecard, yahtzeeBonuses: number) {
  const upper = UPPER.reduce((sum, category) => sum + (card[category] ?? 0), 0);
  const lower = LOWER.reduce((sum, category) => sum + (card[category] ?? 0), 0);
  const upperBonus = upper >= UPPER_TARGET ? UPPER_BONUS : 0;
  return {
    upper, upperBonus, lower, upperNeeded: Math.max(0, UPPER_TARGET - upper),
    total: upper + upperBonus + lower + YAHTZEE_BONUS * yahtzeeBonuses,
  };
}
