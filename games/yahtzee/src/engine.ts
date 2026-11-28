import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { botStep } from './bot.js';
import {
  CATEGORIES, DEFAULT_OPTIONS, DICE_COUNT, emptyCard, LABELS, ROLL_LIMIT, ROUNDS, scoreOptions, totals, UPPER_TARGET,
  type Scorecard, type YahtzeeOptions,
} from './rules.js';
import type { LastScore, YahtzeeAction, YahtzeeView } from './types.js';

interface Seat { id: string; name: string; bot: boolean; connected: boolean; card: Scorecard; yahtzeeBonuses: number }

export class YahtzeeEngine {
  private readonly seats: Seat[];
  private readonly options: YahtzeeOptions;
  private phase: YahtzeeView['phase'] = 'turn';
  private active: number;
  private first: number;
  private round = 1;
  private dice: number[] | null = null;
  private held: boolean[] = Array<boolean>(DICE_COUNT).fill(false);
  private rollsUsed = 0;
  private rollId = 0;
  private lastScore: LastScore | null = null;
  private winnerIds: string[] = [];

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    options: Partial<YahtzeeOptions> = {},
  ) {
    if (players.length < 2 || players.length > 6) throw new GameRuleError('Yahtzee needs 2 to 6 players.');
    this.seats = players.map((player) => ({ ...player, connected: true, card: emptyCard(), yahtzeeBonuses: 0 }));
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.active = this.first = random(players.length);
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'scored'; }
  get revealDelay() {
    const last = this.lastScore;
    return last && (last.bonus || last.upperBonusEarned || (last.category === 'yahtzee' && last.points === 50)) ? 2400 : 1400;
  }
  private get seat() { return this.seats[this.active]; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: YahtzeeAction) {
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    if (this.seat.id !== id || this.phase !== 'turn') throw new GameRuleError('It is not your turn.');
    switch (action.type) {
      case 'hold':
        if (!this.rollsUsed) throw new GameRuleError('Roll first.');
        if (this.rollsUsed >= ROLL_LIMIT) throw new GameRuleError('No rolls left. Pick a box.');
        this.held = [...action.held];
        return;
      case 'roll':
        if (this.rollsUsed >= ROLL_LIMIT) throw new GameRuleError('No rolls left. Pick a box.');
        if (this.rollsUsed && this.held.every(Boolean)) throw new GameRuleError('Release at least one die.');
        if (!this.dice) this.held = this.held.map(() => false);
        this.dice = Array.from({ length: DICE_COUNT }, (_, i) => this.dice && this.held[i] ? this.dice[i] : this.random(6) + 1);
        this.rollsUsed++;
        this.rollId++;
        return;
      case 'score': {
        if (!this.dice) throw new GameRuleError('Roll first.');
        const seat = this.seat;
        if (seat.card[action.category] !== null) throw new GameRuleError('That box is already filled.');
        const scoring = scoreOptions(seat.card, this.dice, this.options);
        const option = scoring.options.find(({ category }) => category === action.category)!;
        if (!option.legal) throw new GameRuleError(scoring.forced
          ? `Five alike must go in ${LABELS[scoring.forced]}.`
          : 'Five alike must go in an open lower box.');
        const before = totals(seat.card, seat.yahtzeeBonuses).upper;
        seat.card[action.category] = option.points;
        if (scoring.bonus) seat.yahtzeeBonuses++;
        this.lastScore = {
          playerId: seat.id, category: action.category, points: option.points, bonus: scoring.bonus, joker: option.joker,
          upperBonusEarned: before < UPPER_TARGET && totals(seat.card, 0).upper >= UPPER_TARGET,
        };
        this.phase = 'scored';
        return;
      }
    }
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.seats.every(({ card }) => CATEGORIES.every((category) => card[category] !== null))) {
      const scores = this.seats.map(({ card, yahtzeeBonuses }) => totals(card, yahtzeeBonuses).total);
      const best = Math.max(...scores);
      this.winnerIds = this.seats.filter((_, i) => scores[i] === best).map(({ id }) => id);
      this.phase = 'game-over';
      return;
    }
    this.active = (this.active + 1) % this.seats.length;
    if (this.active === this.first) this.round++;
    this.dice = null;
    this.held = this.held.map(() => false);
    this.rollsUsed = 0;
    this.lastScore = null;
    this.phase = 'turn';
  }

  automaticMove(): (() => void) | undefined {
    const seat = this.seat;
    if (this.phase !== 'turn' || (!seat.bot && seat.connected)) return;
    if (!this.seats.every((player) => player.bot) && !this.seats.some((player) => player.connected && !player.bot)) return;
    return () => {
      const step = botStep(seat.card, this.dice, this.rollsUsed, this.options);
      if (step.type === 'score') this.act(seat.id, step);
      else {
        if (this.dice) this.act(seat.id, { type: 'hold', held: step.held });
        this.act(seat.id, { type: 'roll' });
      }
    };
  }

  view(playerId?: string): YahtzeeView {
    const turn = this.phase === 'turn';
    const you = turn && this.seat.id === playerId && this.seat.connected;
    const scoring = this.dice && this.phase !== 'game-over' ? scoreOptions(this.seat.card, this.dice, this.options) : null;
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: ROUNDS,
      players: this.seats.map(({ id, name, bot, connected, card, yahtzeeBonuses }) => ({
        id, name, bot, connected, card: { ...card }, yahtzeeBonuses, ...totals(card, yahtzeeBonuses),
      })),
      activePlayerId: this.phase === 'game-over' ? null : this.seat.id,
      myId: this.seats.some(({ id }) => id === playerId) ? playerId! : null,
      dice: this.dice ? [...this.dice] : null,
      held: [...this.held],
      rollId: this.rollId,
      rollsUsed: this.rollsUsed,
      rollsLeft: ROLL_LIMIT - this.rollsUsed,
      scoreOptions: turn && scoring ? scoring.options : [],
      yahtzeeRoll: scoring?.jokerActive || scoring?.bonus
        ? { bonus: scoring.bonus, joker: scoring.jokerActive, forced: scoring.forced } : null,
      canRoll: you && this.rollsUsed < ROLL_LIMIT && !(this.rollsUsed && this.held.every(Boolean)),
      canScore: you && this.rollsUsed > 0,
      lastScore: this.lastScore && { ...this.lastScore },
      options: { ...this.options },
      winnerIds: [...this.winnerIds],
    };
  }
}
