import { aceLowRankValue, type Card } from './index.js';

export interface Meld { kind: 'set' | 'run'; cards: Card[] }
export interface Arrangement { melds: Meld[]; deadwood: Card[]; deadwoodCount: number }
export interface Layoff { card: Card; meldIndex: number }

export function deadwoodValue(card: Card) {
  return Math.min(10, aceLowRankValue(card.rank));
}

/** Enumerate disjoint melds in a small, single-deck hand. */
export function arrangements(hand: readonly Card[]): Arrangement[] {
  if (hand.length > 15) throw new RangeError('Expected a hand of at most 15 cards.');
  const candidates: { mask: number; meld: Meld }[] = [];
  const add = (kind: Meld['kind'], indices: number[]) => candidates.push({
    mask: indices.reduce((mask, index) => mask | (1 << index), 0),
    meld: { kind, cards: indices.map((index) => hand[index]) },
  });

  const byRank = new Map<Card['rank'], number[]>();
  const bySuit = new Map<Card['suit'], number[]>();
  for (const [index, card] of hand.entries()) {
    byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), index]);
    bySuit.set(card.suit, [...(bySuit.get(card.suit) ?? []), index]);
  }
  for (const indices of byRank.values()) {
    if (indices.length >= 3) add('set', indices);
    if (indices.length === 4) indices.forEach((_, skip) => add('set', indices.filter((_, index) => index !== skip)));
  }
  for (const indices of bySuit.values()) {
    const rank = (index: number) => aceLowRankValue(hand[index].rank);
    indices.sort((a, b) => rank(a) - rank(b));
    for (let start = 0; start < indices.length - 2; start++) {
      for (let end = start + 1; end < indices.length && rank(indices[end]) - rank(indices[start]) === end - start; end++) {
        if (end - start >= 2) add('run', indices.slice(start, end + 1));
      }
    }
  }

  const results: Arrangement[] = [];
  function visit(start: number, used: number, melds: Meld[]) {
    const deadwood = hand.filter((_, index) => !(used & (1 << index)));
    results.push({ melds, deadwood, deadwoodCount: deadwood.reduce((sum, card) => sum + deadwoodValue(card), 0) });
    for (let index = start; index < candidates.length; index++) {
      const { mask, meld } = candidates[index];
      if (!(used & mask)) visit(index + 1, used | mask, [...melds, meld]);
    }
  }
  visit(0, 0, []);
  return results;
}

export function bestArrangement(hand: readonly Card[]): Arrangement {
  return arrangements(hand).reduce((best, item) => item.deadwoodCount < best.deadwoodCount ? item : best);
}

function accepts(meld: Meld, card: Card) {
  if (meld.kind === 'set') return meld.cards.length < 4 && meld.cards[0].rank === card.rank;
  if (meld.cards[0].suit !== card.suit) return false;
  const ranks = meld.cards.map(({ rank }) => aceLowRankValue(rank));
  const value = aceLowRankValue(card.rank);
  return value === Math.min(...ranks) - 1 || value === Math.max(...ranks) + 1;
}

/** The best defender arrangement, including chained layoffs and competing destinations. */
export function bestDefense(hand: readonly Card[], target: readonly Meld[]): Arrangement & { layoffs: Layoff[] } {
  let best = { ...bestArrangement(hand), layoffs: [] as Layoff[] };
  function visit(own: Arrangement, melds: Meld[], deadwood: Card[], points: number, layoffs: Layoff[]) {
    if (points < best.deadwoodCount) best = { melds: own.melds, deadwood, deadwoodCount: points, layoffs };
    if (best.deadwoodCount === 0) return;
    for (const [index, card] of deadwood.entries()) {
      for (const [meldIndex, meld] of melds.entries()) {
        if (!accepts(meld, card)) continue;
        const next = [...melds];
        next[meldIndex] = { ...meld, cards: [...meld.cards, card] };
        visit(own, next, deadwood.filter((_, i) => i !== index),
          points - deadwoodValue(card), [...layoffs, { card, meldIndex }]);
      }
    }
  }
  for (const own of arrangements(hand)) visit(own, [...target], own.deadwood, own.deadwoodCount, []);
  return best;
}
