export const COLUMNS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Column = (typeof COLUMNS)[number];
export const HEIGHT: Record<Column, number> = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};
export const MAX_RUNNERS = 3;
export type ColumnMap<T> = Partial<Record<Column, T>>;
/** Columns to advance, in order; one or two of them, sorted ascending. */
export type Move = [Column] | [Column, Column];

export interface PairingOption {
  pairs: [[number, number], [number, number]];
  sums: [number, number];
  /** [] unusable, [[a, b]] both, [[a]] one, [[a], [b]] choose one. */
  moves: Move[];
  /** Why a pairing places nothing, for the dimmed row. */
  reason?: string;
}

export interface Board {
  runners: ColumnMap<number>;
  markers: ColumnMap<number>;
  claimed: ColumnMap<string>;
}

export const PAIRS: PairingOption['pairs'][] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

export function isColumn(value: unknown): value is Column {
  return typeof value === 'number' && (COLUMNS as readonly number[]).includes(value);
}

export function moveKey(move: readonly number[]) {
  return move.join('+');
}

/** Places `columns` one at a time; null if any step cannot be taken. */
export function tryPlace(columns: readonly Column[], { runners, markers, claimed }: Board): ColumnMap<number> | null {
  const next = { ...runners };
  for (const column of columns) {
    if (claimed[column]) return null;
    const at = next[column];
    if (at === undefined) {
      if (Object.keys(next).length >= MAX_RUNNERS) return null;
      next[column] = (markers[column] ?? 0) + 1;
    } else if (at >= HEIGHT[column]) return null;
    else next[column] = at + 1;
  }
  return next;
}

function unusable(column: Column, board: Board) {
  if (board.claimed[column]) return `${column} is claimed`;
  if ((board.runners[column] ?? 0) >= HEIGHT[column]) return `${column} is at the top`;
  return 'No runners left';
}

export function pairingOptions(dice: readonly number[], board: Board): PairingOption[] {
  return PAIRS.map((pairs) => {
    const sums = pairs.map(([a, b]) => dice[a] + dice[b]) as [number, number];
    const [a, b] = [...sums].sort((x, y) => x - y) as [Column, Column];
    const singles: Move[] = a === b ? [[a]] : [[a], [b]];
    const moves: Move[] = tryPlace([a, b], board) ? [[a, b]] : singles.filter((move) => tryPlace(move, board));
    return { pairs, sums, moves, reason: moves.length ? undefined : [...new Set([a, b])].map((c) => unusable(c, board)).join(', ') };
  });
}

export function legalMoves(dice: readonly number[], board: Board): Move[] {
  const seen = new Map<string, Move>();
  for (const { moves } of pairingOptions(dice, board)) for (const move of moves) seen.set(moveKey(move), move);
  return [...seen.values()];
}

const ALL_ROLLS = Array.from({ length: 1296 }, (_, n) => [n % 6 + 1, Math.floor(n / 6) % 6 + 1, Math.floor(n / 36) % 6 + 1, Math.floor(n / 216) + 1]);

/** Exact chance the next roll offers no move. */
export function bustChance(board: Board) {
  return ALL_ROLLS.filter((dice) => !legalMoves(dice, board).length).length / ALL_ROLLS.length;
}
