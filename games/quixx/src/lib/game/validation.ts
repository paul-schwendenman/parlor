import type { Scoresheet, RowColor, DiceState, AvailableMove } from '../types/game.js';
import { ROW_NUMBERS, ROW_COLORS } from '../types/game.js';

export function numberAtCell(row: RowColor, cellIndex: number): number {
  return ROW_NUMBERS[row][cellIndex];
}

export function cellForNumber(row: RowColor, num: number): number {
  return ROW_NUMBERS[row].indexOf(num);
}

export function canMark(
  sheet: Scoresheet,
  row: RowColor,
  cellIndex: number,
  lockedRows: RowColor[],
): boolean {
  if (lockedRows.includes(row)) return false;

  const rowData = sheet[row];
  if (cellIndex < 0 || cellIndex >= rowData.length) return false;
  if (rowData[cellIndex]) return false;

  // Must be to the right of all existing marks
  const lastMarkedIndex = rowData.lastIndexOf(true);
  if (cellIndex <= lastMarkedIndex) return false;

  // Rightmost cell (index 10) requires 5+ existing marks
  if (cellIndex === 10) {
    const markCount = rowData.filter(Boolean).length;
    if (markCount < 5) return false;
  }

  return true;
}

export function getAvailablePhase1Moves(
  sheet: Scoresheet,
  dice: DiceState,
  lockedRows: RowColor[],
): AvailableMove[] {
  const whiteSum = dice.white1 + dice.white2;
  const moves: AvailableMove[] = [];

  for (const row of ROW_COLORS) {
    const cellIndex = cellForNumber(row, whiteSum);
    if (cellIndex === -1) continue;
    if (canMark(sheet, row, cellIndex, lockedRows)) {
      moves.push({
        row,
        cellIndex,
        number: whiteSum,
        source: 'white-sum',
      });
    }
  }

  return moves;
}

export function getAvailablePhase2Moves(
  sheet: Scoresheet,
  dice: DiceState,
  lockedRows: RowColor[],
  removedDice: RowColor[],
): AvailableMove[] {
  const moves: AvailableMove[] = [];
  const coloredDice: { color: RowColor; value: number }[] = [
    { color: 'red', value: dice.red },
    { color: 'yellow', value: dice.yellow },
    { color: 'green', value: dice.green },
    { color: 'blue', value: dice.blue },
  ];

  const whites: { key: 'white1' | 'white2'; value: number }[] = [
    { key: 'white1', value: dice.white1 },
    { key: 'white2', value: dice.white2 },
  ];

  for (const cd of coloredDice) {
    if (removedDice.includes(cd.color)) continue;
    for (const w of whites) {
      const sum = w.value + cd.value;
      const cellIndex = cellForNumber(cd.color, sum);
      if (cellIndex === -1) continue;
      if (canMark(sheet, cd.color, cellIndex, lockedRows)) {
        // Avoid duplicate moves (same row + cellIndex)
        if (!moves.some((m) => m.row === cd.color && m.cellIndex === cellIndex)) {
          moves.push({
            row: cd.color,
            cellIndex,
            number: sum,
            source: 'colored-combo',
            whitedie: w.key,
          });
        }
      }
    }
  }

  return moves;
}
