import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { DEFAULT_RULES, DICE_PER_ROLL, scoreDice, scoringSelections } from './rules.js';
import type { FarkleAction, FarkleRules, FarkleView } from './types.js';

type Seat = Pick<FarkleView['players'][number], 'id' | 'name' | 'bot'>;

export class FarkleEngine {
  private readonly players: FarkleView['players'];
  private phase: FarkleView['phase'] = 'ready';
  private active: number;
  private dice: number[] = [];
  private rollNumber = 0;
  private diceToRoll = DICE_PER_ROLL;
  private kept: FarkleView['kept'] = [];
  private turnScore = 0;
  private readonly rules: FarkleRules;
  private penalty = 0;
  private finalTrigger: number | null = null;

  constructor(seats: Seat[], private readonly random: RandomInt = secureRandomInt, rules: Partial<FarkleRules> = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.players = seats.map((seat) => ({ ...seat, connected: true, out: false, score: 0, onBoard: false, farkles: 0 }));
    this.active = random(seats.length);
  }

  private get player() { return this.players[this.active]; }
  get activePlayerId() { return this.player.id; }
  get gameOver() { return this.phase === 'game-over'; }
  get revealing() { return this.phase === 'bust' || this.phase === 'banked'; }

  private get canBank() {
    return this.phase === 'ready' && this.turnScore >= (this.player.onBoard ? 1 : Math.max(1, this.rules.opening)) &&
      !(this.rules.hotDice === 'must-roll' && this.diceToRoll === DICE_PER_ROLL);
  }

  setConnected(id: string, connected: boolean) {
    const player = this.players.find((seat) => seat.id === id);
    if (player && !player.out) player.connected = connected;
  }

  remove(id: string) {
    const player = this.players.find((seat) => seat.id === id);
    if (!player || this.gameOver) return;
    player.connected = false;
    player.out = true;
    if (this.players.filter((seat) => !seat.out).length <= 1) this.phase = 'game-over';
    else if (id === this.activePlayerId) this.nextTurn();
  }

  act(id: string, action: FarkleAction) {
    if (id !== this.player.id || this.gameOver || this.revealing) {
      throw new GameRuleError('You cannot act right now.');
    }
    switch (action.type) {
      case 'roll':
        if (this.phase !== 'ready') throw new GameRuleError('Keep scoring dice before rolling again.');
        this.dice = Array.from({ length: this.diceToRoll }, () => this.random(6) + 1);
        this.rollNumber++;
        this.phase = scoringSelections(this.dice, this.rules).length ? 'selecting' : 'bust';
        if (this.phase === 'bust' && this.rules.threeFarkles && ++this.player.farkles === 3) {
          this.penalty = Math.min(this.rules.threeFarkles, this.player.score);
          this.player.score -= this.penalty;
          this.player.farkles = 0;
        }
        break;
      case 'keep': {
        if (this.phase !== 'selecting') throw new GameRuleError('Roll before keeping dice.');
        const { indices } = action;
        if (new Set(indices).size !== indices.length ||
          indices.some((index) => !Number.isInteger(index) || index < 0 || index >= this.dice.length)) {
          throw new GameRuleError('Choose dice from this roll.');
        }
        const dice = indices.map((index) => this.dice[index]);
        const points = scoreDice(dice, this.rules);
        if (!points) throw new GameRuleError('Every selected die must be part of a scoring combination.');
        this.kept.push({ dice, points });
        this.turnScore += points;
        this.diceToRoll = this.dice.length - dice.length || DICE_PER_ROLL;
        this.dice = [];
        this.phase = 'ready';
        break;
      }
      case 'bank':
        if (!this.canBank) {
          if (this.turnScore > 0 && this.diceToRoll === DICE_PER_ROLL && this.rules.hotDice === 'must-roll') {
            throw new GameRuleError('Roll your hot dice before banking.');
          }
          throw new GameRuleError(this.player.onBoard || !this.rules.opening ? 'Keep scoring dice first.'
            : `Your first bank needs ${this.rules.opening} points.`);
        }
        this.player.score += this.turnScore;
        this.player.onBoard = true;
        this.player.farkles = 0;
        if (this.finalTrigger === null && this.player.score >= this.rules.target) this.finalTrigger = this.active;
        this.phase = 'banked';
        break;
    }
  }

  advanceReveal() {
    if (this.revealing) this.nextTurn();
  }

  private nextSeat(): number | null {
    if (this.rules.ending === 'first-to-target' && this.finalTrigger !== null) return null;
    for (let offset = 1; offset <= this.players.length; offset++) {
      const index = (this.active + offset) % this.players.length;
      if (index === this.finalTrigger) return null;
      if (!this.players[index].out) return index;
    }
    return null;
  }

  private nextTurn() {
    const next = this.nextSeat();
    if (next === null) {
      this.phase = 'game-over';
      return;
    }
    this.active = next;
    this.dice = [];
    this.diceToRoll = DICE_PER_ROLL;
    this.kept = [];
    this.turnScore = 0;
    this.penalty = 0;
    this.phase = 'ready';
  }

  automaticAction(): FarkleAction | null {
    if (this.gameOver || this.revealing || (!this.player.bot && this.player.connected) ||
      (!this.players.every((player) => player.bot) && !this.players.some((player) => player.connected && !player.bot))) return null;
    if (this.phase === 'selecting') {
      const best = scoringSelections(this.dice, this.rules).sort((a, b) => b.points - a.points)[0];
      return { type: 'keep', indices: best.indices };
    }
    if (this.canBank && (this.turnScore >= Math.max(500, this.rules.opening) || this.diceToRoll <= 3)) return { type: 'bank' };
    return { type: 'roll' };
  }

  automaticMove(): (() => void) | undefined {
    const action = this.automaticAction();
    if (action) return () => this.act(this.activePlayerId, action);
  }

  view(): FarkleView {
    const next = this.gameOver ? null : this.nextSeat();
    return {
      phase: this.phase,
      rules: { ...this.rules },
      penalty: this.penalty,
      winnerIds: this.gameOver ? this.players.filter((player) => !player.out &&
        !this.players.some((other) => !other.out && other.score > player.score)).map(({ id }) => id) : [],
      players: this.players.map((player) => ({ ...player })),
      activePlayerId: this.activePlayerId,
      nextPlayerId: next === null ? null : this.players[next].id,
      dice: [...this.dice],
      rollNumber: this.rollNumber,
      kept: this.kept.map((group) => ({ ...group, dice: [...group.dice] })),
      diceToRoll: this.diceToRoll,
      turnScore: this.turnScore,
      canBank: this.canBank,
      finalRound: this.finalTrigger !== null && this.rules.ending === 'final-round',
    };
  }
}
