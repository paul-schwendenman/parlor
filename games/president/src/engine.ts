import { cardEquals, createDeck, type Card } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { DEFAULT_OPTIONS, THREE_OF_CLUBS, legalPlays, pointsFor, rankValue, titleFor } from './rules.js';
import type { Play, PresidentAction, PresidentOptions, PresidentPhase, PresidentView, Title } from './types.js';

interface Player { id: string; name: string; bot: boolean }
interface Seat extends Player {
  connected: boolean;
  hand: Card[];
  received: Card[];
  score: number;
  title: Title | null;
  finishedAt: number | null;
  passed: boolean;
  passedThisTrick: boolean;
}
interface Return { from: Seat; to: Seat; count: number }

export class PresidentEngine {
  private readonly seats: Seat[];
  private readonly options: PresidentOptions;
  private active = 0;
  private dealer: number;
  private hand = 1;
  private trick: Play[] = [];
  private phase: PresidentPhase = 'playing';
  private reversed = false;
  private finishers: Seat[] = [];
  private returns: Return[] = [];
  private exchanges: PresidentView['exchanges'] = [];
  private requiredCard: Card | null = null;

  constructor(players: Player[], private readonly randomInt: RandomInt = secureRandomInt, options: Partial<PresidentOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.seats = players.map((player) => ({
      ...player, connected: true, hand: [], received: [], score: 0, title: null,
      finishedAt: null, passed: false, passedThisTrick: false,
    }));
    this.dealer = randomInt(players.length);
    this.deal();
  }

  get currentPhase() { return this.phase; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    this.phase = 'playing';
    this.trick = [];
    this.reversed = false;
    this.requiredCard = null;
    this.returns = [];
    this.exchanges = [];
    for (const seat of this.seats) {
      seat.hand = [];
      seat.received = [];
      seat.finishedAt = null;
      seat.passed = false;
      seat.passedThisTrick = false;
    }
    this.active = (this.dealer + 1) % this.seats.length;
    fisherYatesShuffle(createDeck(), this.randomInt).forEach((card, i) => {
      this.seats[(this.active + i) % this.seats.length].hand.push(card);
    });
    for (const seat of this.seats) this.sortHand(seat);

    if (this.hand > 1) {
      const [president, vice] = this.finishers;
      this.active = this.seats.indexOf(president);
      this.openExchange(president, this.finishers.at(-1)!, this.options.exchange === 'two' ? 2 : 1);
      if (this.options.exchange === 'two') this.openExchange(vice, this.finishers.at(-2)!, 1);
      this.phase = 'exchange';
    } else if (this.options.firstLead === 'three-of-clubs') {
      this.requiredCard = THREE_OF_CLUBS;
      this.active = this.seats.findIndex((seat) => seat.hand.some((card) => cardEquals(card, THREE_OF_CLUBS)));
    }
    this.finishers = [];
  }

  private sortHand(seat: Seat) {
    seat.hand.sort((a, b) => rankValue(a.rank) - rankValue(b.rank) || a.suit.localeCompare(b.suit));
  }

  private transfer(from: Seat, to: Seat, cards: Card[]) {
    from.hand = from.hand.filter((card) => !cards.some((choice) => cardEquals(choice, card)));
    to.hand.push(...cards);
    to.received.push(...cards);
    this.sortHand(to);
    this.exchanges.push({ from: from.id, to: to.id, count: cards.length });
  }

  private openExchange(high: Seat, low: Seat, count: number) {
    this.transfer(low, high, low.hand.slice(-count));
    this.returns.push({ from: high, to: low, count });
  }

  private get standing() { return this.trick.at(-1); }

  private plays(seat: Seat) {
    return legalPlays(seat.hand, this.standing?.cards, this.reversed, this.requiredCard?.rank);
  }

  act(id: string, action: PresidentAction) {
    const seat = this.seats.find((player) => player.id === id);
    if (!seat) throw new GameRuleError('Take a seat to play.');
    if (action.type === 'return-cards') {
      const exchange = this.returns.find(({ from }) => from === seat);
      if (this.phase !== 'exchange' || !exchange || action.cards.length !== exchange.count || !this.owns(seat, action.cards)) {
        throw new GameRuleError('Choose the required number of cards from your hand.');
      }
      this.transfer(seat, exchange.to, action.cards);
      this.returns = this.returns.filter((item) => item !== exchange);
      if (!this.returns.length) this.phase = 'playing';
      return;
    }
    if (this.phase !== 'playing' || seat !== this.seats[this.active]) throw new GameRuleError('Wait for your turn.');
    if (action.type === 'pass') {
      if (!this.standing) throw new GameRuleError('Lead the trick with a set.');
      seat.passed = true;
      seat.passedThisTrick = true;
    } else {
      const rank = action.cards[0]?.rank;
      if (!this.owns(seat, action.cards) || action.cards.some((card) => card.rank !== rank) ||
        !this.plays(seat).some((play) => play.rank === rank && play.counts.includes(action.cards.length)) ||
        (this.requiredCard && !action.cards.some((card) => cardEquals(card, this.requiredCard!)))) {
        throw new GameRuleError('Choose a legal set from your hand.');
      }
      seat.hand = seat.hand.filter((card) => !action.cards.some((choice) => cardEquals(choice, card)));
      this.trick.push({ playerId: id, cards: action.cards.map((card) => ({ ...card })) });
      this.requiredCard = null;
      for (const player of this.seats) player.passed = false;
      if (!seat.hand.length) this.finish(seat);
      if (this.finishers.length === this.seats.length - 1) {
        this.finish(this.seats.find((player) => player.hand.length)!);
        this.scoreHand();
        return;
      }
      if (this.options.revolution && action.cards.length === 4) this.reversed = !this.reversed;
      if (this.options.twoClears && rank === '2') {
        this.phase = 'trick-cleared';
        return;
      }
    }
    const leader = this.standing!.playerId;
    const canRespond = (player: Seat) => player.hand.length > 0 && player.id !== leader && !player.passed &&
      !(this.options.passIsOut && player.passedThisTrick);
    const next = this.next(this.active, canRespond);
    if (next < 0) this.phase = 'trick-cleared';
    else this.active = next;
  }

