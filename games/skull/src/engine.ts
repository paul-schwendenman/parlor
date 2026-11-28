import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { range, sortDiscs, STARTING_DISCS, WIN_POINTS } from './rules.js';
import type { Disc, RoundResult, SkullAction, SkullOptions, SkullPhase, SkullView } from './types.js';

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  hand: Disc[];
  /** Index 0 is the bottom disc. */
  stack: Disc[];
  flipped: number;
  points: number;
  outOrder: number | null;
  passed: boolean;
  lastBid: number | null;
}

export class SkullEngine {
  private readonly seats: Seat[];
  private readonly options: SkullOptions;
  private phase: SkullPhase = 'ante';
  private round = 1;
  private starter: number;
  private active: number;
  private bid: number | null = null;
  private bidder: number | null = null;
  private challenger: number | null = null;
  private flips: { ownerId: string; disc: Disc }[] = [];
  private skullOwner: number | null = null;
  /** The challenger's discs in a fresh blind order while a penalty is picked. */
  private penaltyDiscs: Disc[] = [];
  private result: RoundResult | null = null;
  private winnerId: string | null = null;
  private outCount = 0;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    options: Partial<SkullOptions> = {},
  ) {
    if (players.length < 3 || players.length > 6) throw new GameRuleError('Skull needs 3 to 6 players.');
    this.seats = players.map((player) => ({
      ...player, connected: true, hand: [...STARTING_DISCS], stack: [], flipped: 0, points: 0,
      outOrder: null, passed: false, lastBid: null,
    }));
    this.options = { ownSkullLoss: 'choose', ...options };
    this.starter = this.active = random(players.length);
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'round-over'; }
  get revealDelay() { return this.result?.success ? 3500 : 4500; }

  private live(seat: Seat) { return seat.outOrder === null; }
  private get liveSeats() { return this.seats.filter((seat) => this.live(seat)); }
  private get total() { return this.seats.reduce((sum, seat) => sum + seat.stack.length, 0); }
  private index(id: string) { return this.seats.findIndex((seat) => seat.id === id); }

  private next(from: number, include: (seat: Seat) => boolean) {
    for (let step = 1; step <= this.seats.length; step++) {
      const i = (from + step) % this.seats.length;
      if (include(this.seats[i])) return i;
    }
    return from;
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private takeFromHand(seat: Seat, disc: Disc) {
    const at = seat.hand.indexOf(disc);
    if (at < 0) throw new GameRuleError(`You have no ${disc} in hand.`);
    seat.hand.splice(at, 1);
    seat.stack.push(disc);
  }

  act(id: string, action: SkullAction) {
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    const at = this.index(id);
    const seat = this.seats[at];
    // A challenger knocked out by their own skull still names the next starter.
    if (!seat || (!this.live(seat) && !(this.phase === 'choose-starter' && at === this.active))) {
      throw new GameRuleError('You are out of this game.');
    }
    if (action.type === 'ante') {
      if (this.phase !== 'ante') throw new GameRuleError('Everyone has already placed a first disc.');
      if (seat.stack.length) throw new GameRuleError('You have already placed your first disc.');
      this.takeFromHand(seat, action.disc);
      if (this.liveSeats.every((player) => player.stack.length)) {
        this.phase = 'placing';
        this.active = this.starter;
      }
      return;
    }
    if (at !== this.active || this.phase === 'ante' || this.phase === 'round-over') throw new GameRuleError('It is not your turn.');
    switch (action.type) {
      case 'place':
        if (this.phase !== 'placing') throw new GameRuleError('The bidding has started.');
        this.takeFromHand(seat, action.disc);
        this.active = this.next(at, (player) => this.live(player));
        return;
      case 'open':
        if (this.phase !== 'placing') throw new GameRuleError('The bidding has already started.');
        this.checkBid(action.amount, 1);
        this.raiseTo(at, action.amount);
        return;
      case 'raise':
        if (this.phase !== 'bidding') throw new GameRuleError('Nobody has opened the bidding yet.');
        this.checkBid(action.amount, this.bid! + 1);
        this.raiseTo(at, action.amount);
        return;
      case 'pass':
        if (this.phase !== 'bidding') throw new GameRuleError('You can only pass during the bidding.');
        seat.passed = true;
        this.afterBid();
        return;
      case 'flip':
        if (this.phase !== 'revealing') throw new GameRuleError('There is nothing to turn over yet.');
        if (!this.flipTargets().includes(action.targetId)) {
          throw new GameRuleError(seat.flipped < seat.stack.length ? 'Turn over your own discs first.' : 'That mat has nothing left to turn over.');
        }
        this.flip(this.index(action.targetId));
        return;
      case 'lose-disc':
        if (this.phase !== 'penalty') throw new GameRuleError('Nobody is losing a disc right now.');
        if (!Number.isInteger(action.index) || action.index < 0 || action.index >= this.penaltyDiscs.length) {
          throw new GameRuleError('Pick one of the discs.');
        }
        this.loseDisc(action.index);
        return;
      case 'choose-starter': {
        if (this.phase !== 'choose-starter') throw new GameRuleError('There is no one to choose right now.');
        const chosen = this.index(action.playerId);
        if (chosen < 0 || !this.live(this.seats[chosen])) throw new GameRuleError('Choose a player who is still in the game.');
        this.starter = chosen;
        this.result!.nextStarterId = action.playerId;
        this.phase = 'round-over';
        return;
      }
    }
  }

  private checkBid(amount: number, min: number) {
    if (!Number.isInteger(amount) || amount < min || amount > this.total) {
      throw new GameRuleError(min > this.total ? 'Nobody can bid higher.' : `Bid between ${min} and ${this.total}.`);
    }
  }

  private raiseTo(at: number, amount: number) {
    this.bid = amount;
    this.bidder = at;
    this.seats[at].lastBid = amount;
    this.phase = 'bidding';
    this.afterBid();
  }

  private afterBid() {
    const open = this.liveSeats.filter((seat) => !seat.passed);
    if (this.bid === this.total || open.length === 1) {
      this.phase = 'revealing';
      this.challenger = this.active = this.bidder!;
      return;
    }
    this.active = this.next(this.active, (seat) => this.live(seat) && !seat.passed);
  }

  private flipTargets(): string[] {
    if (this.phase !== 'revealing') return [];
    const own = this.seats[this.challenger!];
    if (own.flipped < own.stack.length) return [own.id];
    return this.seats.filter((seat) => seat !== own && this.live(seat) && seat.flipped < seat.stack.length).map(({ id }) => id);
  }

  private flip(target: number) {
    const seat = this.seats[target];
    const disc = seat.stack[seat.stack.length - 1 - seat.flipped];
    seat.flipped++;
    this.flips.push({ ownerId: seat.id, disc });
    const challenger = this.seats[this.challenger!];
    if (disc === 'skull') {
      this.skullOwner = target;
      for (const player of this.seats) {
        player.hand.push(...player.stack);
        player.stack = [];
        player.flipped = 0;
      }
      this.result = {
        challengerId: challenger.id, bid: this.bid!, success: false, skullOwnerId: seat.id,
        lostDisc: true, eliminatedId: null, nextStarterId: null,
      };
      const own = target === this.challenger;
      if (challenger.hand.length === 1 || (own && this.options.ownSkullLoss === 'random')) {
        this.penaltyDiscs = fisherYatesShuffle(challenger.hand, this.random);
        this.loseDisc(this.random(this.penaltyDiscs.length));
        return;
      }
      this.phase = 'penalty';
      this.active = target;
      this.penaltyDiscs = own ? sortDiscs(challenger.hand) : fisherYatesShuffle(challenger.hand, this.random);
      return;
    }
    if (this.flips.length < this.bid!) return;
    challenger.points++;
    this.result = {
      challengerId: challenger.id, bid: this.bid!, success: true, skullOwnerId: null,
      lostDisc: false, eliminatedId: null, nextStarterId: challenger.id,
    };
    if (challenger.points >= WIN_POINTS) {
      this.winnerId = challenger.id;
      this.phase = 'game-over';
      this.result.nextStarterId = null;
      return;
    }
    this.starter = this.challenger!;
    this.phase = 'round-over';
  }

  private loseDisc(index: number) {
    const challenger = this.seats[this.challenger!];
    const lost = this.penaltyDiscs[index];
    challenger.hand.splice(challenger.hand.indexOf(lost), 1);
    this.penaltyDiscs = [];
    const result = this.result!;
    const ownSkull = this.skullOwner === this.challenger;
    if (challenger.hand.length) {
      this.starter = this.challenger!;
      result.nextStarterId = challenger.id;
      this.phase = 'round-over';
      return;
    }
    challenger.outOrder = ++this.outCount;
    result.eliminatedId = challenger.id;
    const live = this.liveSeats;
    if (live.length === 1) {
      this.winnerId = live[0].id;
      this.phase = 'game-over';
      return;
    }
    if (ownSkull) {
      this.phase = 'choose-starter';
      this.active = this.challenger!;
      return;
    }
    this.starter = this.skullOwner!;
    result.nextStarterId = this.seats[this.skullOwner!].id;
    this.phase = 'round-over';
  }

  advanceReveal() {
    if (!this.revealing) return;
    for (const seat of this.seats) {
      seat.hand.push(...seat.stack);
      seat.stack = [];
      seat.flipped = 0;
      seat.passed = false;
      seat.lastBid = null;
    }
    this.round++;
    this.bid = this.bidder = this.challenger = this.skullOwner = null;
    this.flips = [];
    this.result = null;
    this.active = this.starter;
    this.phase = 'ante';
  }

  /** Who has to act for an automated seat, or null. */
  private automatedSeat(): Seat | null {
    if (this.phase === 'game-over' || this.revealing) return null;
    if (!this.seats.every((seat) => seat.bot) && !this.seats.some((seat) => seat.connected && !seat.bot)) return null;
    const automated = (seat: Seat) => seat.bot || !seat.connected;
    if (this.phase === 'ante') return this.liveSeats.find((seat) => !seat.stack.length && automated(seat)) ?? null;
    const seat = this.seats[this.active];
    return automated(seat) ? seat : null;
  }

  automaticMove(): (() => void) | undefined {
    const seat = this.automatedSeat();
    if (!seat) return;
    return () => this.act(seat.id, this.botAction(seat));
  }

  private chance(percent: number) {
    return this.random(100) < percent;
  }

  private botAction(seat: Seat): SkullAction {
    const live = this.liveSeats.length;
    const dirty = seat.stack.includes('skull');
    const flower = seat.hand.includes('flower') ? 'flower' : 'skull';
    switch (this.phase) {
      case 'ante':
        return { type: 'ante', disc: seat.hand.includes('skull') && (flower === 'skull' || this.chance(30)) ? 'skull' : flower };
      case 'placing': {
        const total = this.total;
        const open = (amount: number) => ({ type: 'open', amount: Math.max(1, Math.min(total, amount)) }) as const;
        if (!seat.hand.length) return open(dirty ? 1 : seat.stack.length);
        if (dirty) return total >= live + 3 ? open(1) : { type: 'place', disc: flower };
        if (total >= live + 1 && this.chance(50)) {
          return open(seat.stack.length + Math.floor(0.4 * (total - seat.stack.length)));
        }
        return { type: 'place', disc: seat.hand.includes('flower') ? 'flower' : 'skull' };
      }
      case 'bidding': {
        if (dirty) return { type: 'pass' };
        const quiet = this.liveSeats.filter((other) => other !== seat && other.lastBid === null).length;
        const others = this.total - seat.stack.length;
        const estimate = seat.stack.length + Math.floor(Math.max(0, 0.6 - 0.1 * quiet) * others);
        return this.bid! + 1 <= estimate ? { type: 'raise', amount: this.bid! + 1 } : { type: 'pass' };
      }
      case 'revealing': {
        const targets = this.flipTargets();
        const score = (id: string) => {
          const other = this.seats[this.index(id)];
          return (other.lastBid !== null ? 2 : -1) + (other.flipped ? 1 : 0) + (other.stack.length - other.flipped >= 2 ? 0.5 : 0);
        };
        const best = Math.max(...targets.map(score));
        const top = targets.filter((id) => score(id) === best);
        return { type: 'flip', targetId: top[this.random(top.length)] };
      }
      case 'penalty': {
        if (this.skullOwner !== this.challenger) return { type: 'lose-disc', index: this.random(this.penaltyDiscs.length) };
        const flowers = this.penaltyDiscs.filter((disc) => disc === 'flower').length;
        return { type: 'lose-disc', index: this.penaltyDiscs.indexOf(flowers >= 2 ? 'flower' : 'skull') };
      }
      default:
        return { type: 'choose-starter', playerId: this.seats[this.next(this.active, (other) => this.live(other))].id };
    }
  }

  view(playerId?: string): SkullView {
    const at = playerId === undefined ? -1 : this.index(playerId);
    const me = at >= 0 ? this.seats[at] : null;
    const acting = me !== null && at === this.active && this.phase !== 'ante' && this.phase !== 'round-over' &&
      this.phase !== 'game-over' && (this.live(me) || this.phase === 'choose-starter');
    const placing = acting && this.phase === 'placing';
    const bidding = acting && this.phase === 'bidding';
    return {
      phase: this.phase,
      round: this.round,
      options: { ...this.options },
      players: this.seats.map((seat, index) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, seat: index,
        discCount: seat.hand.length + seat.stack.length, handCount: seat.hand.length, stackCount: seat.stack.length,
        flippedCount: seat.flipped, anted: seat.stack.length > 0, points: seat.points, eliminated: !this.live(seat),
        outOrder: seat.outOrder, passed: seat.passed, lastBid: seat.lastBid,
      })),
      activePlayerId: this.phase === 'ante' || this.phase === 'round-over' || this.phase === 'game-over' ? null : this.seats[this.active].id,
      starterId: this.seats[this.starter].id,
      totalOnMats: this.total,
      bid: this.bid,
      bidderId: this.bidder === null ? null : this.seats[this.bidder].id,
      challengerId: this.challenger === null ? null : this.seats[this.challenger].id,
      flips: this.flips.map((flip) => ({ ...flip })),
      skullOwnerId: this.skullOwner === null ? null : this.seats[this.skullOwner].id,
      result: this.result && { ...this.result },
      winnerId: this.winnerId,
      myHand: me ? sortDiscs(me.hand) : [],
      myStack: me ? [...me.stack] : [],
      canAnte: this.phase === 'ante' && me !== null && this.live(me) && !me.stack.length,
      canOpen: placing,
      mustOpen: placing && !me.hand.length,
      canPlace: placing && me.hand.length > 0,
      legalBids: placing ? range(1, this.total) : bidding ? range(this.bid! + 1, this.total) : [],
      canPass: bidding,
      flipTargets: acting ? this.flipTargets() : [],
      penalty: acting && this.phase === 'penalty'
        ? this.skullOwner === this.challenger ? { kind: 'choose', discs: [...this.penaltyDiscs] }
          : { kind: 'blind', slots: this.penaltyDiscs.length, challengerId: this.seats[this.challenger!].id }
        : null,
      starterChoices: acting && this.phase === 'choose-starter' ? this.liveSeats.map(({ id }) => id) : [],
    };
  }
}
