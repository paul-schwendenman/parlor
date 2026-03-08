import type { DiceFace, ComboType } from '../../types/game.js';

export function detectCombo(faces: DiceFace[]): ComboType {
  // Blackbeard's Curse: all 6 different faces (one of each)
  const uniqueFaces = new Set(faces);
  if (uniqueFaces.size === 6) return 'blackbeards_curse';

  // Mutiny: 3+ Walk the Planks
  if (faces.filter((f) => f === 'walk_plank').length >= 3) return 'mutiny';

  // Shipwreck: 3+ X Marks the Spot
  if (faces.filter((f) => f === 'x_marks_spot').length >= 3) return 'shipwreck';

  return null;
}
