import type { Card, PilePosition, KingsCornerPlayerView } from '../../types/game.js';
import { AIStrategy } from './AIStrategy.js';

interface AICallbacks {
  onDrawCard: () => void;
  onPlayCard: (card: Card, target: PilePosition) => void;
  onMovePile: (from: PilePosition, to: PilePosition) => void;
  onEndTurn: () => void;
  getView: () => KingsCornerPlayerView;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const THINK_DELAY = 1000;
const ACTION_DELAY = 700;

export class AIPlayer {
  private strategy = new AIStrategy();

  async takeTurn(callbacks: AICallbacks): Promise<void> {
    let view = callbacks.getView();

    // Draw phase
    if (view.phase === 'drawing' && view.drawPileCount > 0) {
      await delay(THINK_DELAY);
      callbacks.onDrawCard();
      view = callbacks.getView();
    }

    if (view.gameOver) return;

    // Play phase: keep making moves until we can't or choose to stop
    let moveMade = true;
    while (moveMade && !view.gameOver && view.phase === 'playing') {
      await delay(ACTION_DELAY);
      const decision = this.strategy.decide(view);

      switch (decision.action) {
        case 'play-card':
          callbacks.onPlayCard(decision.card, decision.target);
          view = callbacks.getView();
          moveMade = true;
          break;

        case 'move-pile':
          callbacks.onMovePile(decision.from, decision.to);
          view = callbacks.getView();
          moveMade = true;
          break;

        case 'end-turn':
          moveMade = false;
          break;
      }
    }

    if (!view.gameOver && view.phase === 'playing') {
      await delay(ACTION_DELAY);
      callbacks.onEndTurn();
    }
  }
}
