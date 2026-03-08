import type {
  GameState,
  BootyDicePlayer,
  Die,
  PendingAction,
  LogEntry,
  TurnResolution,
  ResolvedEffect,
  ComboType,
  BootyDicePlayerView,
} from '../../types/game.js';
import { DiceRoller } from './DiceRoller.js';
import { ActionResolver } from './ActionResolver.js';
import { fisherYatesShuffle } from './shuffle.js';

export class GameEngine {
  private state: GameState;
  private diceRoller: DiceRoller;
  private actionResolver: ActionResolver;
  private lastBroadcastLogIndex = 0;

  constructor(players: BootyDicePlayer[], roomCode: string) {
    this.diceRoller = new DiceRoller();
    this.actionResolver = new ActionResolver();

    // Shuffle player order
    const shuffledPlayers = fisherYatesShuffle(players);

    this.state = {
      roomCode,
      phase: 'playing',
      players: shuffledPlayers,
      currentPlayerIndex: 0,
      turnNumber: 1,
      rollsRemaining: 3,
      dice: this.diceRoller.createFreshDice(),
      turnPhase: 'rolling',
      pendingActions: [],
      gameLog: [],
      winnerId: null,
    };

    this.addLog(shuffledPlayers[0].id, `${shuffledPlayers[0].name}'s turn begins`, 'roll');
  }

  getState(): GameState {
    return { ...this.state, players: this.state.players.map((p) => ({ ...p })) };
  }

  getNewLogEntries(): LogEntry[] {
    const newEntries = this.state.gameLog.slice(this.lastBroadcastLogIndex);
    this.lastBroadcastLogIndex = this.state.gameLog.length;
    return newEntries;
  }

  getStateForBroadcast(): GameState {
    return { ...this.getState(), gameLog: [] };
  }

  getPlayerView(playerId: string): BootyDicePlayerView {
    const state = this.getState();
    const myIndex = state.players.findIndex((p) => p.id === playerId);
    return {
      ...state,
      myIndex,
      isMyTurn: myIndex === state.currentPlayerIndex,
    };
  }

  getSpectatorView(): BootyDicePlayerView {
    const state = this.getState();
    return {
      ...state,
      myIndex: -1,
      isMyTurn: false,
    };
  }

  getCurrentPlayer(): BootyDicePlayer {
    return this.state.players[this.state.currentPlayerIndex];
  }

  lockDice(diceIndices: number[]): void {
    this.state.dice = this.state.dice.map((die, i) => ({
      ...die,
      locked: diceIndices.includes(i),
    }));
  }

  roll(): { dice: Die[]; combo: ComboType; canRollAgain: boolean } {
    if (this.state.rollsRemaining <= 0) {
      throw new Error('No rolls remaining');
    }

    const result = this.diceRoller.roll(this.state.dice);
    this.state.dice = result.dice;
    this.state.rollsRemaining--;

    // Detect pending targeted actions (Blackbeard's Curse overrides everything, no targets needed)
    if (result.combo === 'blackbeards_curse') {
      this.state.pendingActions = [];
    } else {
      this.state.pendingActions = this.detectPendingActions(result.dice);
    }

    const canRollAgain = this.state.rollsRemaining > 0;

    // Only switch to target selection when out of rolls
    if (this.state.pendingActions.length > 0 && !canRollAgain) {
      this.state.turnPhase = 'selecting_targets';
    }

    this.addLog(
      this.getCurrentPlayer().id,
      `${this.getCurrentPlayer().name} rolled: ${this.describeDice(result.dice)}${result.combo ? ` (${this.describeCombo(result.combo)}!)` : ''}`,
      result.combo ? 'combo' : 'roll',
    );

    return { dice: result.dice, combo: result.combo, canRollAgain };
  }

  private detectPendingActions(dice: Die[]): PendingAction[] {
    const actions: PendingAction[] = [];
    dice.forEach((die, index) => {
      if (die.face === 'cutlass' || die.face === 'jolly_roger') {
        actions.push({
          dieIndex: index,
          face: die.face,
          resolved: false,
        });
      }
    });
    return actions;
  }

