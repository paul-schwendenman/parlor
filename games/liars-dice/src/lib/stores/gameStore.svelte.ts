import type { LiarsDicePlayerView } from '../types/game.js';

class GameState {
  view = $state<LiarsDicePlayerView | null>(null);

  get currentPlayer() {
    if (!this.view) return null;
    return this.view.players[this.view.activePlayerIndex] ?? null;
  }

  get myPlayer() {
    if (!this.view || this.view.myIndex < 0) return null;
    return this.view.players[this.view.myIndex] ?? null;
  }

  get isMyTurn() {
    return this.view?.isMyTurn ?? false;
  }

  setView(view: LiarsDicePlayerView) {
    this.view = view;
  }

  reset() {
    this.view = null;
  }
}

export const gameState = new GameState();
