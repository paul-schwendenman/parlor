import type { BootyDicePlayerView } from '../types/game.js';

class GameState {
  view = $state<BootyDicePlayerView | null>(null);

  get currentPlayer() {
    if (!this.view) return null;
    return this.view.players[this.view.currentPlayerIndex] ?? null;
  }

  get myPlayer() {
    if (!this.view || this.view.myIndex < 0) return null;
    return this.view.players[this.view.myIndex] ?? null;
  }

  get isMyTurn() {
    return this.view?.isMyTurn ?? false;
  }

  get alivePlayers() {
    if (!this.view) return [];
    return this.view.players.filter((p) => !p.isEliminated);
  }

  get otherAlivePlayers() {
    if (!this.view || this.view.myIndex < 0) return [];
    const myId = this.view.players[this.view.myIndex]?.id;
    return this.view.players.filter((p) => !p.isEliminated && p.id !== myId);
  }

  setView(view: BootyDicePlayerView) {
    this.view = view;
  }

  reset() {
    this.view = null;
  }
}

export const gameState = new GameState();
