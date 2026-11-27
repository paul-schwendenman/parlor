import type { CrazyEightsPlayerView } from '../types/game.js';

/**
 * The latest view from the server, for the standalone app's routes. Selection
 * and other board state live in GameView, so the board behaves the same here
 * and inside Parlor.
 */
class GameState {
  view = $state<CrazyEightsPlayerView | null>(null);

  setView(view: CrazyEightsPlayerView) {
    this.view = view;
  }

  reset() {
    this.view = null;
  }
}

export const gameState = new GameState();
