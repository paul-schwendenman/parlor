import { SUITS, aceLowRankValue, cardEquals, createDeck, type Card } from '@parlor/cards';
import { bestArrangement, deadwoodValue } from '@parlor/cards/melds';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { DEFAULT_OPTIONS, scoreHand } from './rules.js';
import type { GinAction, GinOptions, GinPhase, GinView, HandResult } from './types.js';

interface Player { id: string; name: string; bot: boolean }
interface Seat extends Player {
  connected: boolean;
  hand: Card[];
  score: number;
  handsWon: number;
  took: Card[];
}

const without = (hand: readonly Card[], card: Card) => hand.filter((held) => !cardEquals(held, card));

export class GinEngine {
  private readonly seats: Seat[];
  private readonly options: GinOptions;
  private dealer: number;
  private active = 0;
  private phase: GinPhase = 'upcard';
  private stock: Card[] = [];
  private discard: Card[] = [];
  private stockOnly = false;
  private taken: Card | null = null;
  private limit = 10;
  private doubled = false;
  private lastResult: HandResult | null = null;
  private handNumber = 1;
  private final: GinView['final'] = null;

  constructor(players: Player[], private readonly randomInt: RandomInt = secureRandomInt, options: Partial<GinOptions> = {}) {
    if (players.length !== 2) throw new RangeError('Gin Rummy requires two players.');
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.seats = players.map((player) => ({ ...player, connected: true, hand: [], score: 0, handsWon: 0, took: [] }));
    this.dealer = randomInt(2);
    this.deal();
  }

  get revealing() { return this.phase === 'hand-scoring'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    this.stock = fisherYatesShuffle(createDeck(), this.randomInt);
    this.active = 1 - this.dealer;
    for (const seat of this.seats) {
      seat.hand = this.stock.splice(0, 10);
      seat.took = [];
      this.sortHand(seat);
    }
    const upcard = this.stock.pop()!;
    this.discard = [upcard];
    const oklahoma = this.options.knockLimit === 'oklahoma';
    this.limit = oklahoma ? upcard.rank === 'A' ? 0 : deadwoodValue(upcard) : this.options.knockLimit as number;
    this.doubled = oklahoma && upcard.suit === 'spades';
    this.phase = 'upcard';
    this.taken = null;
    this.stockOnly = false;
    this.lastResult = null;
  }

