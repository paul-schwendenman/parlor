class GameState {
	view = $state<unknown>(null);
	gameId = $state<string | null>(null);

	setView(view: unknown) {
		this.view = view;
	}

	setGameId(gameId: string) {
		this.gameId = gameId;
	}

	reset() {
		this.view = null;
		this.gameId = null;
	}
}

export const gameState = new GameState();