  private owns(seat: Seat, cards: Card[]) {
    return cards.every((card, i) => seat.hand.some((held) => cardEquals(held, card)) &&
      !cards.slice(0, i).some((earlier) => cardEquals(earlier, card)));
  }

  private next(after: number, eligible: (seat: Seat) => boolean) {
    for (let offset = 1; offset < this.seats.length; offset++) {
      const index = (after + offset) % this.seats.length;
      if (eligible(this.seats[index])) return index;
    }
    return -1;
  }

  private finish(seat: Seat) {
    this.finishers.push(seat);
    seat.finishedAt = this.finishers.length;
  }

  private scoreHand() {
    this.phase = 'hand-scoring';
    for (const seat of this.finishers) {
      seat.title = titleFor(seat.finishedAt!, this.seats.length, this.options.exchange);
      seat.score += pointsFor(seat.finishedAt!);
    }
  }

  advanceReveal() {
    if (this.phase === 'trick-cleared') {
      const standing = this.seats.findIndex(({ id }) => id === this.standing!.playerId);
      this.active = this.seats[standing].hand.length ? standing : this.next(standing, (seat) => seat.hand.length > 0);
      this.trick = [];
      for (const seat of this.seats) {
        seat.passed = false;
        seat.passedThisTrick = false;
      }
      this.phase = 'playing';
    } else if (this.phase === 'hand-scoring') {
      if (this.seats.some((seat) => seat.score >= this.options.target)) {
        this.phase = 'game-over';
      } else {
        this.hand++;
        this.dealer = this.seats.indexOf(this.finishers.at(-1)!);
        this.deal();
      }
    }
  }

  automaticMove(): (() => void) | undefined {
    const automated = (seat: Seat) => seat.bot || !seat.connected;
    if (!this.seats.every((seat) => seat.bot) && !this.seats.some((seat) => !automated(seat))) return;
    if (this.phase === 'exchange') {
      const exchange = this.returns.find(({ from }) => automated(from));
      if (exchange) return () => this.act(exchange.from.id, { type: 'return-cards', cards: exchange.from.hand.slice(0, exchange.count) });
    }
    const seat = this.seats[this.active];
    if (this.phase !== 'playing' || !automated(seat)) return;
    const plays = this.plays(seat);
    const selected = !this.standing ? plays[0] : plays.find(({ rank, counts }) => {
      const held = seat.hand.filter((card) => card.rank === rank).length;
      return seat.hand.length <= 5 || (held === counts[0] && rank !== '2' && rank !== 'A');
    });
    if (!selected) return () => this.act(seat.id, { type: 'pass' });
    const candidates = seat.hand.filter((card) => card.rank === selected.rank)
      .sort((a, b) => Number(cardEquals(b, THREE_OF_CLUBS)) - Number(cardEquals(a, THREE_OF_CLUBS)));
    const cards = candidates.slice(0, selected.counts.at(-1));
    return () => this.act(seat.id, { type: 'play', cards });
  }

  view(id?: string): PresidentView {
    const viewer = this.seats.find((seat) => seat.id === id);
    const acting = this.phase === 'playing' && !!viewer && viewer === this.seats[this.active];
    const winner = this.phase === 'game-over'
      ? [...this.finishers].sort((a, b) => b.score - a.score)[0] : undefined;
    return {
      phase: this.phase, hand: this.hand, target: this.options.target, reversed: this.reversed,
      activePlayerId: this.phase === 'playing' ? this.seats[this.active].id : null,
      players: this.seats.map(({ id, name, bot, connected, hand, score, title, finishedAt, passed }) =>
        ({ id, name, bot, connected, cardCount: hand.length, score, title, finishedAt, passed })),
      trick: this.trick.map(({ playerId, cards }) => ({ playerId, cards: cards.map((card) => ({ ...card })) })),
      myHand: viewer?.hand.map((card) => ({ ...card })) ?? [],
      received: viewer?.received.map((card) => ({ ...card })) ?? [],
      legalPlays: acting ? this.plays(viewer) : [], requiredCard: acting ? this.requiredCard : null,
      canPass: acting && !!this.standing, mustReturn: this.returns.find(({ from }) => from === viewer)?.count ?? 0,
      exchanges: this.exchanges.map((exchange) => ({ ...exchange })),
      winnerIds: winner ? [winner.id] : [],
    };
  }
}
