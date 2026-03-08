import type { Die, DiceFace, BootyDicePlayer, GameState } from '../../types/game.js';

export class AIStrategy {
  private readonly faceValue: Record<DiceFace, number> = {
    doubloon: 8,
    jolly_roger: 7,
    shield: 5,
    cutlass: 4,
    x_marks_spot: -3,
    walk_plank: -5,
  };

  decideDiceToKeep(dice: Die[], self: BootyDicePlayer, state: GameState): number[] {
    const keepIndices: number[] = [];

    const walkPlankCount = dice.filter((d) => d.face === 'walk_plank').length;
    const xMarksCount = dice.filter((d) => d.face === 'x_marks_spot').length;

    // If close to Mutiny (3 walk planks), keep them if opponents are weak
    if (walkPlankCount >= 2 && this.otherPlayersHaveLowLives(state, self)) {
      dice.forEach((die, i) => {
        if (die.face === 'walk_plank') keepIndices.push(i);
      });
    }

    // If close to Shipwreck, keep X's if opponents have gold
    if (xMarksCount >= 2 && this.otherPlayersHaveLotsOfGold(state, self)) {
      dice.forEach((die, i) => {
        if (die.face === 'x_marks_spot') keepIndices.push(i);
      });
    }

    // Otherwise, keep good dice
    dice.forEach((die, i) => {
      if (this.faceValue[die.face] >= 4) {
        keepIndices.push(i);
      }
    });

    return [...new Set(keepIndices)];
  }

  shouldRollAgain(
    dice: Die[],
    rollsRemaining: number,
    _self: BootyDicePlayer,
    _state: GameState,
  ): boolean {
    if (rollsRemaining <= 0) return false;

    const unlockedDice = dice.filter((d) => !d.locked);
    const negativeDice = unlockedDice.filter((d) => this.faceValue[d.face] < 0).length;

    // If we have 2+ negative unlocked dice, definitely roll
    if (negativeDice >= 2) return true;

    // If we have good locked dice and few negative unlocked, maybe stop
    const lockedValue = dice
      .filter((d) => d.locked)
      .reduce((sum, d) => sum + this.faceValue[d.face], 0);

    if (lockedValue >= 20 && negativeDice <= 1) return false;

    // Generally roll if we have bad dice
    return negativeDice >= 1;
  }

  selectTarget(
    action: 'cutlass' | 'jolly_roger',
    self: BootyDicePlayer,
    state: GameState,
  ): BootyDicePlayer | null {
    const otherPlayers = state.players.filter((p) => p.id !== self.id && !p.isEliminated);

    if (otherPlayers.length === 0) return null;

    if (action === 'cutlass') {
      // Prioritize: low life targets without shields, then leaders
      return otherPlayers.sort((a, b) => {
        const aVulnerable = a.lives <= 2 && a.shields === 0;
        const bVulnerable = b.lives <= 2 && b.shields === 0;
        if (aVulnerable && !bVulnerable) return -1;
        if (bVulnerable && !aVulnerable) return 1;

        return b.doubloons - a.doubloons;
      })[0];
    }

    if (action === 'jolly_roger') {
      // Target player with most doubloons
      return otherPlayers.sort((a, b) => b.doubloons - a.doubloons)[0];
    }

    return otherPlayers[0];
  }

  private otherPlayersHaveLowLives(state: GameState, self: BootyDicePlayer): boolean {
    return state.players.some((p) => p.id !== self.id && !p.isEliminated && p.lives <= 3);
  }

  private otherPlayersHaveLotsOfGold(state: GameState, self: BootyDicePlayer): boolean {
    const totalOtherGold = state.players
      .filter((p) => p.id !== self.id && !p.isEliminated)
      .reduce((sum, p) => sum + p.doubloons, 0);
    return totalOtherGold >= 15;
  }
}
