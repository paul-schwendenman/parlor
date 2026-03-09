import type { KingsCornerPlayerView, Card, PilePosition } from '../types/game.js';
import { cardEquals } from '../game/validation.js';

class GameState {
  view = $state<KingsCornerPlayerView | null>(null);
  selectedCard = $state<Card | null>(null);
  selectedPile = $state<PilePosition | null>(null);

  get isMyTurn() {
    return this.view?.isActivePlayer ?? false;
  }

  get phase() {
    return this.view?.phase ?? null;
  }

  get canEndTurn() {
    return this.view?.canEndTurn ?? false;
  }

  get mustPlayKing() {
    return this.view?.mustPlayKing ?? false;
  }

  get activePlayerName() {
    if (!this.view) return null;
    return this.view.players[this.view.activePlayerIndex]?.name ?? null;
  }

  isCardPlayable(card: Card): boolean {
    if (!this.view) return false;
    return this.view.playableCards.some((pc) => cardEquals(pc.card, card));
  }

  isCardSelected(card: Card): boolean {
    return this.selectedCard !== null && cardEquals(this.selectedCard, card);
  }

  getValidTargetsForCard(card: Card): PilePosition[] {
    if (!this.view) return [];
    const pc = this.view.playableCards.find((p) => cardEquals(p.card, card));
    return pc?.validTargets ?? [];
  }

  isPileMovable(position: PilePosition): boolean {
    if (!this.view) return false;
    return this.view.movablePiles.some((mp) => mp.from === position);
  }

  isPileSelected(position: PilePosition): boolean {
    return this.selectedPile === position;
  }

  getValidTargetsForPile(position: PilePosition): PilePosition[] {
    if (!this.view) return [];
    const mp = this.view.movablePiles.find((m) => m.from === position);
    return mp?.validTargets ?? [];
  }

  isValidTarget(position: PilePosition): boolean {
    if (this.selectedCard) {
      return this.getValidTargetsForCard(this.selectedCard).includes(position);
    }
    if (this.selectedPile) {
      return this.getValidTargetsForPile(this.selectedPile).includes(position);
    }
    return false;
  }

  selectCard(card: Card) {
    this.selectedPile = null;
    if (this.selectedCard && cardEquals(this.selectedCard, card)) {
      this.selectedCard = null;
    } else {
      this.selectedCard = card;
    }
  }

  selectPile(position: PilePosition) {
    this.selectedCard = null;
    if (this.selectedPile === position) {
      this.selectedPile = null;
    } else {
      this.selectedPile = position;
    }
  }

  clearSelection() {
    this.selectedCard = null;
    this.selectedPile = null;
  }

  setView(view: KingsCornerPlayerView) {
    if (this.view && this.view.phase !== view.phase) {
      this.selectedCard = null;
      this.selectedPile = null;
    }
    this.view = view;
  }

  reset() {
    this.view = null;
    this.selectedCard = null;
    this.selectedPile = null;
  }
}

export const gameState = new GameState();
