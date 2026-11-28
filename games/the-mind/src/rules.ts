export const MAX_LIVES = 5;
export const MAX_STARS = 3;
export const BREATH_MS = 1200;
export const VOTE_MS = 20000;
export const REVEAL_MS = { mistake: 3000, 'star-reveal': 2500, 'level-complete': 3500 } as const;
export type Reward = 'life' | 'star';

export const LEVELS_BY_PLAYERS: Record<number, number> = { 2: 12, 3: 10, 4: 8 };
export const REWARDS: Record<number, Reward> = { 2: 'star', 3: 'life', 5: 'star', 6: 'life', 8: 'star', 9: 'life' };

export function startingLives(players: number) {
  return players;
}

export function rewardFor(level: number): Reward | null {
  return REWARDS[level] ?? null;
}

/** The next reward still ahead of `level` (inclusive) within the game. */
export function nextReward(level: number, totalLevels: number) {
  for (let at = level; at <= totalLevels; at++) {
    const reward = rewardFor(at);
    if (reward) return { level: at, reward };
  }
  return null;
}

/** A bot's wait before playing its lowest card, counted from the last card that landed. */
export function botDelay(lowest: number, pileTop: number | null, remaining: number, jitter: number) {
  const top = pileTop ?? 0;
  const spacing = (100 - top) / (remaining + 1);
  const msPerPoint = Math.min(700, Math.max(250, 4000 / spacing));
  return Math.min(30000, Math.max(300, (lowest - top) * msPerPoint)) * jitter;
}
