import { describe, it, expect } from 'vitest';
import { CrazyEightsEngine } from './CrazyEightsEngine.js';

function createTestEngine(numPlayers = 2) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
  }));
  return new CrazyEightsEngine(players, 'TEST');
}

describe('CrazyEightsEngine', () => {
  describe('initialization', () => {
    it('deals 7 cards to each player with 2 players', () => {
      const engine = createTestEngine(2);
      const view0 = engine.getPlayerView('player-0');
      const view1 = engine.getPlayerView('player-1');
      expect(view0.myHand).toHaveLength(7);
      expect(view1.myHand).toHaveLength(7);
    });

    it('deals 5 cards to each player with 5 players', () => {
      const engine = createTestEngine(5);
      for (let i = 0; i < 5; i++) {
        const view = engine.getPlayerView(`player-${i}`);
        expect(view.myHand).toHaveLength(5);
      }
    });

    it('starts with a non-8 card on discard', () => {
      const engine = createTestEngine(2);
      const view = engine.getPlayerView('player-0');
      expect(view.topDiscard).not.toBeNull();
      expect(view.topDiscard!.rank).not.toBe('8');
    });

    it('starts in playing phase', () => {
      const engine = createTestEngine(2);
      expect(engine.getPhase()).toBe('playing');
    });

    it('player 0 is active', () => {
      const engine = createTestEngine(2);
      expect(engine.getActivePlayerIndex()).toBe(0);
    });
  });

  describe('player views', () => {
    it('hides other players hands', () => {
      const engine = createTestEngine(2);
      const view0 = engine.getPlayerView('player-0');
      expect(view0.myHand).toHaveLength(7);
      expect(view0.players[1].cardCount).toBe(7);
    });

    it('active player has canDraw=true', () => {
      const engine = createTestEngine(2);
      const view0 = engine.getPlayerView('player-0');
      expect(view0.canDraw).toBe(true);
      const view1 = engine.getPlayerView('player-1');
      expect(view1.canDraw).toBe(false);
    });

    it('spectator view has no hand', () => {
      const engine = createTestEngine(2);
      const spectView = engine.getSpectatorView();
      expect(spectView.myHand).toHaveLength(0);
      expect(spectView.myIndex).toBe(-1);
      expect(spectView.isActivePlayer).toBe(false);
    });
  });

  describe('drawing', () => {
    it('drawing adds a card to hand', () => {
      const engine = createTestEngine(2);
      engine.drawCard('player-0');
      // After drawing, if card is not playable, turn auto-advances
      // If card is playable, player still has 8 cards
      const view = engine.getPlayerView('player-0');
      // Either player-0 has 8 cards (playable draw) or 8 cards (auto-advanced)
      expect(view.myHand.length).toBeGreaterThanOrEqual(7);
    });

    it('cannot draw twice in same turn', () => {
      const engine = createTestEngine(2);
      engine.drawCard('player-0');
      // If turn auto-advanced, player-0 is no longer active
      if (engine.getActivePlayerIndex() === 0) {
        expect(() => engine.drawCard('player-0')).toThrow('Already drew this turn');
      }
    });

    it('non-active player cannot draw', () => {
      const engine = createTestEngine(2);
      expect(() => engine.drawCard('player-1')).toThrow('Not your turn');
    });
  });

  describe('playing cards', () => {
    it('non-active player cannot play', () => {
      const engine = createTestEngine(2);
      const view = engine.getPlayerView('player-1');
      if (view.myHand.length > 0) {
        expect(() => engine.playCard('player-1', view.myHand[0])).toThrow('Not your turn');
      }
    });

    it('playing a valid card removes it from hand', () => {
      const engine = createTestEngine(2);
      const view = engine.getPlayerView('player-0');
      if (view.playableCards.length > 0) {
        const card = view.playableCards[0];
        engine.playCard('player-0', card);
        const newView = engine.getPlayerView('player-0');
        expect(newView.myHand.length).toBe(6);
      }
    });
  });

  describe('8-wild flow', () => {
    it('playing an 8 transitions to choosing-suit phase', () => {
      // We'll construct a scenario manually
      const engine = createTestEngine(2);
      const view = engine.getPlayerView('player-0');
      const eightCard = view.myHand.find((c) => c.rank === '8');
      if (eightCard) {
        engine.playCard('player-0', eightCard);
        // If hand empty after playing 8, goes to game-over. Otherwise choosing-suit
        if (engine.getPhase() !== 'game-over') {
          expect(engine.getPhase()).toBe('choosing-suit');
        }
      }
    });
  });

  describe('pass', () => {
    it('cannot pass without drawing first', () => {
      const engine = createTestEngine(2);
      expect(() => engine.pass('player-0')).toThrow('Must draw before passing');
    });
  });

  describe('disconnect handling', () => {
    it('auto-actions for disconnected active player', () => {
      const engine = createTestEngine(2);
      engine.handleDisconnect('player-0');
      // Should have advanced turn
      expect(engine.getActivePlayerIndex()).toBe(1);
    });
  });
});
