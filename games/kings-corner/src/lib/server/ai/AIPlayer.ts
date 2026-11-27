import { abortableDelay, type GameScheduling } from '@parlor/multiplayer';
import type { Card, PilePosition, KingsCornerPlayerView } from '../../types/game.js';
import { AIStrategy } from './AIStrategy.js';

interface AICallbacks {
  onDrawCard: () => void;
  onPlayCard: (card: Card, target: PilePosition) => void;
  onMovePile: (from: PilePosition, to: PilePosition) => void;
  onEndTurn: () => void;
  getView: () => KingsCornerPlayerView;
}

const THINK_DELAY = 1000;
const ACTION_DELAY = 700;

export class AIPlayer {
  private strategy = new AIStrategy();

  async takeTurn(callbacks: AICallbacks, signal: AbortSignal, scheduler: GameScheduling): Promise<void> {
    if (signal.aborted) return;
    const wait = async (ms: number) =>
      await abortableDelay(ms, signal, scheduler) && !signal.aborted;
    let view = callbacks.getView();

    // Draw phase
    if (view.phase === 'drawing' && view.drawPileCount > 0) {
      if (!await wait(THINK_DELAY)) return;
      callbacks.onDrawCard();
      view = callbacks.getView();
    }

    if (view.gameOver) return;

    // Play phase: keep making moves until we can't or choose to stop
    let moveMade = true;
    let consecutivePileMoves = 0;
    while (moveMade && !view.gameOver && view.phase === 'playing') {
      if (!await wait(ACTION_DELAY)) return;
      // Disable pile moves if we've done one without a card play following
      const allowPileMove = consecutivePileMoves === 0;
      const decision = this.strategy.decide(view, allowPileMove);

      switch (decision.action) {
        case 'play-card':
          callbacks.onPlayCard(decision.card, decision.target);
          view = callbacks.getView();
          moveMade = true;
          consecutivePileMoves = 0;
          break;

        case 'move-pile':
          callbacks.onMovePile(decision.from, decision.to);
          view = callbacks.getView();
          moveMade = true;
          consecutivePileMoves++;
          break;

        case 'end-turn':
          moveMade = false;
          break;
      }
    }

    if (!view.gameOver && view.phase === 'playing') {
      if (!await wait(ACTION_DELAY)) return;
      callbacks.onEndTurn();
    }
  }
}
