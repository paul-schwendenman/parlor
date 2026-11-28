import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { availableMoves, DICE_COUNT, FINISH_SCORE, routeHeight, routes, type Progress, type Route } from './rules.js';
import type { RidgeAction, RidgeView } from './types.js';

type Seat = RidgeView['players'][number];

export class RidgeRunEngine {
  private readonly players: Seat[];
  private active: number;
  private phase: RidgeView['phase'] = 'ready';
  private dice: number[] = [];
  private rollId = 0;
  private climb: Progress = {};
  private firstSummits: RidgeView['firstSummits'] = {};
  private lastPoints = 0;
  private winnerId: string | null = null;

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[], private readonly random: RandomInt = secureRandomInt) {
    this.players = players.map((player) => ({ ...player, connected: true, progress: {}, points: 0 }));
    this.active = random(players.length);
  }

  private get player() { return this.players[this.active]; }
  get revealing() { return this.phase === 'bust' || this.phase === 'camped'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.players.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: RidgeAction) {
    const player = this.player;
    if (player.id !== id || this.revealing || this.gameOver) throw new GameRuleError('Wait for your turn.');
    switch (action.type) {
      case 'roll':
        if (this.phase !== 'ready') throw new GameRuleError('Choose a route before rolling.');
        this.dice = Array.from({ length: DICE_COUNT }, () => this.random(6) + 1);
        this.rollId++;
        if (availableMoves(this.dice, player.progress, this.climb).length) this.phase = 'choose';
        else this.phase = 'bust';
        return;
      case 'climb': {
        const move = this.phase === 'choose' && availableMoves(this.dice, player.progress, this.climb)
          .find(({ route }) => route === action.route);
        if (!move) throw new GameRuleError('Choose a route available on this roll.');
        this.climb[move.route] = (this.climb[move.route] ?? 0) + move.steps;
        this.phase = 'ready';
        return;
      }
      case 'camp':
        if (this.phase !== 'ready' || !Object.keys(this.climb).length) throw new GameRuleError('Climb before camping.');
        for (const { sum, height } of routes) {
          const steps = this.climb[sum];
          if (!steps) continue;
          const progress = (player.progress[sum] ?? 0) + steps;
          player.progress[sum] = progress;
          if (progress === height) {
            this.lastPoints += this.firstSummits[sum] ? 2 : 3;
            this.firstSummits[sum] ??= player.id;
          }
        }
        this.climb = {};
        player.points += this.lastPoints;
        this.phase = 'camped';
        return;
    }
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.player.points >= FINISH_SCORE) {
      this.winnerId = this.player.id;
      this.phase = 'game-over';
      return;
    }
    this.active = (this.active + 1) % this.players.length;
    this.climb = {};
    this.dice = [];
    this.lastPoints = 0;
    this.phase = 'ready';
  }

  automaticMove(): (() => void) | undefined {
    const player = this.player;
    if (this.revealing || this.gameOver || (!player.bot && player.connected) ||
      (!this.players.every((seat) => seat.bot) && !this.players.some((seat) => seat.connected && !seat.bot))) return;
    if (this.phase === 'choose') {
      const [move] = availableMoves(this.dice, player.progress, this.climb).sort((a, b) =>
        this.moveValue(b.route, b.steps) - this.moveValue(a.route, a.steps));
      return () => this.act(player.id, { type: 'climb', route: move.route });
    }
    const climbed = routes.filter(({ sum }) => this.climb[sum]);
    const camp = climbed.some(({ sum, height }) => (player.progress[sum] ?? 0) + this.climb[sum]! === height) ||
      climbed.reduce((steps, { sum }) => steps + this.climb[sum]!, 0) >= 3;
    return () => this.act(player.id, { type: camp ? 'camp' : 'roll' });
  }

  private moveValue(route: Route, steps: number) {
    const remaining = routeHeight(route) - (this.player.progress[route] ?? 0) - (this.climb[route] ?? 0);
    const reward = this.firstSummits[route] ? 2 : 3;
    return steps === remaining ? 10 + reward : steps * reward / remaining;
  }

  view(): RidgeView {
    return {
      phase: this.phase, activePlayerId: this.gameOver ? null : this.player.id,
      players: this.players.map((player) => ({ ...player, progress: { ...player.progress } })),
      dice: [...this.dice], rollId: this.rollId, climb: { ...this.climb },
      moves: this.phase === 'choose' ? availableMoves(this.dice, this.player.progress, this.climb) : [],
      firstSummits: { ...this.firstSummits }, lastPoints: this.lastPoints, winnerId: this.winnerId,
    };
  }
}
