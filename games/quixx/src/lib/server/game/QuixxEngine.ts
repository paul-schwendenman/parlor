import type {
  QuixxGameState,
  QuixxPlayer,
  QuixxPlayerView,
  QuixxPhase,
  QuixxAction,
  QuixxConfig,
  RowColor,
  DiceState,
  Scoresheet,
  PlayerScore,
  AvailableMove,
} from '../../types/game.js';
import { DEFAULT_CONFIG, ROW_COLORS } from '../../types/game.js';
import { rollAllDice } from './dice.js';
import { canMark, getAvailablePhase1Moves, getAvailablePhase2Moves, numberAtCell, cellForNumber } from '../../game/validation.js';
import { computeAllScores } from '../../game/scoring.js';

function createScoresheet(): Scoresheet {
  return {
    red: Array(11).fill(false),
    yellow: Array(11).fill(false),
    green: Array(11).fill(false),
    blue: Array(11).fill(false),
  };
}

export class QuixxEngine {
  private players: QuixxPlayer[];
  private activePlayerIndex = 0;
  private dice: DiceState = { white1: 0, white2: 0, red: 0, yellow: 0, green: 0, blue: 0, rolled: false };
  private lockedRows: RowColor[] = [];
  private removedDice: RowColor[] = [];
  private phase: QuixxPhase = 'rolling';
  private round = 1;
  private gameOver = false;
  private roomCode: string;
  private config: QuixxConfig;
  private activePlayerPhase1Passed = false;

  constructor(
    playerInfos: { id: string; name: string }[],
    roomCode: string,
    config: QuixxConfig = DEFAULT_CONFIG,
  ) {
    this.roomCode = roomCode;
    this.config = config;
    this.players = playerInfos.map((p) => ({
      id: p.id,
      name: p.name,
      connected: true,
      sheet: createScoresheet(),
      penalties: 0,
      phase1Decision: null,
      lockedRows: [],
    }));
  }

  getPhase(): QuixxPhase {
    return this.phase;
  }

  getPlayers(): QuixxPlayer[] {
    return this.players;
  }

  getRound(): number {
    return this.round;
  }

  getActivePlayerIndex(): number {
    return this.activePlayerIndex;
  }

  getLockedRows(): RowColor[] {
    return [...this.lockedRows];
  }

  getRemovedDice(): RowColor[] {
    return [...this.removedDice];
  }

  getDice(): DiceState {
    return { ...this.dice };
  }

  rollDice(): DiceState {
    if (this.phase !== 'rolling') {
      throw new Error('Cannot roll dice outside of rolling phase');
    }

    this.dice = rollAllDice(this.removedDice);
    this.phase = 'phase1';
    this.activePlayerPhase1Passed = false;

    // Clear phase1 decisions
    for (const player of this.players) {
      player.phase1Decision = null;
    }

    return { ...this.dice };
  }

