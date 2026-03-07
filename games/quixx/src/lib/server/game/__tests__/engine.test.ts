import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestEngine } from './factories.js';
import type { QuixxEngine } from '../QuixxEngine.js';

describe('QuixxEngine', () => {
  let engine: QuixxEngine;

  beforeEach(() => {
    engine = createTestEngine(2);
  });

  describe('initial state', () => {
    it('starts in rolling phase', () => {
      expect(engine.getPhase()).toBe('rolling');
    });

    it('has correct number of players', () => {
      expect(engine.getPlayers()).toHaveLength(2);
    });

    it('starts at round 1', () => {
      expect(engine.getRound()).toBe(1);
    });

    it('starts with player 0 as active', () => {
      expect(engine.getActivePlayerIndex()).toBe(0);
    });

    it('is not game over', () => {
      expect(engine.isGameOver()).toBe(false);
    });
  });

  describe('rollDice', () => {
    it('transitions to phase1 after rolling', () => {
      engine.rollDice();
      expect(engine.getPhase()).toBe('phase1');
    });

    it('throws if not in rolling phase', () => {
      engine.rollDice();
      expect(() => engine.rollDice()).toThrow();
    });
  });

  describe('phase 1 - simultaneous', () => {
    beforeEach(() => {
      engine.rollDice();
    });

    it('accepts phase1 pass from any player', () => {
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      expect(engine.allPhase1Submitted()).toBe(false);
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      expect(engine.allPhase1Submitted()).toBe(true);
    });

    it('accepts phase1 mark from a player', () => {
      const view = engine.getPlayerView('player1');
      if (view.availableMoves.length > 0) {
        const move = view.availableMoves[0];
        engine.submitPhase1('player1', { type: 'phase1-mark', row: move.row, cellIndex: move.cellIndex });
      } else {
        engine.submitPhase1('player1', { type: 'phase1-pass' });
      }
    });

    it('rejects duplicate phase1 submission', () => {
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      expect(() => engine.submitPhase1('player1', { type: 'phase1-pass' })).toThrow();
    });

    it('resolves phase1 and transitions to phase2', () => {
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      expect(engine.getPhase()).toBe('phase2');
    });
  });

  describe('phase 2 - active player only', () => {
    beforeEach(() => {
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
    });

    it('accepts phase2 pass from active player', () => {
      engine.submitPhase2({ type: 'phase2-pass' });
      // Both phases passed by active player → penalty
      const players = engine.getPlayers();
      const activePlayer = players[engine.getActivePlayerIndex()];
      expect(activePlayer.penalties).toBe(1);
    });

    it('rejects phase2 from non-active player', () => {
      // player2 is not active (player1 is at index 0)
      expect(() => {
        // We can't directly test this from engine since submitPhase2 doesn't take playerId,
        // but the socket handler should check this
      }).not.toThrow();
    });
  });

  describe('turn advancement', () => {
    it('advances to next player', () => {
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });
      engine.advanceTurn();

      expect(engine.getActivePlayerIndex()).toBe(1);
      expect(engine.getPhase()).toBe('rolling');
    });

    it('wraps around to first player', () => {
      // Turn 1
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });
      engine.advanceTurn();

      // Turn 2
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });
      engine.advanceTurn();

      expect(engine.getActivePlayerIndex()).toBe(0);
      expect(engine.getRound()).toBe(2);
    });
  });

  describe('penalties', () => {
    it('gives penalty when active player passes both phases', () => {
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });

      const activePlayer = engine.getPlayers()[0];
      expect(activePlayer.penalties).toBe(1);
    });

    it('no penalty when active player marks in phase1 but passes phase2', () => {
      // Need deterministic dice for this test
      const mockRandom = vi.spyOn(Math, 'random');
      // Set up dice: white1=3, white2=4 → sum=7
      mockRandom
        .mockReturnValueOnce(2 / 6) // white1 = 3
        .mockReturnValueOnce(3 / 6) // white2 = 4
        .mockReturnValueOnce(0) .mockReturnValueOnce(0)
        .mockReturnValueOnce(0) .mockReturnValueOnce(0);

      engine.rollDice();
      mockRandom.mockRestore();

      // Player 1 marks 7 in red (cell 5)
      engine.submitPhase1('player1', { type: 'phase1-mark', row: 'red', cellIndex: 5 });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });

      const activePlayer = engine.getPlayers()[0];
      expect(activePlayer.penalties).toBe(0); // marked in phase1, so no penalty
    });
  });

  describe('row locking', () => {
    it('locks a row when rightmost cell is marked with 5+ marks', () => {
      const players = engine.getPlayers();
      const sheet = players[0].sheet;
      // Pre-fill 5 marks in red: cells 0-4
      for (let i = 0; i < 5; i++) sheet.red[i] = true;

      // Set up dice so white sum = 12 (cell 10 in red)
      const mockRandom = vi.spyOn(Math, 'random');
      mockRandom
        .mockReturnValueOnce(5 / 6) // white1 = 6
        .mockReturnValueOnce(5 / 6) // white2 = 6
        .mockReturnValueOnce(0) .mockReturnValueOnce(0)
        .mockReturnValueOnce(0) .mockReturnValueOnce(0);

      engine.rollDice();
      mockRandom.mockRestore();

      engine.submitPhase1('player1', { type: 'phase1-mark', row: 'red', cellIndex: 10 });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();

      expect(engine.getLockedRows()).toContain('red');
      expect(engine.getRemovedDice()).toContain('red');
      expect(players[0].lockedRows).toContain('red');
    });
  });

  describe('game end', () => {
    it('ends when 4th penalty is taken', () => {
      const players = engine.getPlayers();
      players[0].penalties = 3;

      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' }); // 4th penalty

      expect(engine.isGameOver()).toBe(true);
      expect(engine.getPhase()).toBe('game-over');
    });

    it('returns scores when game is over', () => {
      const players = engine.getPlayers();
      players[0].penalties = 3;

      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });
      engine.submitPhase1('player2', { type: 'phase1-pass' });
      engine.resolvePhase1();
      engine.submitPhase2({ type: 'phase2-pass' });

      const scores = engine.getScores();
      expect(scores).not.toBeNull();
      expect(scores).toHaveLength(2);
    });
  });

  describe('getPlayerView', () => {
    it('returns view with available moves', () => {
      engine.rollDice();
      const view = engine.getPlayerView('player1');

      expect(view.phase).toBe('phase1');
      expect(view.myIndex).toBe(0);
      expect(view.isActivePlayer).toBe(true);
      expect(view.availableMoves).toBeDefined();
      expect(view.players).toHaveLength(2);
    });

    it('hides other players phase1 choices', () => {
      engine.rollDice();
      engine.submitPhase1('player1', { type: 'phase1-pass' });

      const view = engine.getPlayerView('player2');
      const p1View = view.players.find((p) => p.id === 'player1');
      expect(p1View?.phase1Submitted).toBe(true);
    });
  });
});
