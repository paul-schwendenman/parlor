import { describe, it, expect } from 'vitest';
import { AIStrategy } from '../AIStrategy.js';
import type { LiarsDiceGameState, LiarsDicePlayer } from '../../../types/game.js';

function makePlayer(id: string, dice: number[], diceCount?: number): LiarsDicePlayer {
  return {
    id,
    name: `Player ${id}`,
    connected: true,
    dice,
    diceCount: diceCount ?? dice.length,
    eliminated: false,
    isAI: id.startsWith('ai'),
  };
}

function makeState(overrides: Partial<LiarsDiceGameState> = {}): LiarsDiceGameState {
  return {
    roomCode: 'TEST',
    players: [
      makePlayer('ai1', [1, 3, 3, 5, 2]),
      makePlayer('p2', [4, 4, 6, 2, 1]),
      makePlayer('p3', [3, 5, 1, 6, 4]),
    ],
    activePlayerIndex: 0,
    phase: 'bidding',
    currentBid: null,
    previousBidderId: null,
    totalDiceInPlay: 15,
    round: 1,
    gameOver: false,
    winner: null,
    wildOnes: true,
    spotOnEnabled: true,
    revealedDice: null,
    challengeResult: null,
    spotOnResult: null,
    gameLog: [],
    bidHistory: [],
    ...overrides,
  };
}

describe('AIStrategy', () => {
  const strategy = new AIStrategy();

  describe('countMyMatching', () => {
    it('should count matching dice including wilds', () => {
      const dice = [1, 3, 3, 5, 2];
      expect(strategy.countMyMatching(dice, 3, true)).toBe(3); // two 3s + one wild 1
      expect(strategy.countMyMatching(dice, 5, true)).toBe(2); // one 5 + one wild 1
    });

    it('should not count 1s as wild when bidding on 1s', () => {
      const dice = [1, 1, 3, 5, 2];
      expect(strategy.countMyMatching(dice, 1, true)).toBe(2); // only actual 1s
    });

    it('should not use wilds when wild ones disabled', () => {
      const dice = [1, 3, 3, 5, 2];
      expect(strategy.countMyMatching(dice, 3, false)).toBe(2); // only actual 3s
    });
  });

  describe('expectedCount', () => {
    it('should return 1/3 for non-1 faces with wild ones', () => {
      expect(strategy.expectedCount(12, 3, true)).toBeCloseTo(4);
    });

    it('should return 1/6 for 1s', () => {
      expect(strategy.expectedCount(12, 1, true)).toBeCloseTo(2);
    });

    it('should return 1/6 without wild ones', () => {
      expect(strategy.expectedCount(12, 3, false)).toBeCloseTo(2);
    });
  });

  describe('decide - opening bid', () => {
    it('should make a valid opening bid when no current bid', () => {
      const state = makeState();
      const decision = strategy.decide(state);

      expect(decision.action).toBe('bid');
      if (decision.action === 'bid') {
        expect(decision.quantity).toBeGreaterThanOrEqual(1);
        expect(decision.faceValue).toBeGreaterThanOrEqual(1);
        expect(decision.faceValue).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('decide - challenge', () => {
    it('should challenge when bid is very high', () => {
      const state = makeState({
        currentBid: { playerId: 'p2', quantity: 12, faceValue: 6 },
      });

      // With 15 dice total, 12x 6s is very unlikely
      // AI has [1,3,3,5,2] - no 6s, one wild 1
      const decision = strategy.decide(state);
      expect(decision.action).toBe('challenge');
    });

    it('should challenge when bid exceeds total dice', () => {
      const state = makeState({
        currentBid: { playerId: 'p2', quantity: 16, faceValue: 3 },
      });

      const decision = strategy.decide(state);
      expect(decision.action).toBe('challenge');
    });
  });

  describe('decide - raise bid', () => {
    it('should raise bid when current bid is reasonable', () => {
      const state = makeState({
        currentBid: { playerId: 'p2', quantity: 2, faceValue: 3 },
      });

      const decision = strategy.decide(state);
      if (decision.action === 'bid') {
        // Should be a valid raise
        const isHigherQty = decision.quantity > 2;
        const isSameQtyHigherFace = decision.quantity === 2 && decision.faceValue > 3;
        expect(isHigherQty || isSameQtyHigherFace).toBe(true);
      }
      // Could also challenge, which is fine
    });
  });

  describe('decide - with few dice left', () => {
    it('should make reasonable decisions with low dice count', () => {
      const state = makeState({
        players: [
          makePlayer('ai1', [3, 5]),
          makePlayer('p2', [4, 1]),
        ],
        totalDiceInPlay: 4,
        currentBid: { playerId: 'p2', quantity: 2, faceValue: 4 },
      });

      const decision = strategy.decide(state);
      // Should either bid or challenge — both are valid
      expect(['bid', 'challenge', 'spot-on']).toContain(decision.action);
    });
  });
});
