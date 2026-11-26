import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
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
import { GameRuleError } from '@parlor/multiplayer';

/**
 * Defense in depth behind `validateQuixxAction`: a non-integer `cellIndex`
 * (e.g. the string '10') used to bypass the lock / 5-marks rule (CORE-AUDIT A-08).
 */
function assertMarkShape(row: unknown, cellIndex: unknown): void {
  if (
    typeof row !== 'string' ||
    !(ROW_COLORS as string[]).includes(row) ||
    typeof cellIndex !== 'number' ||
    !Number.isInteger(cellIndex) ||
    cellIndex < 0 ||
    cellIndex > 10
  ) {
    throw new GameRuleError('Invalid mark position', 'INVALID_ACTION');
  }
}

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
  /** Seats whose player left for good: out of the turn order and auto-passing (plan 3.9). */
  private removed = new Set<string>();

  constructor(
    playerInfos: { id: string; name: string; isBot: boolean }[],
    roomCode: string,
    config: QuixxConfig = DEFAULT_CONFIG,
    private readonly randomInt: RandomInt = secureRandomInt,
  ) {
    this.roomCode = roomCode;
    this.config = config;
    this.players = playerInfos.map((p) => ({
      id: p.id,
      name: p.name,
      connected: true,
      isBot: p.isBot,
      sheet: createScoresheet(),
      penalties: 0,
      phase1Decision: null,
      lockedRows: [],
    }));
  }

  getActivePlayerId(): string {
    return this.players[this.activePlayerIndex].id;
  }

  isRemoved(playerId: string): boolean {
    return this.removed.has(playerId);
  }

  /** Track a player's connection (shown in views as `connected`). */
  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = connected;
  }

  /** A human seat whose player is disconnected (in grace) or removed. Bots are never absent. */
  isAbsent(playerId: string): boolean {
    const player = this.players.find((p) => p.id === playerId);
    return !!player && !player.isBot && (!player.connected || this.removed.has(playerId));
  }

  /** A seat still in the game whose player is connected, or a bot. */
  hasPresentPlayer(): boolean {
    return this.players.some((p) => !this.removed.has(p.id) && (p.isBot || p.connected));
  }

  /**
   * A player left for good (plan 3.9): the seat stops taking turns and passes
   * every phase 1 from now on. With fewer than two seats left the game ends and
   * is scored as it stands.
   */
  removePlayer(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || this.removed.has(playerId)) return;
    this.removed.add(playerId);
    player.connected = false;
    if (this.gameOver) return;

    if (this.phase === 'phase1' && player.phase1Decision === null) {
      player.phase1Decision = { type: 'pass' };
      if (playerId === this.getActivePlayerId()) this.activePlayerPhase1Passed = true;
    }
    if (this.players.filter((p) => !this.removed.has(p.id)).length < 2) {
      this.gameOver = true;
      this.phase = 'game-over';
    }
  }

  /**
   * End the turn of an absent active seat (disconnected in grace, or removed)
   * without rolling, marking or a penalty. Only from `rolling` or `phase2`. A
   * present player who passes both phases still takes the penalty as usual;
   * a seat whose player is away for this turn does not (plan 3.9).
   */
  skipAbsentTurn(): void {
    if (!this.isAbsent(this.getActivePlayerId())) return;
    if (this.phase !== 'rolling' && this.phase !== 'phase2') return;
    this.phase = 'turn-end';
    this.advanceTurn();
  }

  getBotPlayerIds(): string[] {
    return this.players.filter((p) => p.isBot).map((p) => p.id);
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
      throw new GameRuleError('Cannot roll dice outside of rolling phase');
    }

    this.dice = rollAllDice(this.removedDice, this.randomInt);
    this.phase = 'phase1';
    this.activePlayerPhase1Passed = false;

    // Clear phase1 decisions; seats that have left pass automatically.
    for (const player of this.players) {
      player.phase1Decision = this.removed.has(player.id) ? { type: 'pass' } : null;
    }

    return { ...this.dice };
  }

  submitPhase1(playerId: string, action: QuixxAction): void {
    if (this.phase !== 'phase1') {
      throw new GameRuleError('Not in phase1');
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new GameRuleError('Player not found');
    if (player.phase1Decision !== null) throw new GameRuleError('Already submitted phase1 choice');

    if (action.type === 'phase1-pass') {
      player.phase1Decision = { type: 'pass' };
      if (playerId === this.players[this.activePlayerIndex].id) {
        this.activePlayerPhase1Passed = true;
      }
    } else if (action.type === 'phase1-mark') {
      assertMarkShape(action.row, action.cellIndex);
      const whiteSum = this.dice.white1 + this.dice.white2;
      const numAtCell = numberAtCell(action.row, action.cellIndex);
      if (numAtCell !== whiteSum) {
        throw new GameRuleError(`Invalid mark: number at cell ${action.cellIndex} in ${action.row} is ${numAtCell}, not ${whiteSum}`);
      }
      if (!canMark(player.sheet, action.row, action.cellIndex, this.lockedRows)) {
        throw new GameRuleError('Invalid mark position');
      }
      player.phase1Decision = { type: 'mark', row: action.row, cellIndex: action.cellIndex };
      if (playerId === this.players[this.activePlayerIndex].id) {
        this.activePlayerPhase1Passed = false;
      }
    } else {
      throw new GameRuleError('Invalid phase1 action type', 'INVALID_ACTION');
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
      throw new GameRuleError('Not in phase2');
    }

    const activePlayer = this.players[this.activePlayerIndex];
    if (activePlayer.id !== playerId) {
      throw new GameRuleError('Only the active player can act in phase2', 'NOT_YOUR_TURN');
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
      assertMarkShape(action.row, action.cellIndex);
      if (!canMark(activePlayer.sheet, action.row, action.cellIndex, this.lockedRows)) {
        throw new GameRuleError('Invalid mark position');
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
        throw new GameRuleError('Invalid phase2 mark: not a valid colored combo');
      }

      activePlayer.sheet[action.row][action.cellIndex] = true;

      if (action.cellIndex === 10) {
        this.lockRow(action.row, activePlayer);
      }
    } else {
      throw new GameRuleError('Invalid phase2 action type', 'INVALID_ACTION');
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

    // Skip seats that have left; a new round starts each time play wraps around.
    const previous = this.activePlayerIndex;
    let next = (previous + 1) % this.players.length;
    for (let i = 0; i < this.players.length && this.removed.has(this.players[next].id); i++) {
      next = (next + 1) % this.players.length;
    }
    this.activePlayerIndex = next;
    if (next <= previous) {
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
        isBot: p.isBot,
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
        isBot: p.isBot,
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