  selectTarget(dieIndex: number, targetPlayerId: string): void {
    const action = this.state.pendingActions.find((a) => a.dieIndex === dieIndex);
    if (!action) throw new Error('Invalid action');

    action.targetPlayerId = targetPlayerId;
    action.resolved = true;

    // Check if all targets selected
    if (this.state.pendingActions.every((a) => a.resolved)) {
      this.state.turnPhase = 'resolving';
    }
  }

  hasUnresolvedTargets(): boolean {
    return this.state.pendingActions.some((a) => !a.resolved);
  }

  finishRolling(): void {
    if (this.state.turnPhase !== 'rolling') return;

    if (this.state.pendingActions.length > 0) {
      this.state.turnPhase = 'selecting_targets';
    } else {
      this.state.turnPhase = 'resolving';
    }
  }

  resolveTurn(): TurnResolution {
    const currentPlayer = this.getCurrentPlayer();
    const rollsUsed = 3 - this.state.rollsRemaining;
    const effects = this.actionResolver.resolve(
      this.state.dice,
      this.state.pendingActions,
      currentPlayer,
      this.state.players,
    );

    const eliminations: string[] = [];

    // Apply effects to state
    effects.forEach((effect) => {
      const target = this.state.players.find((p) => p.id === effect.targetId);
      if (!target) return;

      // Skip attack effects if the source player has been eliminated during this resolution
      if (effect.sourceId) {
        const source = this.state.players.find((p) => p.id === effect.sourceId);
        if (source?.isEliminated) return;
      }

      if (effect.type === 'damage') {
        if (target.shields > 0) {
          target.shields--;
          this.addLog(target.id, `${target.name}'s shield absorbs the attack!`, 'action');
        } else {
          target.lives -= effect.amount;
        }
      } else if (effect.type === 'coins_lost') {
        target.doubloons = Math.max(0, target.doubloons - effect.amount);
      } else if (effect.type === 'coins_gained') {
        target.doubloons += effect.amount;
      } else if (effect.type === 'shield_gained') {
        target.shields += effect.amount;
      } else if (effect.type === 'life_lost') {
        target.lives -= effect.amount;
      }

      // Check elimination
      if (target.lives <= 0 && !target.isEliminated) {
        target.isEliminated = true;
        eliminations.push(target.id);

        // Captain's Plunder - killer gets victim's doubloons
        if (effect.sourceId && effect.sourceId !== target.id) {
          const killer = this.state.players.find((p) => p.id === effect.sourceId);
          if (killer) {
            killer.doubloons += target.doubloons;
            this.addLog(
              killer.id,
              `Captain's Plunder! ${killer.name} takes ${target.doubloons} doubloons from ${target.name}!`,
              'elimination',
            );
            target.doubloons = 0;
          }
        }

        this.addLog(target.id, `${target.name} has been eliminated!`, 'elimination');
      }
    });

    // Generate turn summary
    this.addTurnSummary(currentPlayer, rollsUsed, effects);

    // Check win conditions
    const winner = this.checkWinCondition();
    if (winner) {
      this.state.winnerId = winner;
      this.state.phase = 'ended';
      const winnerPlayer = this.state.players.find((p) => p.id === winner);
      const reason = winnerPlayer && winnerPlayer.doubloons >= 25 ? 'riches' : 'last standing';
      this.addLog(winner, `${winnerPlayer?.name} wins by ${reason}!`, 'win');
    }

    return { effects, eliminations, winner };
  }

  endTurn(): void {
    // Don't advance turn if game has ended
    if (this.state.phase === 'ended') {
      return;
    }

    // Move to next non-eliminated player
    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    while (this.state.players[nextIndex].isEliminated && attempts < this.state.players.length) {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }

    // Safety check: if all players are eliminated, end the game
    if (this.state.players[nextIndex].isEliminated) {
      console.error('[GameEngine] endTurn: Could not find non-eliminated player');
      this.state.phase = 'ended';
      return;
    }

    this.state.currentPlayerIndex = nextIndex;
    this.state.turnNumber++;
    this.state.rollsRemaining = 3;
    // Keep the previous player's dice visible, but unlock them all for the new player
    this.state.dice = this.state.dice.map((die) => ({ ...die, locked: false }));
    this.state.turnPhase = 'rolling';
    this.state.pendingActions = [];

    this.addLog(
      this.getCurrentPlayer().id,
      `${this.getCurrentPlayer().name}'s turn begins`,
      'roll',
    );
  }

