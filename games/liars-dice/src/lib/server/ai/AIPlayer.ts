import type { LiarsDiceGameState } from '../../types/game.js';
import { AIStrategy } from './AIStrategy.js';

export interface AICallbacks {
  onBid: (quantity: number, faceValue: number) => void;
  onChallenge: () => void;
  onSpotOn: () => void;
}

const THINKING_DELAY = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AIPlayer {
  private strategy = new AIStrategy();

  async takeTurn(state: LiarsDiceGameState, callbacks: AICallbacks): Promise<void> {
    // Add a realistic thinking delay
    await delay(THINKING_DELAY + Math.random() * 1000);

    const decision = this.strategy.decide(state);

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
