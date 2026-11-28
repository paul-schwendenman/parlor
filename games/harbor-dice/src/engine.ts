import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { categories, DICE_COUNT, ROLL_LIMIT, scores, type Scorecard } from './rules.js';
import type { HarborAction, HarborView } from './types.js';

type Seat = HarborView['players'][number];

export class HarborDiceEngine {
  private readonly players: Seat[];
  private active: number;
  private turns = 0;
  private dice: number[] = [];
  private rollsLeft = ROLL_LIMIT;
  private rollId = 0;
  private phase: HarborView['phase'] = 'rolling';
  private lastScore: HarborView['lastScore'] = null;

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[], private readonly random: RandomInt = secureRandomInt) {
    this.players = players.map((player) => ({ ...player, connected: true, total: 0, scorecard: {} }));
    this.active = random(players.length);
  }

  get revealing() { return this.phase === 'scored'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.players.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: HarborAction) {
    const player = this.players[this.active];
    if (id !== player.id || this.phase !== 'rolling') throw new GameRuleError('Wait for your turn.');
    if (action.type === 'roll') {
      const held = new Set(action.held);
      if (!this.rollsLeft || held.size !== action.held.length || held.size >= DICE_COUNT ||
        action.held.some((index) => !Number.isInteger(index) || index < 0 || index >= this.dice.length)) {
        throw new GameRuleError('Leave at least one available die to roll.');
      }
      this.dice = Array.from({ length: DICE_COUNT }, (_, index) => held.has(index) ? this.dice[index] : this.random(6) + 1);
      this.rollsLeft--;
      this.rollId++;
      return;
    }
    const { category } = action;
    if (!this.dice.length || !categories.some(({ id }) => id === category) || player.scorecard[category] !== undefined) {
      throw new GameRuleError('Roll the dice, then choose an open category.');
    }
    const points = scores(this.dice)[category];
    player.scorecard[category] = points;
    player.total += points;
    this.lastScore = { category, points };
    this.phase = 'scored';
    this.turns++;
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.turns === this.players.length * categories.length) {
      this.phase = 'game-over';
      return;
    }
    this.active = (this.active + 1) % this.players.length;
    this.dice = [];
    this.rollsLeft = ROLL_LIMIT;
    this.lastScore = null;
    this.phase = 'rolling';
  }

  private preview(): Scorecard {
    if (!this.dice.length || this.phase !== 'rolling') return {};
    const available: Scorecard = {};
    const points = scores(this.dice);
    for (const { id } of categories) {
      if (this.players[this.active].scorecard[id] === undefined) available[id] = points[id];
    }
    return available;
  }

  automaticMove(): (() => void) | undefined {
    const player = this.players[this.active];
    if (this.phase !== 'rolling' || (!player.bot && player.connected) ||
      (!this.players.every((seat) => seat.bot) && !this.players.some((seat) => seat.connected && !seat.bot))) return;
    if (!this.dice.length) return () => this.act(player.id, { type: 'roll', held: [] });
    const preview = this.preview();
    const best = categories.filter(({ id }) => preview[id] !== undefined)
      .sort((a, b) => (preview[b.id] ?? 0) - (preview[a.id] ?? 0))[0].id;
    if (!this.rollsLeft || (preview[best] ?? 0) >= 18) return () => this.act(player.id, { type: 'score', category: best });
    const focus = [...new Set(this.dice)].sort((a, b) =>
      this.dice.filter((die) => die === b).length - this.dice.filter((die) => die === a).length || b - a)[0];
    const held = this.dice.flatMap((die, index) => die === focus ? [index] : []);
    if (held.length === DICE_COUNT) return () => this.act(player.id, { type: 'score', category: best });
    return () => this.act(player.id, { type: 'roll', held });
  }

  view(): HarborView {
    const best = Math.max(...this.players.map(({ total }) => total));
    return {
      activePlayerId: this.gameOver ? null : this.players[this.active].id,
      phase: this.phase, dice: [...this.dice], rollsLeft: this.rollsLeft, rollId: this.rollId,
      round: Math.min(categories.length, Math.floor((this.turns - Number(this.revealing)) / this.players.length) + 1),
      players: this.players.map((player) => ({ ...player, scorecard: { ...player.scorecard } })),
      preview: this.preview(), lastScore: this.lastScore && { ...this.lastScore },
      winnerIds: this.gameOver ? this.players.filter(({ total }) => total === best).map(({ id }) => id) : [],
    };
  }
}
