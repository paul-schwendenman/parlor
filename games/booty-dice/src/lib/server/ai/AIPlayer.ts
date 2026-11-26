import type { GameState, Die, PendingAction } from '../../types/game.js';
import { abortableDelay, type GameScheduling } from '@parlor/multiplayer';
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

  async takeTurn(
    state: GameState,
    callbacks: AICallbacks,
    signal?: AbortSignal,
    scheduler?: GameScheduling,
  ): Promise<void> {
    const wait = async (ms: number): Promise<boolean> =>
      await abortableDelay(ms, signal, scheduler) && !signal?.aborted;
    const player = state.players[state.currentPlayerIndex];
    let rollsRemaining = state.rollsRemaining;
    // First roll is mandatory - dice start as placeholders
    if (!(await wait(this.thinkDelay))) return;
    let currentDice = await callbacks.onRoll();
    if (signal?.aborted) return;
    rollsRemaining--;

    // Subsequent rolls are optional
    while (rollsRemaining > 0) {
      if (!(await wait(this.thinkDelay))) return;

      // Decide which dice to keep
      const keepIndices = this.strategy.decideDiceToKeep(currentDice, player, state);
      callbacks.onLockDice(keepIndices);

      // Decide whether to roll again
      const shouldRoll = this.strategy.shouldRollAgain(currentDice, rollsRemaining, player, state);
      if (!shouldRoll) break;

      if (!(await wait(800))) return;
      currentDice = await callbacks.onRoll();
      if (signal?.aborted) return;
      rollsRemaining--;
    }

    // Finish rolling phase
    callbacks.onFinishRolling();

    // Target selection phase
    if (!(await wait(this.thinkDelay))) return;
    const pendingActions = this.detectPendingActions(currentDice);

    for (const action of pendingActions) {
      const target = this.strategy.selectTarget(action.face, player, state);
      if (target) {
        callbacks.onSelectTarget(action.dieIndex, target.id);
        if (!(await wait(500))) return;
      }
    }

    // End turn
    if (!(await wait(1000))) return;
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
}
