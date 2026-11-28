import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { cacheSupply, maxBounty, openingScore, ownerScore, startingBounties, type Cache } from './rules.js';
import type { FaultAction, FaultPlayer, FaultView } from './types.js';

interface Seat extends Omit<FaultPlayer, 'ready'> {
  hand: Cache[];
  cache: Cache | null;
  target: string | null | undefined;
}

export class FaultLineEngine {
  private readonly players: Seat[];
  private phase: FaultView['phase'] = 'plant';
  private round = 1;
  private last: FaultView['last'] = [];

  constructor(players: { id: string; name: string; bot: boolean }[], private readonly random: RandomInt = secureRandomInt) {
    this.players = players.map((player) => ({
      ...player, connected: true, score: 0, chips: startingBounties,
      bounty: null, history: [], hand: [...cacheSupply], cache: null, target: undefined,
    }));
  }

  get revealing() { return this.phase === 'reveal'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.players.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: FaultAction) {
    const seat = this.players.find((player) => player.id === id);
    if (!seat || action.round !== this.round) throw new GameRuleError('This round has ended.');
    if (action.type === 'plant') {
      const index = seat.hand.indexOf(action.cache);
      if (this.phase !== 'plant' || seat.cache !== null || index < 0 || !Number.isInteger(action.bounty) ||
        action.bounty < 0 || action.bounty > Math.min(seat.chips, maxBounty)) {
        throw new GameRuleError('Choose a cache and bounty you can afford.');
      }
      seat.hand.splice(index, 1);
      seat.cache = action.cache;
      seat.bounty = action.bounty;
      if (this.players.every((player) => player.cache !== null)) {
        for (const player of this.players) player.chips -= player.bounty!;
        this.phase = 'open';
      }
    } else {
      if (this.phase !== 'open' || seat.target !== undefined ||
        (action.target !== null && !this.players.some((player) => player.id === action.target && player !== seat))) {
        throw new GameRuleError('Choose a rival cache or pass.');
      }
      seat.target = action.target;
      if (this.players.every((player) => player.target !== undefined)) this.reveal();
    }
  }

  private reveal() {
    this.last = this.players.map((seat) => {
      const target = this.players.find(({ id }) => id === seat.target);
      const cache = seat.cache!;
      const openings = this.players.filter(({ target: chosen }) => chosen === seat.id).length;
      const points = ownerScore(cache, openings) + (target ? openingScore(target.cache!, target.bounty!) : 0);
      seat.score += points;
      seat.history.push(cache);
      return { id: seat.id, cache, target: seat.target ?? null, points };
    });
    this.phase = 'reveal';
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.round === cacheSupply.length) {
      this.phase = 'game-over';
      return;
    }
    this.round++;
    for (const player of this.players) {
      player.cache = null;
      player.bounty = null;
      player.target = undefined;
    }
    this.last = [];
    this.phase = 'plant';
  }

  private isReady(seat: Seat) {
    return this.phase === 'plant' ? seat.cache !== null : this.phase === 'open' && seat.target !== undefined;
  }

  automaticMove(): (() => void) | undefined {
    if (this.revealing || this.gameOver ||
      (!this.players.every((seat) => seat.bot) && !this.players.some((seat) => seat.connected && !seat.bot))) return;
    const seat = this.players.find((player) => (player.bot || !player.connected) && !this.isReady(player));
    if (!seat) return;
    if (this.phase === 'plant') {
      return () => {
        const cache = seat.hand[this.random(seat.hand.length)];
        const bounty = (cache === 0 || this.random(3) === 0) ? Math.min(seat.chips, 1 + this.random(maxBounty)) : 0;
        this.act(seat.id, { type: 'plant', round: this.round, cache, bounty });
      };
    }
    const candidates = this.players.filter((player) => player !== seat).map((player) => {
      const remaining: Cache[] = [...cacheSupply];
      for (const cache of player.history) remaining.splice(remaining.indexOf(cache), 1);
      const expected = remaining.reduce<number>((total, cache) => total + openingScore(cache, player.bounty!), 0) / remaining.length;
      return { id: player.id, expected };
    }).sort((a, b) => b.expected - a.expected);
    return () => this.act(seat.id, { type: 'open', round: this.round, target: candidates[0].expected > 0 ? candidates[0].id : null });
  }

  view(id?: string): FaultView {
    const me = this.players.find((player) => player.id === id);
    const best = Math.max(...this.players.map(({ score }) => score));
    return {
      phase: this.phase, round: this.round,
      players: this.players.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, score: seat.score,
        chips: seat.chips, bounty: this.phase === 'plant' ? null : seat.bounty, ready: this.isReady(seat), history: [...seat.history],
      })),
      myHand: me ? [...me.hand] : [], myCache: me?.cache ?? null, myTarget: me?.target ?? null,
      last: this.last.map((entry) => ({ ...entry })),
      winnerIds: this.gameOver ? this.players.filter(({ score }) => score === best).map(({ id }) => id) : [],
    };
  }
}
