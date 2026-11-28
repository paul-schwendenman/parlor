export const CHARACTERS = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'] as const;
export type Character = (typeof CHARACTERS)[number];
export const ACTIONS = ['income', 'foreign-aid', 'coup', 'tax', 'assassinate', 'steal', 'exchange'] as const;
export type CourtAction = (typeof ACTIONS)[number];

export const CLAIM: Partial<Record<CourtAction, Character>> = { tax: 'duke', assassinate: 'assassin', steal: 'captain', exchange: 'ambassador' };
export const BLOCKERS: Partial<Record<CourtAction, Character[]>> = {
  'foreign-aid': ['duke'], assassinate: ['contessa'], steal: ['captain', 'ambassador'],
};
export const COST: Partial<Record<CourtAction, number>> = { coup: 7, assassinate: 3 };
export const TARGETED: readonly CourtAction[] = ['coup', 'assassinate', 'steal'];
export const FORCED_COUP = 10;

export const CHARACTER_INFO: Record<Character, { name: string; ability: string }> = {
  duke: { name: 'Duke', ability: 'Tax: take 3 coins. Blocks Foreign Aid.' },
  assassin: { name: 'Assassin', ability: 'Pay 3 to make a player lose a card.' },
  captain: { name: 'Captain', ability: 'Take 2 coins from a player. Blocks stealing.' },
  ambassador: { name: 'Ambassador', ability: 'Swap cards with the deck. Blocks stealing.' },
  contessa: { name: 'Contessa', ability: 'Blocks assassination.' },
};

export const ACTION_INFO: Record<CourtAction, { name: string; effect: string }> = {
  income: { name: 'Income', effect: 'Take 1 coin' },
  'foreign-aid': { name: 'Foreign Aid', effect: 'Take 2 coins' },
  coup: { name: 'Coup', effect: 'Pay 7: a player loses a card' },
  tax: { name: 'Tax', effect: 'Take 3 coins' },
  assassinate: { name: 'Assassinate', effect: 'Pay 3: a player loses a card' },
  steal: { name: 'Steal', effect: 'Take 2 coins from a player' },
  exchange: { name: 'Exchange', effect: 'Draw 2, keep the best' },
};

/** For exposing and exchanging: higher is worth keeping. */
export const CARD_VALUE: Record<Character, number> = { duke: 5, assassin: 4, contessa: 4, captain: 3, ambassador: 2 };

export function deck(): Character[] {
  return CHARACTERS.flatMap((character) => [character, character, character]);
}
