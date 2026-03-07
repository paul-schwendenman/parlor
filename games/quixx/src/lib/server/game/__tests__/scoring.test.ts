import { describe, it, expect } from 'vitest';
import { scoreRow, totalScore, computeAllScores } from '../scoring.js';
import { createTestPlayer } from './factories.js';

describe('scoreRow', () => {
  it('returns 0 for no marks', () => {
    expect(scoreRow(Array(11).fill(false))).toBe(0);
  });

  it('returns 1 for 1 mark', () => {
    const row = Array(11).fill(false);
    row[0] = true;
    expect(scoreRow(row)).toBe(1);
  });

  it('returns 3 for 2 marks', () => {
    const row = Array(11).fill(false);
    row[0] = true;
    row[1] = true;
    expect(scoreRow(row)).toBe(3);
  });

  it('returns triangular numbers for 0-12 marks', () => {
    const expected = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
    for (let n = 0; n <= 12; n++) {
      const row = Array(11).fill(false);
      // fill first min(n, 11) cells
      for (let i = 0; i < Math.min(n, 11); i++) row[i] = true;
      // For 12 marks, we pass hasLock=true
      expect(scoreRow(row, n > 11)).toBe(expected[n]);
    }
  });
});

describe('totalScore', () => {
  it('returns 0 for empty sheet with no penalties', () => {
    const player = createTestPlayer('p1', 'P1');
    expect(totalScore(player)).toBe(0);
  });

  it('subtracts 5 per penalty', () => {
    const player = createTestPlayer('p1', 'P1');
    player.penalties = 2;
    expect(totalScore(player)).toBe(-10);
  });

  it('adds row scores correctly', () => {
    const player = createTestPlayer('p1', 'P1');
    // 3 marks in red = 6 pts
    player.sheet.red[0] = true;
    player.sheet.red[1] = true;
    player.sheet.red[2] = true;
    // 2 marks in yellow = 3 pts
    player.sheet.yellow[0] = true;
    player.sheet.yellow[1] = true;
    expect(totalScore(player)).toBe(9);
  });

  it('counts lock bonus', () => {
    const player = createTestPlayer('p1', 'P1');
    // 5 marks + lock = 6 marks = 21 pts
    for (let i = 0; i < 5; i++) player.sheet.red[i] = true;
    player.sheet.red[10] = true; // rightmost
    player.lockedRows = ['red'];
    expect(totalScore(player)).toBe(28); // 7 marks (6 cells + lock) = 28
  });
});

describe('computeAllScores', () => {
  it('computes scores for all players and sorts by total', () => {
    const p1 = createTestPlayer('p1', 'Player 1');
    const p2 = createTestPlayer('p2', 'Player 2');
    // p1 has 2 marks = 3 pts
    p1.sheet.red[0] = true;
    p1.sheet.red[1] = true;
    // p2 has 3 marks = 6 pts
    p2.sheet.red[0] = true;
    p2.sheet.red[1] = true;
    p2.sheet.red[2] = true;

    const scores = computeAllScores([p1, p2]);
    expect(scores[0].playerId).toBe('p2');
    expect(scores[0].total).toBe(6);
    expect(scores[1].playerId).toBe('p1');
    expect(scores[1].total).toBe(3);
  });
});
