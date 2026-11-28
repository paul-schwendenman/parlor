import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { DICE_PER_ROLL, OPENING_SCORE, TARGET_SCORE, scoreDice, scoringSelections } from './rules.js';
import type { FarkleAction, FarkleView } from './types.js';

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
  private finalTrigger: number | null = null;

  constructor(seats: Seat[], private readonly random: RandomInt = secureRandomInt) {
    this.players = seats.map((seat) => ({ ...seat, connected: true, out: false, score: 0 }));
    this.active = random(seats.length);
  }

  private get player() { return this.players[this.active]; }
  get activePlayerId() { return this.player.id; }
  get gameOver() { return this.phase === 'game-over'; }
  get revealing() { return this.phase === 'bust' || this.phase === 'banked'; }

  private get canBank() {
    return this.phase === 'ready' && this.turnScore >= (this.player.score ? 1 : OPENING_SCORE);
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
        this.phase = scoringSelections(this.dice).length ? 'selecting' : 'bust';
        break;
      case 'keep': {
        if (this.phase !== 'selecting') throw new GameRuleError('Roll before keeping dice.');
        const { indices } = action;
        if (new Set(indices).size !== indices.length ||
          indices.some((index) => !Number.isInteger(index) || index < 0 || index >= this.dice.length)) {
          throw new GameRuleError('Choose dice from this roll.');
        }
        const dice = indices.map((index) => this.dice[index]);
        const points = scoreDice(dice);
        if (!points) throw new GameRuleError('Every selected die must be part of a scoring combination.');
        this.kept.push({ dice, points });
        this.turnScore += points;
        this.diceToRoll = this.dice.length - dice.length || DICE_PER_ROLL;
        this.dice = [];
        this.phase = 'ready';
        break;
      }
      case 'bank':
        if (!this.canBank) throw new GameRuleError('Keep scoring dice first. Your first bank needs 500 points.');
        this.player.score += this.turnScore;
        if (this.finalTrigger === null && this.player.score >= TARGET_SCORE) this.finalTrigger = this.active;
        this.phase = 'banked';
        break;
    }
  }

  advanceTurn() {
    if (this.revealing) this.nextTurn();
  }

  private nextTurn() {
    let next = this.active;
    do {
      next = (next + 1) % this.players.length;
      if (next === this.finalTrigger) {
        this.phase = 'game-over';
        return;
      }
    } while (this.players[next].out);

    this.active = next;
    this.dice = [];
    this.diceToRoll = DICE_PER_ROLL;
    this.kept = [];
    this.turnScore = 0;
    this.phase = 'ready';
  }

  automaticAction(): FarkleAction | null {
    if (this.gameOver || this.revealing || (!this.player.bot && this.player.connected) ||
      !this.players.some((player) => player.connected && !player.bot)) return null;
    if (this.phase === 'selecting') {
      const best = scoringSelections(this.dice).sort((a, b) => b.points - a.points)[0];
      return { type: 'keep', indices: best.indices };
    }
    if (this.canBank && (this.turnScore >= OPENING_SCORE || this.diceToRoll <= 3)) return { type: 'bank' };
    return { type: 'roll' };
  }

  view(): FarkleView {
    return {
      phase: this.phase,
      players: this.players.map((player) => ({ ...player })),
      activePlayerId: this.activePlayerId,
      dice: [...this.dice],
      rollNumber: this.rollNumber,
      kept: this.kept.map((group) => ({ ...group, dice: [...group.dice] })),
      diceToRoll: this.diceToRoll,
      turnScore: this.turnScore,
      canBank: this.canBank,
      finalRound: this.finalTrigger !== null,
    };
  }
}
