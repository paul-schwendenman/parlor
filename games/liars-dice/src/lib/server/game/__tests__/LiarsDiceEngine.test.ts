import { describe, it, expect, beforeEach } from 'vitest';
import { LiarsDiceEngine } from '../LiarsDiceEngine.js';
import type { LiarsDicePlayer } from '../../../types/game.js';

function makePlayers(count: number): LiarsDicePlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    connected: true,
    dice: [],
    diceCount: 5,
    eliminated: false,
    isAI: false,
  }));
}

describe('LiarsDiceEngine', () => {
  let engine: LiarsDiceEngine;

  beforeEach(() => {
    engine = new LiarsDiceEngine(makePlayers(3), 'TEST');
  });

  describe('initialization', () => {
    it('should create game with correct initial state', () => {
      const state = engine.getState();
      expect(state.players).toHaveLength(3);
      expect(state.phase).toBe('bidding');
      expect(state.round).toBe(1);
      expect(state.currentBid).toBeNull();
      expect(state.totalDiceInPlay).toBe(15);
      expect(state.gameOver).toBe(false);
    });

    it('should roll dice for all players on init', () => {
      const state = engine.getState();
      for (const player of state.players) {
        expect(player.dice).toHaveLength(5);
        for (const die of player.dice) {
          expect(die).toBeGreaterThanOrEqual(1);
          expect(die).toBeLessThanOrEqual(6);
        }
      }
    });
  });

  describe('player views', () => {
    it('should hide other players dice', () => {
      const state = engine.getState();
      const p1 = state.players[0];
      const view = engine.getPlayerView(p1.id);

      expect(view.myDice).toHaveLength(5);
      for (const player of view.players) {
        // dice should be null when not revealing
        expect(player.dice).toBeNull();
      }
    });

    it('should show isMyTurn correctly', () => {
      const state = engine.getState();
      const activePlayer = state.players[state.activePlayerIndex];
      const activeView = engine.getPlayerView(activePlayer.id);
      expect(activeView.isMyTurn).toBe(true);

      // Other players should not be active
      const otherPlayer = state.players.find((p) => p.id !== activePlayer.id)!;
      const otherView = engine.getPlayerView(otherPlayer.id);
      expect(otherView.isMyTurn).toBe(false);
    });
  });

  describe('bidding', () => {
    it('should accept a valid opening bid', () => {
      const state = engine.getState();
      const activeId = state.players[state.activePlayerIndex].id;
      engine.placeBid(activeId, 2, 3);

      const newState = engine.getState();
      expect(newState.currentBid).toEqual({
        playerId: activeId,
        quantity: 2,
        faceValue: 3,
      });
    });

    it('should advance to next player after bid', () => {
      const state = engine.getState();
      const firstActiveIndex = state.activePlayerIndex;
      const activeId = state.players[firstActiveIndex].id;
      engine.placeBid(activeId, 2, 3);

      const newState = engine.getState();
      expect(newState.activePlayerIndex).not.toBe(firstActiveIndex);
    });

    it('should reject bid from wrong player', () => {
      const state = engine.getState();
      const wrongPlayer = state.players.find(
        (_, i) => i !== state.activePlayerIndex,
      )!;
      expect(() => engine.placeBid(wrongPlayer.id, 2, 3)).toThrow('Not your turn');
    });

    it('should reject bid that is not higher', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 4);

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      // Same or lower bid should fail
      expect(() => engine.placeBid(p2, 2, 4)).toThrow('Bid is not high enough');
      expect(() => engine.placeBid(p2, 3, 3)).toThrow('Bid is not high enough');
    });

    it('should accept higher quantity bid', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 4);

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      engine.placeBid(p2, 4, 2); // Higher quantity, lower face is fine
      expect(engine.getState().currentBid?.quantity).toBe(4);
    });

    it('should accept same quantity with higher face', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 4);

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      engine.placeBid(p2, 3, 5);
      expect(engine.getState().currentBid?.faceValue).toBe(5);
    });
  });

  describe('isValidBid - wild ones transitions', () => {
    it('should allow halved quantity when switching to 1s', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 6, 3); // "six 3s"

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      // Switching to 1s: ceil(6/2) = 3
      engine.placeBid(p2, 3, 1);
      expect(engine.getState().currentBid).toEqual({
        playerId: p2,
        quantity: 3,
        faceValue: 1,
      });
    });

    it('should reject too-low quantity when switching to 1s', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 6, 3);

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      expect(() => engine.placeBid(p2, 2, 1)).toThrow('Bid is not high enough');
    });

    it('should require doubled+1 when switching from 1s to other', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 1); // "three 1s"

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      // From 1s to other: 3*2+1 = 7
      engine.placeBid(p2, 7, 4);
      expect(engine.getState().currentBid?.quantity).toBe(7);
    });

    it('should reject too-low when switching from 1s to other', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 1);

      const state2 = engine.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      expect(() => engine.placeBid(p2, 6, 4)).toThrow('Bid is not high enough');
    });
  });

  describe('countMatchingDice', () => {
    it('should count matching dice with wild ones', () => {
      const allDice = [
        [1, 3, 3, 5, 2],
        [3, 1, 6, 4, 1],
        [2, 3, 5, 1, 3],
      ];
      // Counting 3s: actual 3s = 5 (positions: [0][1],[0][2],[1][0],[2][1],[2][4]), wild 1s = 4 (positions: [0][0],[1][1],[1][4],[2][3]), total = 9
      const count = engine.countMatchingDice(allDice, 3);
      expect(count).toBe(9);
    });

    it('should not count 1s as wild when bidding on 1s', () => {
      const allDice = [
        [1, 3, 3, 5, 2],
        [3, 1, 6, 4, 1],
        [2, 3, 5, 1, 3],
      ];
      // Counting 1s: only actual 1s = 4
      const count = engine.countMatchingDice(allDice, 1);
      expect(count).toBe(4);
    });

    it('should count without wild ones when disabled', () => {
      const players = makePlayers(2);
      const engine2 = new LiarsDiceEngine(players, 'TEST2');
      // Access private state to disable wild ones for this test
      (engine2 as any).state.wildOnes = false;

      const allDice = [
        [1, 3, 3],
        [3, 1, 6],
      ];
      const count = engine2.countMatchingDice(allDice, 3);
      expect(count).toBe(3); // Only actual 3s, no wilds
    });
  });

  describe('challenge', () => {
    it('should resolve challenge correctly when bid is wrong', () => {
      const state = engine.getState();
      const p1Id = state.players[state.activePlayerIndex].id;

      // Make a very high bid that's likely wrong
      engine.placeBid(p1Id, 15, 6);

      const state2 = engine.getState();
      const p2Id = state2.players[state2.activePlayerIndex].id;
      engine.challenge(p2Id);

      const state3 = engine.getState();
      expect(state3.phase).toBe('challenge');
      expect(state3.challengeResult).not.toBeNull();
      expect(state3.revealedDice).not.toBeNull();

      // The bidder should lose a die since bid is almost certainly wrong
      if (state3.challengeResult!.bidWasCorrect) {
        // Very unlikely but possible - challenger loses
        const challenger = state3.players.find((p) => p.id === p2Id)!;
        expect(challenger.diceCount).toBe(4);
      } else {
        const bidder = state3.players.find((p) => p.id === p1Id)!;
        expect(bidder.diceCount).toBe(4);
      }
    });

    it('should reject challenge when no bid exists', () => {
      const state = engine.getState();
      const activeId = state.players[state.activePlayerIndex].id;
      expect(() => engine.challenge(activeId)).toThrow('No bid to challenge');
    });

    it('should reject challenge from wrong player', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 2, 3);

      const state2 = engine.getState();
      const wrongPlayer = state2.players.find(
        (_, i) => i !== state2.activePlayerIndex,
      )!;
      expect(() => engine.challenge(wrongPlayer.id)).toThrow('Not your turn');
    });
  });

  describe('spot on', () => {
    it('should resolve spot on correctly', () => {
      const state = engine.getState();
      const p1Id = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1Id, 2, 3);

      const state2 = engine.getState();
      const p2Id = state2.players[state2.activePlayerIndex].id;
      engine.spotOn(p2Id);

      const state3 = engine.getState();
      expect(state3.phase).toBe('spot-on');
      expect(state3.spotOnResult).not.toBeNull();
      expect(state3.revealedDice).not.toBeNull();
    });

    it('should reject spot on when no bid exists', () => {
      const state = engine.getState();
      const activeId = state.players[state.activePlayerIndex].id;
      expect(() => engine.spotOn(activeId)).toThrow('No bid to call spot on');
    });
  });

  describe('next round', () => {
    it('should start a new round after challenge', () => {
      const state = engine.getState();
      const p1Id = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1Id, 2, 3);

      const state2 = engine.getState();
      const p2Id = state2.players[state2.activePlayerIndex].id;
      engine.challenge(p2Id);

      engine.startNextRound();

      const state3 = engine.getState();
      expect(state3.phase).toBe('bidding');
      expect(state3.round).toBe(2);
      expect(state3.currentBid).toBeNull();
      expect(state3.revealedDice).toBeNull();
      expect(state3.challengeResult).toBeNull();
      expect(state3.bidHistory).toEqual([]);
    });
  });

  describe('elimination and game over', () => {
    it('should eliminate player when they lose all dice', () => {
      const players = makePlayers(2);
      players[0].diceCount = 1;
      players[1].diceCount = 1;
      const eng = new LiarsDiceEngine(players, 'TEST');

      const state = eng.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      // Bid impossibly high to guarantee losing
      eng.placeBid(p1, 10, 6);

      const state2 = eng.getState();
      const p2 = state2.players[state2.activePlayerIndex].id;
      eng.challenge(p2);

      const state3 = eng.getState();
      // One player should be eliminated, game should be over
      const eliminated = state3.players.filter((p) => p.eliminated);
      expect(eliminated.length).toBe(1);
      expect(state3.gameOver).toBe(true);
      expect(state3.winner).not.toBeNull();
    });
  });

  describe('getMinimumBid', () => {
    it('should return {1, 1} when no current bid', () => {
      const min = engine.getMinimumBid();
      expect(min).toEqual({ quantity: 1, faceValue: 1 });
    });

    it('should return next face value when possible', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 4);

      const min = engine.getMinimumBid();
      expect(min).toEqual({ quantity: 3, faceValue: 5 });
    });

    it('should increase quantity when at face 6', () => {
      const state = engine.getState();
      const p1 = state.players[state.activePlayerIndex].id;
      engine.placeBid(p1, 3, 6);

      const min = engine.getMinimumBid();
      expect(min).toEqual({ quantity: 4, faceValue: 1 });
    });
  });
});
