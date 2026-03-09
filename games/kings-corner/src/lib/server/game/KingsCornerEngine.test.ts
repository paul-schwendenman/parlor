import { describe, it, expect, beforeEach } from 'vitest';
import { KingsCornerEngine } from './KingsCornerEngine.js';
import type { Card, PilePosition } from '../../types/game.js';
import { CARDINAL_POSITIONS, CORNER_POSITIONS } from '../../types/game.js';

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
  }));
}

describe('KingsCornerEngine', () => {
  let engine: KingsCornerEngine;

  beforeEach(() => {
    engine = new KingsCornerEngine(makePlayers(2), 'TEST');
  });

  describe('initialization', () => {
    it('should deal 7 cards to each player', () => {
      const view = engine.getPlayerView('player-0');
      expect(view.myHand).toHaveLength(7);

      const view1 = engine.getPlayerView('player-1');
      expect(view1.myHand).toHaveLength(7);
    });

    it('should have 1 card on each cardinal pile', () => {
      const view = engine.getPlayerView('player-0');
      for (const pos of CARDINAL_POSITIONS) {
        const pile = view.piles.find((p) => p.position === pos);
        expect(pile?.cards).toHaveLength(1);
      }
    });

    it('should have empty corner piles', () => {
      const view = engine.getPlayerView('player-0');
      for (const pos of CORNER_POSITIONS) {
        const pile = view.piles.find((p) => p.position === pos);
        expect(pile?.cards).toHaveLength(0);
      }
    });

    it('should have correct draw pile count', () => {
      // 52 - (7*2 players) - (4 cardinal) = 52 - 14 - 4 = 34
      const view = engine.getPlayerView('player-0');
      expect(view.drawPileCount).toBe(34);
    });

    it('should start in drawing phase', () => {
      const view = engine.getPlayerView('player-0');
      expect(view.phase).toBe('drawing');
    });

    it('should have player 0 as active', () => {
      const view = engine.getPlayerView('player-0');
      expect(view.isActivePlayer).toBe(true);
      expect(view.activePlayerIndex).toBe(0);
    });
  });

  describe('draw phase', () => {
    it('should transition to playing phase after drawing', () => {
      engine.drawCard('player-0');
      const view = engine.getPlayerView('player-0');
      expect(view.phase).toBe('playing');
      expect(view.myHand).toHaveLength(8);
    });

    it('should reject draw from non-active player', () => {
      expect(() => engine.drawCard('player-1')).toThrow('Not your turn');
    });

    it('should reject play-card during drawing phase', () => {
      const view = engine.getPlayerView('player-0');
      const card = view.myHand[0];
      expect(() => engine.playCard('player-0', card, 'north')).toThrow('Not in playing phase');
    });
  });

  describe('playing cards', () => {
    beforeEach(() => {
      engine.drawCard('player-0');
    });

    it('should reject play from non-active player', () => {
      const view = engine.getPlayerView('player-1');
      if (view.myHand.length > 0) {
        expect(() => engine.playCard('player-1', view.myHand[0], 'north')).toThrow('Not your turn');
      }
    });

    it('should reject card not in hand', () => {
      const fakeCard: Card = { suit: 'hearts', rank: 'A' };
      // This might be in hand, but try a specific combo
      expect(() => engine.playCard('player-0', fakeCard, 'north')).toThrow();
    });

    it('should allow playing a valid card on a pile', () => {
      const view = engine.getPlayerView('player-0');
      if (view.playableCards.length > 0) {
        const { card, validTargets } = view.playableCards[0];
        engine.playCard('player-0', card, validTargets[0]);
        const newView = engine.getPlayerView('player-0');
        expect(newView.myHand.length).toBe(view.myHand.length - 1);
      }
    });
  });

  describe('kings rule', () => {
    it('should only allow kings in empty corner positions', () => {
      // We need a controlled setup for this test
      // Create engine and manually test the rule via playableCards
      engine.drawCard('player-0');
      const view = engine.getPlayerView('player-0');

      for (const pc of view.playableCards) {
        if (pc.card.rank === 'K') {
          // Kings should only target empty corners
          for (const target of pc.validTargets) {
            expect(['northeast', 'southeast', 'southwest', 'northwest']).toContain(target);
          }
        }
      }
    });
  });

  describe('moving piles', () => {
    beforeEach(() => {
      engine.drawCard('player-0');
    });

    it('should reject move from non-active player', () => {
      expect(() => engine.movePile('player-1', 'north', 'south')).toThrow('Not your turn');
    });

    it('should reject move of pile onto itself', () => {
      expect(() => engine.movePile('player-0', 'north', 'north')).toThrow('Cannot move pile onto itself');
    });

    it('should reject move during drawing phase', () => {
      const engine2 = new KingsCornerEngine(makePlayers(2), 'TEST2');
      expect(() => engine2.movePile('player-0', 'north', 'south')).toThrow('Not in playing phase');
    });
  });

  describe('end turn', () => {
    function playMandatoryKings(engine: KingsCornerEngine, playerId: string) {
      // Play any mandatory kings before ending turn
      let view = engine.getPlayerView(playerId);
      while (view.mustPlayKing) {
        const kingPlay = view.playableCards.find((pc) => pc.card.rank === 'K');
        if (!kingPlay) break;
        engine.playCard(playerId, kingPlay.card, kingPlay.validTargets[0]);
        view = engine.getPlayerView(playerId);
        if (view.gameOver) return;
      }
    }

    it('should advance to next player after ending turn', () => {
      engine.drawCard('player-0');
      playMandatoryKings(engine, 'player-0');
      if (engine.isGameOver()) return;
      engine.endTurn('player-0');

      const view = engine.getPlayerView('player-1');
      expect(view.isActivePlayer).toBe(true);
      expect(view.phase).toBe('drawing');
    });

    it('should reject end turn from non-active player', () => {
      engine.drawCard('player-0');
      expect(() => engine.endTurn('player-1')).toThrow('Not your turn');
    });

    it('should cycle back to first player', () => {
      engine.drawCard('player-0');
      playMandatoryKings(engine, 'player-0');
      if (engine.isGameOver()) return;
      engine.endTurn('player-0');

      engine.drawCard('player-1');
      playMandatoryKings(engine, 'player-1');
      if (engine.isGameOver()) return;
      engine.endTurn('player-1');

      const view = engine.getPlayerView('player-0');
      expect(view.isActivePlayer).toBe(true);
    });
  });

  describe('mandatory kings rule', () => {
    it('should report mustPlayKing when player has king and corner is open', () => {
      engine.drawCard('player-0');
      const view = engine.getPlayerView('player-0');

      if (view.myHand.some((c) => c.rank === 'K')) {
        expect(view.mustPlayKing).toBe(true);
        expect(view.canEndTurn).toBe(false);
      }
    });

    it('should block end turn when mandatory king play exists', () => {
      // Keep creating engines until player-0 has a King
      let testEngine: KingsCornerEngine;
      let attempts = 0;
      let hasKing = false;

      while (!hasKing && attempts < 100) {
        testEngine = new KingsCornerEngine(makePlayers(2), 'TEST-MK');
        testEngine.drawCard('player-0');
        const view = testEngine.getPlayerView('player-0');
        hasKing = view.myHand.some((c) => c.rank === 'K');
        if (hasKing) {
          expect(() => testEngine.endTurn('player-0')).toThrow('You must play a King');
        }
        attempts++;
      }
    });
  });

  describe('spectator view', () => {
    it('should return empty hand for spectator', () => {
      const view = engine.getSpectatorView();
      expect(view.myHand).toHaveLength(0);
      expect(view.myIndex).toBe(-1);
      expect(view.isActivePlayer).toBe(false);
      expect(view.playableCards).toHaveLength(0);
      expect(view.movablePiles).toHaveLength(0);
    });

    it('should show all 8 piles', () => {
      const view = engine.getSpectatorView();
      expect(view.piles).toHaveLength(8);
    });
  });

  describe('disconnect handling', () => {
    it('should auto-draw and end turn for disconnected active player', () => {
      engine.handleDisconnect('player-0');

      const view = engine.getPlayerView('player-1');
      expect(view.isActivePlayer).toBe(true);
    });

    it('should mark player as disconnected', () => {
      engine.handleDisconnect('player-0');

      const view = engine.getPlayerView('player-1');
      const p0 = view.players.find((p) => p.id === 'player-0');
      expect(p0?.connected).toBe(false);
    });

    it('should handle reconnect', () => {
      engine.handleDisconnect('player-0');
      engine.handleReconnect('player-0');

      const view = engine.getPlayerView('player-0');
      const p0 = view.players.find((p) => p.id === 'player-0');
      expect(p0?.connected).toBe(true);
    });
  });

  describe('with 4 players', () => {
    it('should deal correctly for 4 players', () => {
      const engine4 = new KingsCornerEngine(makePlayers(4), 'TEST4');
      // 52 - (7*4) - 4 = 52 - 28 - 4 = 20
      const view = engine4.getPlayerView('player-0');
      expect(view.drawPileCount).toBe(20);
      expect(view.myHand).toHaveLength(7);
      expect(view.players).toHaveLength(4);
    });
  });
});
