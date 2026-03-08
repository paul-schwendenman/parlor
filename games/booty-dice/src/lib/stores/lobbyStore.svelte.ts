import type { LobbyPlayer } from '@parlor/game-types';

class LobbyState {
  players = $state<LobbyPlayer[]>([]);
  canStart = $state(false);
  hostId = $state('');
  gameStarting = $state(false);

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

  reset() {
    this.players = [];
    this.canStart = false;
    this.hostId = '';
    this.gameStarting = false;
  }
}

export const lobbyState = new LobbyState();
