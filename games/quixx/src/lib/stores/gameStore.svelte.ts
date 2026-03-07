import type { QuixxPlayerView } from '../types/game.js';

class GameState {
  view = $state<QuixxPlayerView | null>(null);

  get mySheet() {
    if (!this.view) return null;
    const myPlayer = this.view.players[this.view.myIndex];
    return myPlayer?.sheet ?? null;
  }

  get isMyTurn() {
    return this.view?.isActivePlayer ?? false;
  }

  get currentPhase() {
    return this.view?.phase ?? null;
  }

  get availableMoves() {
    return this.view?.availableMoves ?? [];
  }

  get whiteSum() {
    if (!this.view?.dice.rolled) return null;
    return this.view.dice.white1 + this.view.dice.white2;
  }

  get phase1Submitted() {
    if (!this.view) return false;
    return this.view.players[this.view.myIndex]?.phase1Submitted ?? false;
  }

  get activePlayerName() {
    if (!this.view) return null;
    return this.view.players[this.view.activePlayerIndex]?.name ?? null;
  }

  setView(view: QuixxPlayerView) {
    this.view = view;
  }

  reset() {
    this.view = null;
  }
}

export const gameState = new GameState();
