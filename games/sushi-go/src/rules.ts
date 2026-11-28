export type SushiCard =
  | { id: number; kind: 'tempura' | 'sashimi' | 'dumpling' | 'wasabi' | 'pudding' | 'chopsticks' }
  | { id: number; kind: 'maki'; count: 1 | 2 | 3 }
  | { id: number; kind: 'nigiri'; value: 1 | 2 | 3 };

type Distributive<T> = T extends unknown ? Omit<T, 'id'> : never;
export type SushiFace = Distributive<SushiCard>;

export interface PlateCard {
  card: SushiCard;
  /** Wasabi: the nigiri on it. Nigiri: the Wasabi under it. */
  pairedWith: number | null;
  /** The pick (1-based) it arrived on. */
  turn: number;
}

export interface RoundScore {
  tempura: number;
  sashimi: number;
  dumpling: number;
  maki: number;
  nigiri: number;
  makiIcons: number;
  total: number;
}

export const ROUNDS = 3;
export const DECK_SIZE = 108;
export const DUMPLING = [0, 1, 3, 6, 10, 15];
const NIGIRI_NAMES = { 1: 'Egg Nigiri', 2: 'Salmon Nigiri', 3: 'Squid Nigiri' } as const;

export function handSize(players: number) {
  return 12 - players;
}

export function buildDeck(): SushiCard[] {
  const cards: SushiFace[] = [];
  const add = (count: number, card: SushiFace) => { for (let i = 0; i < count; i++) cards.push(card); };
  add(14, { kind: 'tempura' });
  add(14, { kind: 'sashimi' });
  add(14, { kind: 'dumpling' });
  add(6, { kind: 'maki', count: 1 });
  add(12, { kind: 'maki', count: 2 });
  add(8, { kind: 'maki', count: 3 });
  add(5, { kind: 'nigiri', value: 1 });
  add(10, { kind: 'nigiri', value: 2 });
  add(5, { kind: 'nigiri', value: 3 });
  add(6, { kind: 'wasabi' });
  add(10, { kind: 'pudding' });
  add(4, { kind: 'chopsticks' });
  return cards.map((card, id): SushiCard => ({ ...card, id }));
}

export function cardName(card: SushiCard): string {
  switch (card.kind) {
    case 'maki': return `Maki Roll ×${card.count}`;
    case 'nigiri': return NIGIRI_NAMES[card.value];
    default: return card.kind.charAt(0).toUpperCase() + card.kind.slice(1);
  }
}

export function cardHint(card: SushiCard): string {
  switch (card.kind) {
    case 'tempura': return '5 per pair';
    case 'sashimi': return '10 per set of 3';
    case 'dumpling': return '1 3 6 10 15';
    case 'maki': return 'Most rolls 6, next 3';
    case 'nigiri': return `${card.value}, or ${card.value * 3} on Wasabi`;
    case 'wasabi': return 'Next nigiri ×3';
    case 'pudding': return 'End: most +6, fewest −6';
    case 'chopsticks': return 'Later: take 2 at once';
  }
}

/** Puts a nigiri on the oldest empty Wasabi, if there is one. */
export function addToPlate(plate: PlateCard[], card: SushiCard, turn: number) {
  const entry: PlateCard = { card, pairedWith: null, turn };
  if (card.kind === 'nigiri') {
    const wasabi = plate.find((item) => item.card.kind === 'wasabi' && item.pairedWith === null);
    if (wasabi) {
      wasabi.pairedWith = card.id;
      entry.pairedWith = wasabi.card.id;
    }
  }
  plate.push(entry);
}

export function usableChopsticks(plate: readonly PlateCard[], pick: number) {
  return plate.find((item) => item.card.kind === 'chopsticks' && item.turn < pick);
}

export function makiIcons(plate: readonly PlateCard[]) {
  return plate.reduce((sum, { card }) => sum + (card.kind === 'maki' ? card.count : 0), 0);
}

/** Round points for one plate, maki aside. */
export function scorePlate(plate: readonly PlateCard[]): Omit<RoundScore, 'maki' | 'total'> {
  const count = (kind: SushiCard['kind']) => plate.filter(({ card }) => card.kind === kind).length;
  return {
    tempura: Math.floor(count('tempura') / 2) * 5,
    sashimi: Math.floor(count('sashimi') / 3) * 10,
    dumpling: DUMPLING[Math.min(count('dumpling'), 5)],
    nigiri: plate.reduce((sum, { card, pairedWith }) => sum + (card.kind === 'nigiri' ? card.value * (pairedWith === null ? 1 : 3) : 0), 0),
    makiIcons: makiIcons(plate),
  };
}

/** 6 split among the most icons; 3 split among the next, only when first is not shared. */
export function scoreMaki(icons: readonly number[]): number[] {
  const points = icons.map(() => 0);
  const top = Math.max(0, ...icons);
  if (!top) return points;
  const first = icons.flatMap((n, i) => n === top ? [i] : []);
  for (const i of first) points[i] = Math.floor(6 / first.length);
  if (first.length > 1) return points;
  const second = Math.max(0, ...icons.filter((n) => n < top));
  if (!second) return points;
  const runners = icons.flatMap((n, i) => n === second ? [i] : []);
  for (const i of runners) points[i] = Math.floor(3 / runners.length);
  return points;
}

export function scorePuddings(counts: readonly number[]): number[] {
  const most = Math.max(...counts);
  const fewest = Math.min(...counts);
  if (most === fewest) return counts.map(() => 0);
  const top = counts.filter((n) => n === most).length;
  const bottom = counts.filter((n) => n === fewest).length;
  return counts.map((n) => (n === most ? Math.floor(6 / top) : 0) - (n === fewest && counts.length > 2 ? Math.floor(6 / bottom) : 0));
}
