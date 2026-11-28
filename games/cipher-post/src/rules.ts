export const faces = [1, 2, 3, 4, 5, 6] as const;
export type Face = (typeof faces)[number];
export type Seal = { id: number; face: Face };
export const rounds = 4;
export const guessPoints = 4;

export function deck(): Seal[] {
  return faces.flatMap((face) => Array.from({ length: 4 }, (_, copy) => ({ id: (face - 1) * 4 + copy, face })));
}
