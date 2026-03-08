import type { BootyDicePlayer } from '$lib/types/game.js';

let playerIdCounter = 0;

export function createTestPlayer(overrides: Partial<BootyDicePlayer> = {}): BootyDicePlayer {
	return {
		id: `player-${++playerIdCounter}`,
		name: `Test Player ${playerIdCounter}`,
		doubloons: 5,
		lives: 10,
		shields: 0,
		isAI: false,
		isConnected: true,
		isEliminated: false,
		...overrides
	};
}

export function createTestPlayers(count: number, overrides: Partial<BootyDicePlayer>[] = []): BootyDicePlayer[] {
	return Array.from({ length: count }, (_, i) => createTestPlayer(overrides[i] ?? {}));
}

export function resetPlayerIdCounter(): void {
	playerIdCounter = 0;
}
