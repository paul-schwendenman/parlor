import type { QuixxPlayerView, RowColor, AvailableMove } from '../types/game.js';
import { getAvailablePhase2Moves } from '../game/validation.js';

class GameState {
  view = $state<QuixxPlayerView | null>(null);
  selectedMove = $state<{ row: RowColor; cellIndex: number } | null>(null);

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

  get phase2Preview(): AvailableMove[] {
    if (!this.view) return [];
    if (this.view.phase !== 'phase1' || !this.view.isActivePlayer || !this.view.dice.rolled) return [];
    const myPlayer = this.view.players[this.view.myIndex];
    if (!myPlayer) return [];
    return getAvailablePhase2Moves(
      myPlayer.sheet,
      this.view.dice,
      this.view.lockedRows,
      this.view.removedDice,
    );
  }

  selectMove(row: RowColor, cellIndex: number) {
    if (
      this.selectedMove &&
      this.selectedMove.row === row &&
      this.selectedMove.cellIndex === cellIndex
    ) {
      this.selectedMove = null;
    } else {
      this.selectedMove = { row, cellIndex };
    }
  }

  clearSelection() {
    this.selectedMove = null;
  }

  setView(view: QuixxPlayerView) {
    // Clear selection when phase changes
    if (this.view && this.view.phase !== view.phase) {
      this.selectedMove = null;
    }
    this.view = view;
  }

  reset() {
    this.view = null;
    this.selectedMove = null;
  }
}

export const gameState = new GameState();
