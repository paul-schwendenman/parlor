import type { CrazyEightsPlayerView, Card } from '../types/game.js';
import { cardEquals } from '../game/validation.js';

class GameState {
  view = $state<CrazyEightsPlayerView | null>(null);
  selectedCard = $state<Card | null>(null);

  get isMyTurn() {
    return this.view?.isActivePlayer ?? false;
  }

  get phase() {
    return this.view?.phase ?? null;
  }

  get playableCards() {
    return this.view?.playableCards ?? [];
  }

  get canDraw() {
    return this.view?.canDraw ?? false;
  }

  get canPass() {
    return this.view?.canPass ?? false;
  }

  get activePlayerName() {
    if (!this.view) return null;
    return this.view.players[this.view.activePlayerIndex]?.name ?? null;
  }

  isCardPlayable(card: Card): boolean {
    return this.playableCards.some((c) => cardEquals(c, card));
  }

  isCardSelected(card: Card): boolean {
    return this.selectedCard !== null && cardEquals(this.selectedCard, card);
  }

  selectCard(card: Card) {
    if (this.selectedCard && cardEquals(this.selectedCard, card)) {
      this.selectedCard = null;
    } else {
      this.selectedCard = card;
    }
  }

  clearSelection() {
    this.selectedCard = null;
  }

  setView(view: CrazyEightsPlayerView) {
    if (this.view && this.view.phase !== view.phase) {
      this.selectedCard = null;
    }
    this.view = view;
  }

  reset() {
    this.view = null;
    this.selectedCard = null;
  }
}

export const gameState = new GameState();