  submitPhase1(playerId: string, action: QuixxAction): void {
    if (this.phase !== 'phase1') {
      throw new Error('Not in phase1');
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');
    if (player.phase1Decision !== null) throw new Error('Already submitted phase1 choice');

    if (action.type === 'phase1-pass') {
      player.phase1Decision = { type: 'pass' };
      if (playerId === this.players[this.activePlayerIndex].id) {
        this.activePlayerPhase1Passed = true;
      }
    } else if (action.type === 'phase1-mark') {
      const whiteSum = this.dice.white1 + this.dice.white2;
      const numAtCell = numberAtCell(action.row, action.cellIndex);
      if (numAtCell !== whiteSum) {
        throw new Error(`Invalid mark: number at cell ${action.cellIndex} in ${action.row} is ${numAtCell}, not ${whiteSum}`);
      }
      if (!canMark(player.sheet, action.row, action.cellIndex, this.lockedRows)) {
        throw new Error('Invalid mark position');
      }
      player.phase1Decision = { type: 'mark', row: action.row, cellIndex: action.cellIndex };
      if (playerId === this.players[this.activePlayerIndex].id) {
        this.activePlayerPhase1Passed = false;
      }
    } else {
      throw new Error('Invalid phase1 action type');
    }
  }

  allPhase1Submitted(): boolean {
    return this.players.every((p) => p.phase1Decision !== null);
  }

  resolvePhase1(): void {
    if (this.phase !== 'phase1') {
      throw new Error('Not in phase1');
    }

    // Apply all marks simultaneously
    for (const player of this.players) {
      const decision = player.phase1Decision;
      if (decision && decision.type === 'mark') {
        player.sheet[decision.row][decision.cellIndex] = true;

        // Check for row lock
        if (decision.cellIndex === 10) {
          this.lockRow(decision.row, player);
        }
      }
    }

    // Check game end (2+ locked rows can happen from simultaneous locks)
    if (this.lockedRows.length >= 2) {
      this.gameOver = true;
      this.phase = 'game-over';
      return;
    }

    this.phase = 'phase2';
  }

  submitPhase2(playerId: string, action: QuixxAction): void {
    if (this.phase !== 'phase2') {
      throw new Error('Not in phase2');
    }

    const activePlayer = this.players[this.activePlayerIndex];
    if (activePlayer.id !== playerId) {
      throw new Error('Only the active player can act in phase2');
    }

    if (action.type === 'phase2-pass') {
      // Check if active player passed both phases → penalty
      if (this.activePlayerPhase1Passed) {
        activePlayer.penalties += 1;
        if (activePlayer.penalties >= 4) {
          this.gameOver = true;
          this.phase = 'game-over';
          return;
        }
      }
    } else if (action.type === 'phase2-mark') {
      if (!canMark(activePlayer.sheet, action.row, action.cellIndex, this.lockedRows)) {
        throw new Error('Invalid mark position');
      }

      // Validate it's a valid colored combo
      const validMoves = getAvailablePhase2Moves(
        activePlayer.sheet,
        this.dice,
        this.lockedRows,
        this.removedDice,
      );
      const isValid = validMoves.some(
        (m) => m.row === action.row && m.cellIndex === action.cellIndex,
      );
      if (!isValid) {
        throw new Error('Invalid phase2 mark: not a valid colored combo');
      }

      activePlayer.sheet[action.row][action.cellIndex] = true;

      if (action.cellIndex === 10) {
        this.lockRow(action.row, activePlayer);
      }
    } else {
      throw new Error('Invalid phase2 action type');
    }

    // Check game end (2+ locked rows)
    if (this.lockedRows.length >= 2) {
      this.gameOver = true;
      this.phase = 'game-over';
    }

    if (!this.gameOver) {
      this.phase = 'turn-end';
    }
  }

  advanceTurn(): void {
    if (this.phase !== 'turn-end') {
      throw new Error('Cannot advance turn outside of turn-end phase');
    }

    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    if (this.activePlayerIndex === 0) {
      this.round += 1;
    }
    this.phase = 'rolling';
    this.dice = { white1: 0, white2: 0, red: 0, yellow: 0, green: 0, blue: 0, rolled: false };
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  shouldAutoRoll(): boolean {
    return this.config.diceRolling === 'auto';
  }

  getConfig(): QuixxConfig {
    return { ...this.config };
  }

  getScores(): PlayerScore[] | null {
    if (!this.gameOver) return null;
    return computeAllScores(this.players);
  }

  getPlayerView(playerId: string): QuixxPlayerView {
    const myIndex = this.players.findIndex((p) => p.id === playerId);
    const isActivePlayer = myIndex === this.activePlayerIndex;

    let availableMoves: AvailableMove[] = [];
    if (this.phase === 'phase1' && this.dice.rolled) {
      const player = this.players[myIndex];
      if (player && !player.phase1Decision) {
        availableMoves = getAvailablePhase1Moves(player.sheet, this.dice, this.lockedRows);
      }
    } else if (this.phase === 'phase2' && isActivePlayer) {
      const player = this.players[myIndex];
      if (player) {
        availableMoves = getAvailablePhase2Moves(
          player.sheet,
          this.dice,
          this.lockedRows,
          this.removedDice,
        );
      }
    }

    return {
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        sheet: p.sheet,
        penalties: p.penalties,
        phase1Submitted: p.phase1Decision !== null,
        lockedRows: [...p.lockedRows],
      })),
      activePlayerIndex: this.activePlayerIndex,
      dice: { ...this.dice },
      lockedRows: [...this.lockedRows],
      removedDice: [...this.removedDice],
      phase: this.phase,
      round: this.round,
      gameOver: this.gameOver,
      scores: this.gameOver ? computeAllScores(this.players) : null,
      myIndex,
      isActivePlayer,
      availableMoves,
      activePlayerPhase1Passed: isActivePlayer ? this.activePlayerPhase1Passed : false,
    };
  }

  getSpectatorView(): QuixxPlayerView {
    return {
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        sheet: p.sheet,
        penalties: p.penalties,
        phase1Submitted: p.phase1Decision !== null,
        lockedRows: [...p.lockedRows],
      })),
      activePlayerIndex: this.activePlayerIndex,
      dice: { ...this.dice },
      lockedRows: [...this.lockedRows],
      removedDice: [...this.removedDice],
      phase: this.phase,
      round: this.round,
      gameOver: this.gameOver,
      scores: this.gameOver ? computeAllScores(this.players) : null,
      myIndex: -1,
      isActivePlayer: false,
      availableMoves: [],
      activePlayerPhase1Passed: false,
    };
  }

  private lockRow(row: RowColor, lockingPlayer: QuixxPlayer): void {
    if (!this.lockedRows.includes(row)) {
      this.lockedRows.push(row);
      this.removedDice.push(row);
    }
    if (!lockingPlayer.lockedRows.includes(row)) {
      lockingPlayer.lockedRows.push(row);
    }
  }
}
