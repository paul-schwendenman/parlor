/** The sixteen classic cubes. "Q" stands for the "Qu" face. */
export const DICE = [
  'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS', 'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
  'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW', 'EIOSST', 'ELRTTY', 'HIMNQU', 'HLNNRZ',
] as const;
export const SIZE = 4;
export const MIN_LENGTH = 3;

/** The text on a face: Q is printed "Qu". */
export function faceText(face: string) {
  return face === 'Q' ? 'Qu' : face;
}

export function points(word: string) {
  const length = word.length;
  if (length < MIN_LENGTH) return 0;
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  return 11;
}

export function neighbours(cell: number) {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if ((dr || dc) && r >= 0 && r < SIZE && c >= 0 && c < SIZE) result.push(r * SIZE + c);
    }
  }
  return result;
}

/** Normalises typing: lowercase letters only. */
export function normalise(word: string) {
  return word.trim().toLowerCase().replace(/[^a-z]/g, '');
}

/** A path of cells that spells `word` on the grid, or null. */
export function findPath(grid: readonly string[], word: string): number[] | null {
  const target = normalise(word);
  const walk = (cell: number, at: number, used: number[]): number[] | null => {
    const face = grid[cell].toLowerCase() === 'q' ? 'qu' : grid[cell].toLowerCase();
    if (!target.startsWith(face, at)) return null;
    const next = at + face.length;
    const path = [...used, cell];
    if (next === target.length) return path;
    for (const other of neighbours(cell)) {
      if (path.includes(other)) continue;
      const found = walk(other, next, path);
      if (found) return found;
    }
    return null;
  };
  for (let cell = 0; cell < grid.length; cell++) {
    const found = walk(cell, 0, []);
    if (found) return found;
  }
  return null;
}
