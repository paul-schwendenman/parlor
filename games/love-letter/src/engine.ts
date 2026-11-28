import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { DECKS, guessable, mustPlayCountess, targetTokens, unseenCounts, type CardValue } from './rules.js';
import type {
  LoveLetterAction, LoveLetterMove, LoveLetterOptions, LoveLetterPhase, LoveLetterView, PlayEvent, RoundResult, TrailCard,
} from './types.js';

type Knowledge = { card: CardValue; source: 'priest' | 'baron' | 'king' };

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  left: boolean;
  hand: CardValue[];
  trail: TrailCard[];
  out: boolean;
  protected: boolean;
  tokens: number;
  memory: Map<string, Knowledge>;
}

/** Cards that pick another player, and so can be played with no effect. */
const TARGETED = new Set<CardValue>([1, 2, 3, 7]);

export const DEFAULT_OPTIONS: LoveLetterOptions = { edition: 'standard', tieBreak: 'share', hints: true };

export class LoveLetterEngine {
  private readonly seats: Seat[];
  private readonly options: LoveLetterOptions;
  private readonly target: number;
  /** The top of the deck is the end of the array. */
  private deck: CardValue[] = [];
  private setAside: CardValue | null = null;
  private faceUp: CardValue[] = [];
  private active = 0;
  private phase: LoveLetterPhase = 'turn';
  private round = 0;
  private events: PlayEvent[] = [];
  private chancellorReturn = 0;
  private lastRound: RoundResult | null = null;
  private winnerIds: string[] = [];

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    options: Partial<LoveLetterOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    const max = this.options.edition === 'classic' ? 4 : 6;
    if (players.length < 2 || players.length > max) throw new GameRuleError(`Love Letter needs 2 to ${max} players.`);
    this.seats = players.map((player) => ({
      ...player, connected: true, left: false, hand: [], trail: [], out: false, protected: false, tokens: 0, memory: new Map(),
    }));
    this.target = targetTokens(players.length);
    this.startRound(random(players.length));
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'round-over'; }
  private get seat() { return this.seats[this.active]; }
  private alive(seat: Seat) { return !seat.out && !seat.left; }
  private find(id: string) { return this.seats.find((seat) => seat.id === id); }

  /** Test hook: set hands and, if given, the whole deck (first drawn first). */
  rig(hands: Record<string, CardValue[]>, deck?: CardValue[]) {
    for (const seat of this.seats) if (hands[seat.id]) seat.hand = [...hands[seat.id]];
    if (deck) this.deck = [...deck].reverse();
  }

  private startRound(starter: number) {
    this.round++;
    const deck = fisherYatesShuffle(DECKS[this.options.edition], this.random);
    this.setAside = deck.pop()!;
    this.faceUp = this.seats.filter((seat) => !seat.left).length === 2 ? deck.splice(-3) : [];
    for (const seat of this.seats) {
      seat.hand = seat.left ? [] : [deck.pop()!];
      seat.trail = [];
      seat.out = seat.left;
      seat.protected = false;
      seat.memory.clear();
    }
    this.deck = deck;
    this.events = [];
    this.lastRound = null;
    this.active = starter;
    if (this.seat.left) this.active = this.nextAlive(starter);
    this.phase = 'turn';
    this.startTurn();
  }

  private startTurn() {
    this.seat.protected = false;
    this.seat.hand.push(this.deck.pop()!);
  }

  private nextAlive(from: number) {
    for (let step = 1; step <= this.seats.length; step++) {
      const i = (from + step) % this.seats.length;
      if (this.alive(this.seats[i])) return i;
    }
    return from;
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.find(id);
    if (seat) seat.connected = connected;
  }

  /** Others still in and not protected. */
  private others(seat: Seat) {
    return this.seats.filter((other) => other !== seat && this.alive(other) && !other.protected);
  }

  private movesFor(seat: Seat): LoveLetterMove[] {
    const forced = mustPlayCountess(seat.hand);
    const others = this.others(seat).map(({ id }) => id);
    return [...new Set(seat.hand)].filter((card) => !forced || card === 8).map((card) => {
      let targets: string[] = [];
      if (card === 5) targets = [...others, seat.id];
      else if ([1, 2, 3, 7].includes(card)) targets = others;
      return { card, targets, guesses: card === 1 && targets.length ? guessable(this.options.edition) : [] };
    });
  }

  act(id: string, action: LoveLetterAction) {
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    const seat = this.seat;
    if (seat.id !== id || this.revealing) throw new GameRuleError('It is not your turn.');
    if (action.type === 'chancellor') return this.chancellor(seat, action.keep, action.bottom);
    if (this.phase !== 'turn') throw new GameRuleError('Choose which card to keep first.');
    const move = this.movesFor(seat).find(({ card }) => card === action.card);
    if (!seat.hand.includes(action.card)) throw new GameRuleError('That card is not in your hand.');
    if (!move) throw new GameRuleError('You must play the Countess.');
    if (move.targets.length) {
      if (action.target === undefined || !move.targets.includes(action.target)) throw new GameRuleError('Choose a player who can be picked.');
    } else if (action.target !== undefined) throw new GameRuleError('Nobody can be picked, so this card has no effect.');
    if (move.guesses.length) {
      if (action.guess === undefined || !move.guesses.includes(action.guess)) throw new GameRuleError('Name a card other than the Guard.');
    } else if (action.guess !== undefined) throw new GameRuleError('Only the Guard names a card.');

    seat.hand.splice(seat.hand.indexOf(action.card), 1);
    this.discard(seat, action.card, 'played');
    const target = action.target === undefined ? undefined : this.find(action.target)!;
    const event: PlayEvent = {
      seq: this.events.length, byId: seat.id, card: action.card, targetId: target?.id ?? null,
      noEffect: TARGETED.has(action.card) && !target, knockedOut: [],
    };
    this.events.push(event);
    this.resolve(seat, action.card, target, action.guess, event);
    if (this.phase === 'turn') this.endTurn();
  }

  private resolve(seat: Seat, card: CardValue, target: Seat | undefined, guess: CardValue | undefined, event: PlayEvent) {
    switch (card) {
      case 1:
        if (!target) return;
        event.guess = guess;
        event.hit = target.hand[0] === guess;
        if (event.hit) this.knockOut(target, event);
        return;
      case 2:
        if (!target) return;
        event.seen = target.hand[0];
        seat.memory.set(target.id, { card: target.hand[0], source: 'priest' });
        return;
      case 3: {
        if (!target) return;
        const [mine, theirs] = [seat.hand[0], target.hand[0]];
        event.compare = { mine, theirs };
        event.baronResult = mine === theirs ? 'tie' : mine > theirs ? 'win' : 'lose';
        seat.memory.set(target.id, { card: theirs, source: 'baron' });
        target.memory.set(seat.id, { card: mine, source: 'baron' });
        if (mine > theirs) this.knockOut(target, event);
        else if (theirs > mine) this.knockOut(seat, event);
        return;
      }
      case 4:
        seat.protected = true;
        return;
      case 5: {
        const victim = target!;
        const dropped = victim.hand.pop()!;
        event.princeDiscard = dropped;
        this.forget(victim);
        if (dropped === 9) {
          this.discard(victim, dropped, 'discarded');
          this.knockOut(victim, event);
          event.knockedOut.push({ id: victim.id, card: 9 });
          return;
        }
        this.discard(victim, dropped, 'discarded');
        if (this.deck.length) victim.hand.push(this.deck.pop()!);
        else {
          victim.hand.push(this.setAside!);
          this.setAside = null;
          event.drewSetAside = true;
        }
        return;
      }
      case 6: {
        const draw = Math.min(2, this.deck.length);
        if (!draw) { event.noEffect = true; return; }
        seat.hand.push(...this.deck.splice(-draw).reverse());
        this.chancellorReturn = draw;
        event.returned = draw;
        this.phase = 'chancellor';
        return;
      }
      case 7: {
        if (!target) return;
        const [mine, theirs] = [seat.hand[0], target.hand[0]];
        seat.hand = [theirs];
        target.hand = [mine];
        this.forget(seat);
        this.forget(target);
        seat.memory.set(target.id, { card: mine, source: 'king' });
        target.memory.set(seat.id, { card: theirs, source: 'king' });
        return;
      }
      case 9:
        this.knockOut(seat, event);
        event.knockedOut.unshift({ id: seat.id, card: 9 });
        return;
    }
  }

  private chancellor(seat: Seat, keep: CardValue, bottom: CardValue[]) {
    if (this.phase !== 'chancellor') throw new GameRuleError('You have no cards to put back.');
    const given = [keep, ...bottom].sort();
    if (bottom.length !== this.chancellorReturn || given.join() !== [...seat.hand].sort().join()) {
      throw new GameRuleError(`Keep one card and put ${this.chancellorReturn} under the deck.`);
    }
    seat.hand = [keep];
    this.deck.unshift(...bottom);
    this.forget(seat);
    this.chancellorReturn = 0;
    this.phase = 'turn';
    this.endTurn();
  }

  /** A card leaving `seat`'s hand face up: anyone who knew they held it forgets. */
  private discard(seat: Seat, value: CardValue, how: TrailCard['how']) {
    seat.trail.push({ value, how });
    for (const other of this.seats) if (other.memory.get(seat.id)?.card === value) other.memory.delete(seat.id);
  }

  private forget(seat: Seat) {
    for (const other of this.seats) other.memory.delete(seat.id);
  }

  private knockOut(seat: Seat, event: PlayEvent) {
    for (const card of seat.hand) {
      seat.trail.push({ value: card, how: 'knocked-out' });
      event.knockedOut.push({ id: seat.id, card });
    }
    seat.hand = [];
    seat.out = true;
    seat.protected = false;
    this.forget(seat);
  }

  private endTurn() {
    const alive = this.seats.filter((seat) => this.alive(seat));
    if (alive.length <= 1 || !this.deck.length) return this.endRound(alive);
    this.active = this.nextAlive(this.active);
    this.startTurn();
  }

  private endRound(alive: Seat[]) {
    const discardTotal = (seat: Seat) => seat.trail.reduce((sum, { value }) => sum + value, 0);
    let winners = alive;
    if (alive.length > 1) {
      const best = Math.max(...alive.map(({ hand }) => hand[0]));
      winners = alive.filter(({ hand }) => hand[0] === best);
      if (winners.length > 1 && this.options.tieBreak === 'discards') {
        const top = Math.max(...winners.map(discardTotal));
        winners = winners.filter((seat) => discardTotal(seat) === top);
      }
    }
    for (const seat of winners) seat.tokens++;
    const spies = alive.filter((seat) => seat.trail.some(({ value, how }) => value === 0 && how !== 'knocked-out'));
    if (spies.length === 1) spies[0].tokens++;
    this.lastRound = {
      reason: alive.length > 1 ? 'deck-empty' : 'last-standing',
      hands: this.seats.filter((seat) => !seat.left).map((seat) => ({ id: seat.id, card: seat.hand[0] ?? null, discardTotal: discardTotal(seat) })),
      setAside: this.setAside,
      winnerIds: winners.map(({ id }) => id),
      spyId: spies.length === 1 ? spies[0].id : null,
    };
    this.phase = 'round-over';
  }

  advanceReveal() {
    if (!this.revealing) return;
    const champions = this.seats.filter((seat) => !seat.left && seat.tokens >= this.target);
    if (champions.length) {
      this.winnerIds = champions.map(({ id }) => id);
      this.phase = 'game-over';
      return;
    }
    const winners = this.lastRound!.winnerIds.map((id) => this.seats.findIndex((seat) => seat.id === id))
      .filter((i) => !this.seats[i].left);
    this.startRound(winners.length ? winners[this.random(winners.length)] : this.active);
  }

  /** A player left for good: knocked out of this round and skipped after. */
  remove(id: string) {
    const seat = this.find(id);
    if (!seat || seat.left || this.phase === 'game-over') return;
    const wasActive = this.seat === seat && !this.revealing;
    if (this.phase === 'chancellor' && wasActive) {
      this.deck.unshift(...seat.hand.slice(1));
      seat.hand = seat.hand.slice(0, 1);
      this.phase = 'turn';
    }
    if (!seat.out && !this.revealing) {
      const event: PlayEvent = { seq: this.events.length, byId: seat.id, card: seat.hand[0] ?? 0, targetId: null, noEffect: true, knockedOut: [] };
      this.knockOut(seat, event);
    }
    seat.left = true;
    seat.out = true;
    const remaining = this.seats.filter((other) => !other.left);
    if (remaining.length < 2) {
      this.winnerIds = remaining.map(({ id }) => id);
      this.phase = 'game-over';
      return;
    }
    if (this.revealing) return;
    if (wasActive) this.endTurn();
    else if (this.seats.filter((other) => this.alive(other)).length <= 1) this.endRound(this.seats.filter((other) => this.alive(other)));
  }

  automaticMove(): (() => void) | undefined {
    if (this.phase !== 'turn' && this.phase !== 'chancellor') return;
    const seat = this.seat;
    if (!seat.bot && seat.connected) return;
    if (!this.seats.every((other) => other.bot || other.left) && !this.seats.some((other) => other.connected && !other.bot && !other.left)) return;
    return () => this.act(seat.id, this.botAction(seat));
  }

  private visibleTo(seat: Seat | undefined): CardValue[] {
    return [
      ...this.faceUp, ...this.seats.flatMap(({ trail }) => trail.map(({ value }) => value)), ...(seat?.hand ?? []),
    ];
  }

  private botAction(seat: Seat): LoveLetterAction {
    const unseen = unseenCounts(this.options.edition, this.visibleTo(seat));
    if (this.phase === 'chancellor') {
      const sorted = [...seat.hand].sort((a, b) => b - a);
      let keep = sorted[0];
      if (keep === 9 && (unseen[5] ?? 0) >= 2 && sorted[1] >= 5) keep = sorted[1];
      const rest = [...seat.hand];
      rest.splice(rest.indexOf(keep), 1);
      return { type: 'chancellor', keep, bottom: rest.sort((a, b) => b - a) };
    }
    const moves = this.movesFor(seat);
    const leader = (ids: string[]) => {
      const pool = ids.map((id) => this.find(id)!);
      const known = pool.filter((other) => !seat.memory.has(other.id));
      const ranked = (known.length ? known : pool).sort((a, b) => b.tokens - a.tokens);
      return ranked[0]?.id;
    };
    if (moves.length === 1) return this.withTarget(seat, moves[0], leader, unseen);
    // Sure kills.
    for (const move of moves) {
      const rest = [...seat.hand];
      rest.splice(rest.indexOf(move.card), 1);
      const other = rest[0];
      for (const id of move.targets) {
        const knownCard = seat.memory.get(id)?.card;
        if (knownCard === undefined || id === seat.id) continue;
        if (move.card === 1 && knownCard !== 1) return { type: 'play', card: 1, target: id, guess: knownCard };
        if (move.card === 3 && other > knownCard) return { type: 'play', card: 3, target: id };
        if (move.card === 5 && knownCard === 9) return { type: 'play', card: 5, target: id };
      }
    }
    const [a, b] = seat.hand;
    const keepScore = (keep: CardValue, play: CardValue) => {
      let score = keep;
      if (play === 9) return -100;
      if (keep === 0) score -= 3;
      if (keep === 3 && play <= 4) score -= 3;
      if (play === 4 && keep >= 7) score += 2;
      if (play === 2) score += 1;
      if (play === 7 && keep > 4) score -= 6;
      if (play === 5 && keep === 9 && !this.others(seat).length) return -100;
      return score;
    };
    const play = keepScore(b, a) >= keepScore(a, b) ? a : b;
    return this.withTarget(seat, moves.find(({ card }) => card === play) ?? moves[0], leader, unseen);
  }

  private withTarget(seat: Seat, move: LoveLetterMove, leader: (ids: string[]) => string | undefined, unseen: Partial<Record<CardValue, number>>): LoveLetterAction {
    if (!move.targets.length) return { type: 'play', card: move.card };
    const others = move.targets.filter((id) => id !== seat.id);
    let target = others.length ? leader(others)! : seat.id;
    if (move.card === 5 && seat.hand.includes(9) && others.length) target = leader(others)!;
    if (move.card !== 1) return { type: 'play', card: move.card, target };
    const known = seat.memory.get(target)?.card;
    const guess = known !== undefined && known !== 1 ? known
      : [...move.guesses].sort((x, y) => (unseen[y] ?? 0) - (unseen[x] ?? 0) || y - x)[0];
    return { type: 'play', card: 1, target, guess };
  }

  view(playerId?: string): LoveLetterView {
    const me = playerId === undefined ? undefined : this.find(playerId);
    const acting = me !== undefined && me === this.seat && (this.phase === 'turn' || this.phase === 'chancellor');
    const reveal = this.phase === 'round-over' || this.phase === 'game-over';
    return {
      phase: this.phase,
      edition: this.options.edition,
      round: this.round,
      target: this.target,
      deckCount: this.deck.length,
      faceUp: [...this.faceUp],
      activePlayerId: this.phase === 'turn' || this.phase === 'chancellor' ? this.seat.id : null,
      players: this.seats.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, left: seat.left, out: seat.out,
        protected: seat.protected, tokens: seat.tokens, cardCount: seat.hand.length, trail: seat.trail.map((card) => ({ ...card })),
      })),
      events: this.events.map((event) => {
        const { seen, compare, ...rest } = event;
        const copy: PlayEvent = { ...rest, knockedOut: event.knockedOut.map((entry) => ({ ...entry })) };
        if (seen !== undefined && me?.id === event.byId) copy.seen = seen;
        if (compare && me?.id === event.byId) copy.compare = { ...compare };
        if (compare && me?.id === event.targetId) copy.compare = { mine: compare.theirs, theirs: compare.mine };
        return copy;
      }),
      lastRound: reveal && this.lastRound ? { ...this.lastRound, hands: this.lastRound.hands.map((hand) => ({ ...hand })) } : null,
      winnerIds: [...this.winnerIds],
      myHand: me ? [...me.hand] : [],
      moves: acting && this.phase === 'turn' ? this.movesFor(me) : [],
      forcedCountess: acting && this.phase === 'turn' && mustPlayCountess(me.hand),
      chancellorReturn: acting && this.phase === 'chancellor' ? this.chancellorReturn : 0,
      known: me && this.options.hints ? [...me.memory].map(([id, knowledge]) => ({ id, ...knowledge })) : [],
      unseen: this.options.hints ? unseenCounts(this.options.edition, this.visibleTo(me)) : {},
    };
  }
}

