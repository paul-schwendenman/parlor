import type { Character, CourtAction } from './rules.js';

export type CourtPhase =
  | 'choose-action' | 'challenge-action' | 'block' | 'challenge-block' | 'answer-challenge' | 'reveal' | 'expose' | 'exchange' | 'game-over';
export type WindowKind = 'challenge-action' | 'block' | 'challenge-block';

export type CoupActionMsg =
  | { type: 'declare'; action: CourtAction; targetId?: string }
  | { type: 'challenge'; windowId: number }
  | { type: 'pass'; windowId: number }
  | { type: 'block'; windowId: number; character: Character }
  | { type: 'prove' }
  | { type: 'expose'; index: number }
  | { type: 'keep'; indices: number[] };

export interface LogEntry { id: number; text: string }

export interface CoupView {
  phase: CourtPhase;
  turnNumber: number;
  actorId: string | null;
  awaitingId: string | null;
  players: {
    id: string;
    name: string;
    bot: boolean;
    connected: boolean;
    seat: number;
    coins: number;
    hiddenCount: number;
    exposed: Character[];
    out: boolean;
  }[];
  deckCount: number;
  pending: null | {
    action: CourtAction;
    targetId: string | null;
    claim: Character | null;
    paid: number;
    challenge: null | { challengerId: string; claimantId: string; about: 'action' | 'block' };
    block: null | { blockerId: string; character: Character };
  };
  window: null | {
    id: number;
    kind: WindowKind;
    claimantId: string | null;
    claim: Character | null;
    eligibleIds: string[];
    passedIds: string[];
    endsInMs: number | null;
  };
  reveal: null | { claimantId: string; claim: Character; proved: boolean; shown: Character | null };
  log: LogEntry[];
  winnerId: string | null;
  outOrder: string[];
  me: null | {
    hand: { character: Character; exposed: boolean }[];
    actions: { action: CourtAction; targets: string[]; bluff: boolean; cost: number }[];
    mustCoup: boolean;
    respond: null | { challenge: boolean; blocks: { character: Character; bluff: boolean }[] };
    canProve: boolean;
    canExpose: boolean;
    exchangeOptions: Character[] | null;
    keepCount: number;
  };
}

declare module '@parlor/game-types' {
  interface GameViewMap { coup: CoupView }
  interface GameActionMap { coup: CoupActionMsg }
}
