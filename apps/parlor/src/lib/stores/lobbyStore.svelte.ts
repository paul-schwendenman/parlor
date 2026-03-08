import type { LobbyPlayer } from '@parlor/game-types';

class LobbyState {
	players = $state<LobbyPlayer[]>([]);
	canStart = $state(false);
	hostId = $state('');
	gameStarting = $state(false);
	selectedGameId = $state<string | null>(null);

	setLobbyState(players: LobbyPlayer[], canStart: boolean) {
		this.players = players;
		this.canStart = canStart;
	}

	setHost(hostId: string) {
		this.hostId = hostId;
	}

	setGameStarting() {
		this.gameStarting = true;
	}

	setSelectedGame(gameId: string) {
		this.selectedGameId = gameId;
	}

	reset() {
		this.players = [];
		this.canStart = false;
		this.hostId = '';
		this.gameStarting = false;
		this.selectedGameId = null;
	}
}

export const lobbyState = new LobbyState();
