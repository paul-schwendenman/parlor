export const channels = ['amber', 'blue', 'green'] as const;
export type Channel = (typeof channels)[number];
export type Signal = { id: number; channel: Channel; strength: number };
export type Antenna = 0 | 1;
export const antennas = [0, 1] as const;
export const levels = 4;
export const roundMs = 55_000;
export const signalCount = 27;

export function fits(signal: Signal, current: Signal) {
  return signal.channel === current.channel || Math.abs(signal.strength - current.strength) === 1;
}

export function deck(): Signal[] {
  return channels.flatMap((channel, band) => Array.from({ length: 9 }, (_, index) =>
    ({ id: band * 9 + index, channel, strength: index + 1 })));
}
