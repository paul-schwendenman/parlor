export const DICE_COUNT = 5;
export const ROLL_LIMIT = 3;

export const categories = [
  { id: 'ones', label: 'Ones', description: 'Total of your ones' },
  { id: 'twos', label: 'Twos', description: 'Total of your twos' },
  { id: 'threes', label: 'Threes', description: 'Total of your threes' },
  { id: 'fours', label: 'Fours', description: 'Total of your fours' },
  { id: 'fives', label: 'Fives', description: 'Total of your fives' },
  { id: 'sixes', label: 'Sixes', description: 'Total of your sixes' },
  { id: 'twin-docks', label: 'Twin docks', description: 'Two different pairs score three times the sum of their faces' },
  { id: 'lighthouse', label: 'Lighthouse', description: 'A one and a six score 14, plus two per extra one or six' },
  { id: 'channel', label: 'Channel', description: 'Four consecutive faces score 22. Five score 34' },
  { id: 'fleet', label: 'Fleet', description: 'Four matching dice score 30. Five score 45' },
] as const;

export type Category = (typeof categories)[number]['id'];
export type Scorecard = Partial<Record<Category, number>>;

export function scores(dice: readonly number[]): Record<Category, number> {
  const counts = Array.from({ length: 6 }, (_, i) => dice.filter((die) => die === i + 1).length);
  const pairs = counts.flatMap((count, i) => count >= 2 ? [i + 1] : []);
  const [ones, twos, threes, fours, fives, sixes] = counts;
  const max = Math.max(...counts);
  let run = 0;
  let longest = 0;
  for (const count of counts) {
    run = count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  return {
    ones, twos: 2 * twos, threes: 3 * threes, fours: 4 * fours, fives: 5 * fives, sixes: 6 * sixes,
    'twin-docks': pairs.length === 2 ? 3 * (pairs[0] + pairs[1]) : 0,
    lighthouse: ones && sixes ? 10 + 2 * (ones + sixes) : 0,
    channel: longest >= 5 ? 34 : longest === 4 ? 22 : 0,
    fleet: max === 5 ? 45 : max === 4 ? 30 : 0,
  };
}
