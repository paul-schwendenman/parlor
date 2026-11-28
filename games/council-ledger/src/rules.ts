export const permits = {
  contracts: { label: 'Contracts', detail: 'Earn 4 coins', cost: 0, coins: 4, standing: 0 },
  works: { label: 'Public works', detail: 'Spend 2 coins for 3 standing', cost: 2, coins: 0, standing: 3 },
  outreach: { label: 'Outreach', detail: 'Earn 1 coin and 2 standing', cost: 0, coins: 1, standing: 2 },
} as const;
export type Permit = keyof typeof permits;
export const permitIds = Object.keys(permits) as Permit[];
export const challengeMs = 8000;
export const maxRounds = 8;
export const goal = 12;
