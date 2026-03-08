import type { GameState, Die, PendingAction } from '../../types/game.js';
import { AIStrategy } from './AIStrategy.js';

interface AICallbacks {
  onLockDice: (indices: number[]) => void;
  onRoll: () => Promise<Die[]>;
  onFinishRolling: () => void;
  onSelectTarget: (dieIndex: number, targetId: string) => void;
  onEndTurn: () => void;
}

export class AIPlayer {
  private strategy: AIStrategy;
  private thinkDelay: number = 1500;

  constructor() {
    this.strategy = new AIStrategy();
  }

  async takeTurn(state: GameState, callbacks: AICallbacks): Promise<void> {
    const player = state.players[state.currentPlayerIndex];
    let rollsRemaining = state.rollsRemaining;
    let currentDice = state.dice;

    // First roll is mandatory - dice start as placeholders
    await this.delay(this.thinkDelay);
    currentDice = await callbacks.onRoll();
    rollsRemaining--;

    // Subsequent rolls are optional
    while (rollsRemaining > 0) {
      await this.delay(this.thinkDelay);

      // Decide which dice to keep
      const keepIndices = this.strategy.decideDiceToKeep(currentDice, player, state);
      callbacks.onLockDice(keepIndices);

      // Decide whether to roll again
      const shouldRoll = this.strategy.shouldRollAgain(currentDice, rollsRemaining, player, state);
      if (!shouldRoll) break;

      await this.delay(800);
      currentDice = await callbacks.onRoll();
      rollsRemaining--;
    }

    // Finish rolling phase
    callbacks.onFinishRolling();

    // Target selection phase
    await this.delay(this.thinkDelay);
    const pendingActions = this.detectPendingActions(currentDice);

    for (const action of pendingActions) {
      const target = this.strategy.selectTarget(action.face, player, state);
      if (target) {
        callbacks.onSelectTarget(action.dieIndex, target.id);
        await this.delay(500);
      }
    }

    // End turn
    await this.delay(1000);
    callbacks.onEndTurn();
  }

  private detectPendingActions(dice: Die[]): PendingAction[] {
    return dice
      .map((die, index) => ({ die, index }))
      .filter(({ die }) => die.face === 'cutlass' || die.face === 'jolly_roger')
      .map(({ die, index }) => ({
        dieIndex: index,
        face: die.face as 'cutlass' | 'jolly_roger',
        resolved: false,
      }));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