  private checkWinCondition(): string | null {
    // Check for 25+ doubloons
    const richPlayer = this.state.players.find((p) => p.doubloons >= 25 && !p.isEliminated);
    if (richPlayer) return richPlayer.id;

    // Check for last standing
    const alivePlayers = this.state.players.filter((p) => !p.isEliminated);
    if (alivePlayers.length === 1) return alivePlayers[0].id;

    return null;
  }

  private addLog(playerId: string, message: string, type: LogEntry['type']): void {
    this.state.gameLog.push({
      timestamp: Date.now(),
      playerId,
      message,
      type,
    });
  }

  private addTurnSummary(
    player: BootyDicePlayer,
    rollsUsed: number,
    effects: ResolvedEffect[],
  ): void {
    const summaryActions: string[] = [];

    const faces = this.state.dice.map((d) => d.face);
    const isBlackbeardsCurse = new Set(faces).size === 6;

    let coinsFromCenter = 0;
    let coinsLostToX = 0;
    let plankWalks = 0;
    let shieldsGained = 0;
    const stolenFrom: Map<string, number> = new Map();
    const attacked: Map<string, number> = new Map();

    effects.forEach((effect) => {
      if (effect.targetId === player.id) {
        if (effect.type === 'coins_gained' && !effect.sourceId) {
          coinsFromCenter += effect.amount;
        } else if (effect.type === 'coins_lost' && !effect.sourceId) {
          coinsLostToX += effect.amount;
        } else if (effect.type === 'life_lost' && !effect.sourceId) {
          plankWalks += effect.amount;
        } else if (effect.type === 'shield_gained') {
          shieldsGained += effect.amount;
        }
      } else {
        if (effect.sourceId === player.id && !isBlackbeardsCurse) {
          if (effect.type === 'coins_lost') {
            const targetPlayer = this.state.players.find((p) => p.id === effect.targetId);
            const targetName = targetPlayer?.name || 'someone';
            stolenFrom.set(targetName, (stolenFrom.get(targetName) || 0) + effect.amount);
          } else if (effect.type === 'damage') {
            const targetPlayer = this.state.players.find((p) => p.id === effect.targetId);
            const targetName = targetPlayer?.name || 'someone';
            attacked.set(targetName, (attacked.get(targetName) || 0) + effect.amount);
          }
        }
      }
    });

    if (coinsFromCenter > 0) {
      summaryActions.push(`took ${coinsFromCenter} from the center`);
    }

    stolenFrom.forEach((amount, targetName) => {
      summaryActions.push(`stole ${amount} from ${targetName}`);
    });

    attacked.forEach((damage, targetName) => {
      if (damage === 1) {
        summaryActions.push(`shot ${targetName}`);
      } else {
        summaryActions.push(`dealt ${damage} damage to ${targetName}`);
      }
    });

    if (coinsLostToX > 0) {
      summaryActions.push(`lost ${coinsLostToX} to X marks`);
    }

    if (plankWalks > 0) {
      if (plankWalks === 1) {
        summaryActions.push(`walked the plank`);
      } else {
        summaryActions.push(`walked the plank ${plankWalks} times`);
      }
    }

    if (shieldsGained > 0) {
      summaryActions.push(`raised ${shieldsGained} shield${shieldsGained > 1 ? 's' : ''}`);
    }

    let message: string;
    if (summaryActions.length === 0) {
      message = `${player.name}'s turn: nothing happened`;
    } else {
      message = `${player.name}'s turn: ${summaryActions.join('. ')}.`;
    }

    this.addLog(player.id, message, 'summary');
  }

  private describeDice(dice: Die[]): string {
    const faceCounts: Record<string, number> = {};
    dice.forEach((d) => {
      faceCounts[d.face] = (faceCounts[d.face] || 0) + 1;
    });
    return Object.entries(faceCounts)
      .map(([face, count]) => `${count}x ${face.replace('_', ' ')}`)
      .join(', ');
  }

  private describeCombo(combo: ComboType): string {
    if (combo === 'mutiny') return 'MUTINY';
    if (combo === 'shipwreck') return 'SHIPWRECK';
    if (combo === 'blackbeards_curse') return "BLACKBEARD'S CURSE";
    return '';
  }
}
