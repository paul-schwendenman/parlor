export type Disc = 'flower' | 'skull';
export type SkullPhase = 'ante' | 'placing' | 'bidding' | 'revealing' | 'penalty' | 'choose-starter' | 'round-over' | 'game-over';
export interface SkullOptions { ownSkullLoss: 'choose' | 'random' }

export interface RoundResult {
  challengerId: string;
  bid: number;
  success: boolean;
  skullOwnerId: string | null;
  lostDisc: boolean;
  eliminatedId: string | null;
  nextStarterId: string | null;
}

export interface SkullPlayerView {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  seat: number;
  discCount: number;
  handCount: number;
  stackCount: number;
  flippedCount: number;
  anted: boolean;
  points: number;
  eliminated: boolean;
  /** 1 for the first player out. */
  outOrder: number | null;
  passed: boolean;
  lastBid: number | null;
}

export interface SkullView {
  phase: SkullPhase;
  round: number;
  options: SkullOptions;
  players: SkullPlayerView[];
  activePlayerId: string | null;
  starterId: string;
  totalOnMats: number;
  bid: number | null;
  bidderId: string | null;
  challengerId: string | null;
  flips: { ownerId: string; disc: Disc }[];
  skullOwnerId: string | null;
  result: RoundResult | null;
  winnerId: string | null;
  myHand: Disc[];
  myStack: Disc[];
  canAnte: boolean;
  canOpen: boolean;
  mustOpen: boolean;
  canPlace: boolean;
  legalBids: number[];
  canPass: boolean;
  flipTargets: string[];
  penalty: { kind: 'blind'; slots: number; challengerId: string } | { kind: 'choose'; discs: Disc[] } | null;
  starterChoices: string[];
}

export type SkullAction =
  | { type: 'ante'; disc: Disc }
  | { type: 'place'; disc: Disc }
  | { type: 'open'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'pass' }
  | { type: 'flip'; targetId: string }
  | { type: 'lose-disc'; index: number }
  | { type: 'choose-starter'; playerId: string };

declare module '@parlor/game-types' {
  interface GameViewMap { skull: SkullView }
  interface GameActionMap { skull: SkullAction }
}
