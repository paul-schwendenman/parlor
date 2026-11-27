import { abortableDelay, type GameScheduling } from '@parlor/multiplayer';
import { AIStrategy, type LiarsDiceBotView } from './AIStrategy.js';

export interface AICallbacks {
  onBid: (quantity: number, faceValue: number) => void;
  onChallenge: () => void;
  onSpotOn: () => void;
}

const THINKING_DELAY = 1500;

export class AIPlayer {
  private strategy = new AIStrategy();

  /** `view` is the bot's own view only (see `LiarsDiceBotView`). */
  async takeTurn(
    view: LiarsDiceBotView,
    callbacks: AICallbacks,
    signal?: AbortSignal,
    scheduler?: GameScheduling,
  ): Promise<void> {
    // Add a realistic thinking delay
    const completed = await abortableDelay(THINKING_DELAY + Math.random() * 1000, signal, scheduler);
    if (!completed || signal?.aborted) return;

    const decision = this.strategy.decide(view);

    switch (decision.action) {
      case 'bid':
        callbacks.onBid(decision.quantity, decision.faceValue);
        break;
      case 'challenge':
        callbacks.onChallenge();
        break;
      case 'spot-on':
        callbacks.onSpotOn();
        break;
    }
  }
}
