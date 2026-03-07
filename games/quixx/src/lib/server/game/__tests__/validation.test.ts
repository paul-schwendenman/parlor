import { describe, it, expect } from 'vitest';
import { canMark, getAvailablePhase1Moves, getAvailablePhase2Moves, numberAtCell, cellForNumber } from '../../../game/validation.js';
import { createTestSheet } from './factories.js';
import type { DiceState } from '../../../types/game.js';

describe('numberAtCell', () => {
  it('returns correct numbers for ascending rows', () => {
    expect(numberAtCell('red', 0)).toBe(2);
    expect(numberAtCell('red', 10)).toBe(12);
    expect(numberAtCell('yellow', 5)).toBe(7);
  });

  it('returns correct numbers for descending rows', () => {
    expect(numberAtCell('green', 0)).toBe(12);
    expect(numberAtCell('green', 10)).toBe(2);
    expect(numberAtCell('blue', 5)).toBe(7);
  });
});

describe('cellForNumber', () => {
  it('returns correct cell index for ascending rows', () => {
    expect(cellForNumber('red', 2)).toBe(0);
    expect(cellForNumber('red', 12)).toBe(10);
  });

  it('returns correct cell index for descending rows', () => {
    expect(cellForNumber('green', 12)).toBe(0);
    expect(cellForNumber('green', 2)).toBe(10);
  });

  it('returns -1 for invalid numbers', () => {
    expect(cellForNumber('red', 1)).toBe(-1);
    expect(cellForNumber('red', 13)).toBe(-1);
  });
});

describe('canMark', () => {
  it('allows marking an empty cell to the right of all marks', () => {
    const sheet = createTestSheet();
    expect(canMark(sheet, 'red', 0, [])).toBe(true);
  });

  it('allows marking a cell after a gap', () => {
    const sheet = createTestSheet();
    sheet.red[0] = true;
    expect(canMark(sheet, 'red', 5, [])).toBe(true);
  });

  it('rejects marking to the left of existing marks', () => {
    const sheet = createTestSheet();
    sheet.red[5] = true;
    expect(canMark(sheet, 'red', 3, [])).toBe(false);
  });

  it('rejects marking an already marked cell', () => {
    const sheet = createTestSheet();
    sheet.red[3] = true;
    expect(canMark(sheet, 'red', 3, [])).toBe(false);
  });

  it('rejects marking a locked row', () => {
    const sheet = createTestSheet();
    expect(canMark(sheet, 'red', 0, ['red'])).toBe(false);
  });

  it('rejects marking rightmost cell with fewer than 5 marks', () => {
    const sheet = createTestSheet();
    sheet.red[0] = true;
    sheet.red[1] = true;
    expect(canMark(sheet, 'red', 10, [])).toBe(false); // only 2 marks
  });

  it('allows marking rightmost cell with 5+ marks', () => {
    const sheet = createTestSheet();
    for (let i = 0; i < 5; i++) sheet.red[i] = true;
    expect(canMark(sheet, 'red', 10, [])).toBe(true);
  });
});

describe('getAvailablePhase1Moves', () => {
  it('returns all valid cells for the white sum', () => {
    const sheet = createTestSheet();
    const dice: DiceState = { white1: 3, white2: 4, red: 1, yellow: 2, green: 3, blue: 4, rolled: true };
    // White sum = 7
    const moves = getAvailablePhase1Moves(sheet, dice, []);
    // 7 is available in all 4 rows
    expect(moves.length).toBe(4);
    expect(moves.every((m) => m.number === 7)).toBe(true);
    expect(moves.every((m) => m.source === 'white-sum')).toBe(true);
  });

  it('excludes locked rows', () => {
    const sheet = createTestSheet();
    const dice: DiceState = { white1: 3, white2: 4, red: 1, yellow: 2, green: 3, blue: 4, rolled: true };
    const moves = getAvailablePhase1Moves(sheet, dice, ['red']);
    expect(moves.find((m) => m.row === 'red')).toBeUndefined();
  });

  it('excludes rows where the white sum cell is not available', () => {
    const sheet = createTestSheet();
    sheet.red[6] = true; // marked cell 6 (number 8) — so 7 (cell 5) is to the left, invalid
    const dice: DiceState = { white1: 3, white2: 4, red: 1, yellow: 2, green: 3, blue: 4, rolled: true };
    const moves = getAvailablePhase1Moves(sheet, dice, []);
    expect(moves.find((m) => m.row === 'red')).toBeUndefined();
  });
});

describe('getAvailablePhase2Moves', () => {
  it('returns colored combo moves for active player', () => {
    const sheet = createTestSheet();
    const dice: DiceState = { white1: 3, white2: 4, red: 5, yellow: 2, green: 3, blue: 4, rolled: true };
    const moves = getAvailablePhase2Moves(sheet, dice, [], []);
    // white1+red=8 on red row, white2+red=9 on red row
    // white1+yellow=5 on yellow row, white2+yellow=6 on yellow row
    // white1+green=6 on green row, white2+green=7 on green row
    // white1+blue=7 on blue row, white2+blue=8 on blue row
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.source === 'colored-combo')).toBe(true);
  });

  it('excludes removed dice', () => {
    const sheet = createTestSheet();
    const dice: DiceState = { white1: 3, white2: 4, red: 5, yellow: 2, green: 3, blue: 4, rolled: true };
    const moves = getAvailablePhase2Moves(sheet, dice, [], ['red']);
    expect(moves.find((m) => m.row === 'red')).toBeUndefined();
  });
});
