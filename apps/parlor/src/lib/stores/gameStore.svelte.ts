import type { GameStateEnvelope } from '@parlor/game-types';

class GameState {
	/** The latest `game:state` envelope: the view tagged with the game that sent it. */
	state = $state<GameStateEnvelope | null>(null);
	gameId = $state<string | null>(null);

	get view(): unknown {
		return this.state?.view ?? null;
	}

	setState(state: GameStateEnvelope) {
		this.state = state;
	}

	setGameId(gameId: string | null) {
		this.gameId = gameId;
	}

	reset() {
		this.state = null;
		this.gameId = null;
	}
}

export const gameState = new GameState();
