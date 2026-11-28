import { addToPlate, DUMPLING, makiIcons, type PlateCard, type SushiCard } from './rules.js';

export interface BotContext {
  round: number;
  /** Other plates' maki icons and puddings. */
  rivals: { maki: number; puddings: number }[];
  puddings: number;
  canUseChopsticks: boolean;
}

function value(card: SushiCard, plate: readonly PlateCard[], left: number, ctx: BotContext): number {
  const count = (kind: SushiCard['kind']) => plate.filter((item) => item.card.kind === kind).length;
  const emptyWasabi = plate.some((item) => item.card.kind === 'wasabi' && item.pairedWith === null);
  switch (card.kind) {
    case 'tempura': return count('tempura') % 2 ? 5 : left >= 3 ? 2.5 : 0;
    case 'sashimi': {
      const n = count('sashimi') % 3;
      return n === 2 ? 10 : n === 1 ? (left >= 3 ? 4 : 0) : left >= 5 ? 3 : 0;
    }
    case 'dumpling': {
      const n = Math.min(count('dumpling'), 5);
      return DUMPLING[Math.min(n + 1, 5)] - DUMPLING[n];
    }
    case 'nigiri': return card.value * (emptyWasabi ? 3 : 1);
    case 'wasabi': return left >= 3 && !emptyWasabi ? 3.5 : 0;
    case 'maki': {
      const mine = makiIcons(plate) + card.count;
      const [first = 0, second = 0] = ctx.rivals.map(({ maki }) => maki).sort((a, b) => b - a);
      return card.count * (mine >= second ? 1.2 : 0.4) + (mine > first && makiIcons(plate) <= first ? 1 : 0);
    }
    case 'pudding': {
      let points = 1 + ctx.round;
      if (ctx.round === 3) {
        const counts = ctx.rivals.map(({ puddings }) => puddings);
        if (ctx.puddings <= Math.min(...counts) || ctx.puddings + 1 >= Math.max(...counts)) points += 2;
      }
      return points;
    }
    case 'chopsticks': return left >= 4 ? 2.5 : 0;
  }
}

/** The ids to pick: one card, or two with Chopsticks when the pair is clearly better. */
export function choosePick(hand: readonly SushiCard[], plate: readonly PlateCard[], ctx: BotContext): number[] {
  const left = hand.length;
  const singles = hand.map((card) => ({ card, score: value(card, plate, left, ctx) }))
    .sort((a, b) => b.score - a.score || a.card.id - b.card.id);
  const best = singles[0];
  if (!ctx.canUseChopsticks || hand.length < 2) return [best.card.id];
  let pair: { ids: number[]; score: number } | null = null;
  for (const first of hand) {
    const after = plate.map((item) => ({ ...item }));
    addToPlate(after, first, 0);
    const firstScore = value(first, plate, left, ctx);
    for (const second of hand) {
      if (second === first) continue;
      const score = firstScore + value(second, after, left - 1, ctx);
      if (!pair || score > pair.score) pair = { ids: [first.id, second.id], score };
    }
  }
  return pair && pair.score >= best.score + 3 ? pair.ids : [best.card.id];
}
