import type { Die, DiceFace, ComboType, DiceResult } from '../../types/game.js';
import { DICE_FACES } from '../../types/game.js';
import { detectCombo } from './comboDetector.js';

export class DiceRoller {
  createFreshDice(): Die[] {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      face: 'doubloon' as DiceFace,
      locked: false,
      rolling: false,
    }));
  }

  roll(dice: Die[]): DiceResult {
    const newDice = dice.map((die) => {
      if (die.locked) return { ...die, rolling: false };
      return {
        ...die,
        face: DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)],
        rolling: false,
      };
    });

    const combo = detectCombo(newDice.map((d) => d.face));
    const bonusCount = this.countBonus(newDice, combo);

    return { dice: newDice, combo, bonusCount };
  }

  private countBonus(dice: Die[], combo: ComboType): number {
    if (!combo) return 0;

    const faces = dice.map((d) => d.face);

    if (combo === 'mutiny') {
      return faces.filter((f) => f === 'walk_plank').length - 3;
    }
    if (combo === 'shipwreck') {
      return faces.filter((f) => f === 'x_marks_spot').length - 3;
    }
    return 0;
  }
}