  private sortHand(seat: Seat) {
    seat.hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || aceLowRankValue(a.rank) - aceLowRankValue(b.rank));
  }

  private get canTake() { return (this.phase === 'upcard' || this.phase === 'draw') && !this.stockOnly && this.discard.length > 0; }

  private discardChoices(hand: readonly Card[], taken: Card | null) {
    return hand.filter((card) => !taken || !cardEquals(card, taken)).map((card) => ({
      card, deadwood: bestArrangement(without(hand, card)).deadwoodCount,
    }));
  }

  act(id: string, action: GinAction) {
    const seat = this.seats[this.active];
    if (seat.id !== id) throw new GameRuleError('Wait for your turn.');
    switch (action.type) {
      case 'pass-upcard':
        if (this.phase !== 'upcard') break;
        if (this.active === this.dealer) {
          this.stockOnly = true;
          this.phase = 'draw';
        }
        this.active = 1 - this.active;
        return;
      case 'take-discard':
        if (!this.canTake) break;
        this.taken = this.discard.pop()!;
        seat.hand.push(this.taken);
        seat.took.push(this.taken);
        this.sortHand(seat);
        this.phase = 'discard';
        return;
      case 'draw-stock':
        if (this.phase !== 'draw' || this.stock.length <= 2) break;
        this.stockOnly = false;
        this.taken = null;
        seat.hand.push(this.stock.pop()!);
        this.sortHand(seat);
        this.phase = 'discard';
        return;
      case 'discard':
      case 'knock': {
        if (this.phase !== 'discard') break;
        const card = seat.hand.find((held) => cardEquals(held, action.card));
        if (!card || (this.taken && cardEquals(card, this.taken))) break;
        const rest = without(seat.hand, card);
        if (action.type === 'knock' && bestArrangement(rest).deadwoodCount > this.limit) break;
        seat.hand = rest;
        this.taken = null;
        if (action.type === 'knock') this.knock();
        else {
          this.discard.push(card);
          if (this.stock.length === 2) {
            this.lastResult = { outcome: 'void', knockerId: null, winnerId: null, points: 0, knocker: null, defender: null };
            this.phase = 'hand-scoring';
          } else {
            this.active = 1 - this.active;
            this.phase = 'draw';
          }
        }
        return;
      }
      case 'big-gin':
        if (!this.options.bigGin || this.phase !== 'discard' || bestArrangement(seat.hand).deadwoodCount) break;
        this.knock();
        return;
    }
    throw new GameRuleError('That move is unavailable.');
  }

  private knock() {
    const seat = this.seats[this.active];
    const other = this.seats[1 - this.active];
    this.lastResult = scoreHand(seat.id, other.id, seat.hand, other.hand, this.options, this.doubled);
    const winner = this.lastResult.winnerId === seat.id ? seat : other;
    winner.score += this.lastResult.points;
    winner.handsWon++;
    this.phase = 'hand-scoring';
  }

  advanceReveal() {
    if (!this.revealing) return;
    const winner = this.seats.find((seat) => seat.score >= this.options.target);
    if (winner) {
      this.final = this.seats.map((seat) => {
        const box = this.options.boxBonus ? seat.handsWon * 20 : 0;
        const game = seat === winner ? this.seats.some((other) => other.score === 0) ? 200 : 100 : 0;
        return { id: seat.id, hand: seat.score, box, game, total: seat.score + box + game };
      });
      this.phase = 'game-over';
      return;
    }
    if (this.lastResult?.winnerId) this.dealer = this.seats.findIndex(({ id }) => id === this.lastResult?.winnerId);
    this.handNumber++;
    this.deal();
  }

  automaticMove(): (() => void) | undefined {
    const seat = this.seats[this.active];
    if ((!seat.bot && seat.connected) || this.revealing || this.gameOver ||
      (!this.seats.every((player) => player.bot) && !this.seats.some((player) => !player.bot && player.connected))) return;
    if (this.phase === 'discard') {
      if (this.options.bigGin && bestArrangement(seat.hand).deadwoodCount === 0) return () => this.act(seat.id, { type: 'big-gin' });
      const [best] = this.discardChoices(seat.hand, this.taken).sort((a, b) => a.deadwood - b.deadwood ||
        deadwoodValue(b.card) - deadwoodValue(a.card));
      return () => this.act(seat.id, { type: best.deadwood <= this.limit ? 'knock' : 'discard', card: best.card });
    }
    const top = this.discard.at(-1);
    if (this.canTake && top) {
      const best = Math.min(...this.discardChoices([...seat.hand, top], top).map(({ deadwood }) => deadwood));
      if (best < bestArrangement(seat.hand).deadwoodCount) return () => this.act(seat.id, { type: 'take-discard' });
    }
    return () => this.act(seat.id, { type: this.phase === 'upcard' ? 'pass-upcard' : 'draw-stock' });
  }

  view(id?: string): GinView {
    const viewer = this.seats.find((seat) => seat.id === id);
    const opponent = viewer ? this.seats.find((seat) => seat !== viewer) : undefined;
    const acting = viewer === this.seats[this.active] && !this.revealing && !this.gameOver;
    const myHand = viewer?.hand.map((card) => ({ ...card })) ?? [];
    const arrangement = bestArrangement(myHand);
    const choices = acting && this.phase === 'discard' ? this.discardChoices(myHand, this.taken) : [];
    const top = this.discard.at(-1);
    return {
      phase: this.phase, handNumber: this.handNumber, target: this.options.target, knockLimit: this.limit, doubled: this.doubled,
      dealerId: this.seats[this.dealer].id, activePlayerId: this.revealing || this.gameOver ? null : this.seats[this.active].id,
      players: this.seats.map(({ id, name, bot, connected, hand, score, handsWon }) => ({ id, name, bot, connected, cardCount: hand.length, score, handsWon })),
      stockCount: this.stock.length, discardTop: top ? { ...top } : null, discardCount: this.discard.length,
      myHand, myMelds: arrangement.melds, myDeadwood: arrangement.deadwoodCount,
      canTakeDiscard: acting && this.canTake, canDrawStock: acting && this.phase === 'draw',
      canPassUpcard: acting && this.phase === 'upcard',
      discardable: choices.map(({ card }) => card), knockable: choices.filter(({ deadwood }) => deadwood <= this.limit).map(({ card }) => card),
      canBigGin: acting && this.phase === 'discard' && this.options.bigGin && arrangement.deadwoodCount === 0,
      opponentTook: opponent?.took.map((card) => ({ ...card })) ?? [],
      lastResult: this.lastResult ? structuredClone(this.lastResult) : null,
      final: this.final?.map((entry) => ({ ...entry })) ?? null,
      winnerIds: this.gameOver ? this.seats.filter(({ score }) => score >= this.options.target).map(({ id }) => id) : [],
    };
  }
}
