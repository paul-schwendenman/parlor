/**
 * Seat colours cycle through the palette the same way in the lobby and on every
 * board, so a player keeps one colour all night. The first is Deep Clay, not
 * Kiln Terracotta: a cream initial on #C4663A is below 4.5:1.
 */
export const SEAT_TONES = ['clay', 'felt', 'mustard', 'ink'] as const;
export type SeatTone = (typeof SEAT_TONES)[number];

export function seatTone(index: number): SeatTone {
  return SEAT_TONES[((index % SEAT_TONES.length) + SEAT_TONES.length) % SEAT_TONES.length];
}

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** One line of a final result, best first. */
export interface Standing {
  id: string;
  name: string;
  /** Seat index, so the avatar keeps the colour it had all game. */
  seat: number;
  /** The game's own measure: "0 cards left", "42 points". */
  detail: string;
  winner?: boolean;
  you?: boolean;
  bot?: boolean;
  /** 1-based place, when ties share one; defaults to the row's position. */
  place?: number;
}
