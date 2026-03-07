import type { DiceState, RowColor } from '../../types/game.js';

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollAllDice(removedDice: RowColor[]): DiceState {
  return {
    white1: rollDie(),
    white2: rollDie(),
    red: removedDice.includes('red') ? 0 : rollDie(),
    yellow: removedDice.includes('yellow') ? 0 : rollDie(),
    green: removedDice.includes('green') ? 0 : rollDie(),
    blue: removedDice.includes('blue') ? 0 : rollDie(),
    rolled: true,
  };
}

export function getWhiteSum(dice: DiceState): number {
  return dice.white1 + dice.white2;
}

export interface ColoredCombo {
  whitedie: 'white1' | 'white2';
  whiteValue: number;
  color: RowColor;
  colorValue: number;
  sum: number;
}

export function getColoredCombos(dice: DiceState, removedDice: RowColor[]): ColoredCombo[] {
  const combos: ColoredCombo[] = [];
  const colors: { color: RowColor; value: number }[] = [
    { color: 'red', value: dice.red },
    { color: 'yellow', value: dice.yellow },
    { color: 'green', value: dice.green },
    { color: 'blue', value: dice.blue },
  ];

  const whites: { key: 'white1' | 'white2'; value: number }[] = [
    { key: 'white1', value: dice.white1 },
    { key: 'white2', value: dice.white2 },
  ];

  for (const c of colors) {
    if (removedDice.includes(c.color)) continue;
    for (const w of whites) {
      combos.push({
        whitedie: w.key,
        whiteValue: w.value,
        color: c.color,
        colorValue: c.value,
        sum: w.value + c.value,
      });
    }
  }

  return combos;
}
