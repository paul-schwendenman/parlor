import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { chooseMove, shouldStop } from './bot.js';
import {
  COLUMNS, HEIGHT, legalMoves, moveKey, pairingOptions, tryPlace,
  type Board, type Column, type ColumnMap, type Move,
} from './rules.js';
import type { CantStopAction, CantStopPhase, CantStopView } from './types.js';

interface Seat { id: string; name: string; bot: boolean; connected: boolean; markers: ColumnMap<number> }
export interface CantStopOptions { goal: number }

export class CantStopEngine {
  private readonly seats: Seat[];
  private phase: CantStopPhase = 'first-roll';
  private active: number;
  private claimedBy: ColumnMap<string> = {};
  private runners: ColumnMap<number> = {};
  private dice: number[] | null = null;
  private rollId = 0;
  private turn = 1;
  private lastMove: Move | null = null;
  private winnerId: string | null = null;
  private readonly goal: number;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    options: CantStopOptions = { goal: 3 },
  ) {
    if (players.length < 2 || players.length > 4) throw new GameRuleError("Can't Stop needs 2 to 4 players.");
    this.seats = players.map((player) => ({ ...player, connected: true, markers: {} }));
    this.active = random(players.length);
    this.goal = options.goal;
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'busted'; }
  private get seat() { return this.seats[this.active]; }
  private get board(): Board {
    return { runners: this.runners, markers: this.seat.markers, claimed: this.claimedBy };
  }

  private claims(id: string) {
    return COLUMNS.filter((column) => this.claimedBy[column] === id);
  }

  /** Columns the active player would hold after stopping now. */
  private claimsAfterStop() {
    return this.claims(this.seat.id).length +
      COLUMNS.filter((column) => this.runners[column] === HEIGHT[column]).length;
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: CantStopAction) {
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    if (this.seat.id !== id || this.revealing) throw new GameRuleError('It is not your turn.');
    switch (action.type) {
      case 'roll': {
        if (this.phase !== 'first-roll' && this.phase !== 'deciding') throw new GameRuleError('Choose a move before rolling again.');
        this.dice = Array.from({ length: 4 }, () => this.random(6) + 1);
        this.rollId++;
        this.lastMove = null;
        this.phase = legalMoves(this.dice, this.board).length ? 'choosing' : 'busted';
        return;
      }
      case 'place': {
        if (this.phase !== 'choosing' || !this.dice) throw new GameRuleError('Roll before choosing a move.');
        const key = moveKey(action.columns);
        const move = legalMoves(this.dice, this.board).find((option) => moveKey(option) === key);
        if (!move) throw new GameRuleError('That move is not available for this roll.');
        this.runners = tryPlace(move, this.board)!;
        this.lastMove = move;
        this.phase = 'deciding';
        return;
      }
      case 'stop': {
        if (this.phase !== 'deciding') throw new GameRuleError(this.phase === 'first-roll'
          ? 'Roll to start your turn.' : 'Use this roll before stopping.');
        const seat = this.seat;
        for (const column of COLUMNS) {
          const at = this.runners[column];
          if (at === undefined) continue;
          seat.markers[column] = at;
          if (at === HEIGHT[column]) {
            this.claimedBy[column] = seat.id;
            for (const other of this.seats) delete other.markers[column];
          }
        }
        if (this.claims(seat.id).length >= this.goal) {
          this.winnerId = seat.id;
          this.phase = 'game-over';
          this.runners = {};
          return;
        }
        this.endTurn();
        return;
      }
    }
  }

  private endTurn() {
    this.runners = {};
    this.dice = null;
    this.lastMove = null;
    this.active = (this.active + 1) % this.seats.length;
    this.turn++;
    this.phase = 'first-roll';
  }

  advanceReveal() {
    if (this.revealing) this.endTurn();
  }

  automaticMove(): (() => void) | undefined {
    const seat = this.seat;
    if (this.phase === 'game-over' || this.revealing || (!seat.bot && seat.connected)) return;
    if (!this.seats.every((player) => player.bot) && !this.seats.some((player) => player.connected && !player.bot)) return;
    const id = seat.id;
    if (this.phase === 'first-roll') return () => this.act(id, { type: 'roll' });
    if (this.phase === 'choosing') {
      const move = chooseMove(legalMoves(this.dice!, this.board), this.board);
      return () => this.act(id, { type: 'place', columns: move });
    }
    // A stand-in for a dropped player banks at once so they keep their progress.
    const stop = !seat.bot || shouldStop(this.board, this.claimsAfterStop() >= this.goal);
    return () => this.act(id, { type: stop ? 'stop' : 'roll' });
  }

  view(playerId?: string): CantStopView {
    const runners = Object.entries<number>(this.runners);
    return {
      phase: this.phase,
      goal: this.goal,
      players: this.seats.map(({ id, name, bot, connected, markers }, seat) => ({
        id, name, bot, connected, seat, markers: { ...markers }, claimed: this.claims(id),
      })),
      activePlayerId: this.phase === 'game-over' ? null : this.seat.id,
      claimedBy: { ...this.claimedBy },
      runners: { ...this.runners },
      dice: this.dice ? [...this.dice] : null,
      rollId: this.rollId,
      pairings: (this.phase === 'choosing' || this.phase === 'busted') && this.dice ? pairingOptions(this.dice, this.board) : null,
      lastMove: this.lastMove,
      canAct: playerId !== undefined && this.phase !== 'game-over' && !this.revealing && this.seat.id === playerId && this.seat.connected,
      canStop: this.phase === 'deciding',
      stopWins: this.phase === 'deciding' && this.claimsAfterStop() >= this.goal,
      certainBust: this.phase === 'deciding' && runners.length === 3 &&
        runners.every(([column, at]) => at === HEIGHT[Number(column) as Column]),
      winnerId: this.winnerId,
      turn: this.turn,
    };
  }
}
