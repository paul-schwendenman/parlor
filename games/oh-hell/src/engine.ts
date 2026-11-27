import { aceHighRankValue, cardEquals, createDeck, type Card, type Suit } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { ohHellMeta } from './meta.js';
import type { OhHellAction, OhHellPhase, OhHellView, TrickPlay } from './types.js';

const HAND_SIZES = [1, 2, 3, 4, 5, 4, 3, 2, 1];

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  hand: Card[];
  bid: number | null;
  tricks: number;
  score: number;
  roundPoints: number | null;
}

function beats(card: Card, winner: Card, trump: Suit): boolean {
  return card.suit === winner.suit
    ? aceHighRankValue(card.rank) > aceHighRankValue(winner.rank)
    : card.suit === trump;
}

export class OhHellEngine {
  private readonly seats: Seat[];
  private round = 0;
  private dealer = 0;
  private active = 0;
  private phase: OhHellPhase = 'bidding';
  private trumpCard: Card;
  private trick: TrickPlay[] = [];
  private trickWinnerId: string | null = null;

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[], private readonly randomInt: RandomInt = secureRandomInt) {
    if (players.length < ohHellMeta.minPlayers || players.length > ohHellMeta.maxPlayers) {
      throw new GameRuleError('Oh Hell requires three to six players.');
    }
    this.seats = players.map((player) => ({
      ...player, connected: true, hand: [], bid: null, tricks: 0, score: 0, roundPoints: null,
    }));
    this.trumpCard = this.deal();
  }

  get currentPhase(): OhHellPhase { return this.phase; }

  setConnected(id: string, connected: boolean): void {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  act(id: string, action: OhHellAction): void {
    const seat = this.seats[this.active];
    const phase = action.type === 'bid' ? 'bidding' : 'playing';
    if (seat.id !== id || this.phase !== phase) throw new GameRuleError('That action is unavailable now.');

    if (action.type === 'bid') {
      if (!this.legalBids().includes(action.tricks)) throw new GameRuleError('Choose an available bid.');
      seat.bid = action.tricks;
      if (this.active === this.dealer) this.phase = 'playing';
      this.active = this.next(this.active);
      return;
    }

    const choice = this.legalCards(seat).find((card) => cardEquals(card, action.card));
    if (!choice) throw new GameRuleError('That card cannot be played on this trick.');
    seat.hand.splice(seat.hand.indexOf(choice), 1);
    this.trick.push({ playerId: id, card: choice });
    if (this.trick.length < this.seats.length) {
      this.active = this.next(this.active);
      return;
    }

    const winner = this.trick.reduce((best, play) => beats(play.card, best.card, this.trumpCard.suit) ? play : best);
    this.active = this.seats.findIndex((player) => player.id === winner.playerId);
    this.seats[this.active].tricks++;
    this.trickWinnerId = winner.playerId;
    this.phase = 'trick-won';
  }

  advanceReveal(): void {
    if (this.phase === 'trick-won') {
      if (this.seats[this.active].hand.length) {
        this.trick = [];
        this.trickWinnerId = null;
        this.phase = 'playing';
        return;
      }
      for (const seat of this.seats) {
        seat.roundPoints = seat.bid === seat.tricks ? 10 + seat.tricks : 0;
        seat.score += seat.roundPoints;
      }
      this.phase = 'round-scoring';
    } else if (this.phase === 'round-scoring') {
      if (this.round === HAND_SIZES.length - 1) {
        this.phase = 'game-over';
      } else {
        this.round++;
        this.dealer = this.next(this.dealer);
        this.trumpCard = this.deal();
      }
    }
  }

  automaticAction(): { id: string; action: OhHellAction } | null {
    const seat = this.seats[this.active];
    if (!seat.bot && seat.connected) return null;
    if (this.phase === 'bidding') {
      const estimated = seat.hand.filter((card) =>
        card.suit === this.trumpCard.suit || aceHighRankValue(card.rank) >= 13,
      ).length;
      const tricks = this.legalBids().reduce((best, bid) =>
        Math.abs(bid - estimated) < Math.abs(best - estimated) ? bid : best,
      );
      return { id: seat.id, action: { type: 'bid', tricks } };
    }
    if (this.phase !== 'playing') return null;
    const cards = this.legalCards(seat).sort((a, b) => this.strength(a) - this.strength(b));
    const winner = this.trick.reduce<TrickPlay | undefined>((best, play) =>
      !best || beats(play.card, best.card, this.trumpCard.suit) ? play : best, undefined,
    );
    const wantsTrick = seat.tricks < (seat.bid ?? 0);
    let card = cards[0];
    if (winner) {
      const canBeat = (option: Card) => beats(option, winner.card, this.trumpCard.suit);
      const preferred = wantsTrick
        ? cards.find(canBeat)
        : cards.filter((option) => !canBeat(option)).at(-1);
      card = preferred ?? card;
    } else if (wantsTrick) {
      card = cards[cards.length - 1];
    }
    return { id: seat.id, action: { type: 'play-card', card } };
  }

  view(id?: string): OhHellView {
    const seat = this.seats.find((player) => player.id === id);
    const active = this.phase === 'bidding' || this.phase === 'playing' ? this.seats[this.active] : null;
    const highScore = Math.max(...this.seats.map((player) => player.score));
    return {
      phase: this.phase,
      round: this.round + 1,
      rounds: HAND_SIZES.length,
      handSize: HAND_SIZES[this.round],
      dealerId: this.seats[this.dealer].id,
      activePlayerId: active?.id ?? null,
      trumpCard: this.trumpCard,
      trick: [...this.trick],
      trickWinnerId: this.trickWinnerId,
      players: this.seats.map(({ id, name, bot, connected, bid, tricks, score, roundPoints }) => ({ id, name, bot, connected, bid, tricks, score, roundPoints })),
      winnerIds: this.phase === 'game-over'
        ? this.seats.filter((player) => player.score === highScore).map((player) => player.id)
        : [],
      myHand: seat ? [...seat.hand] : [],
      playableCards: seat && seat === active && this.phase === 'playing' ? this.legalCards(seat) : [],
      legalBids: seat && seat === active && this.phase === 'bidding' ? this.legalBids() : [],
    };
  }

  private deal(): Card {
    const deck = fisherYatesShuffle(createDeck(), this.randomInt);
    const size = HAND_SIZES[this.round];
    for (const [index, seat] of this.seats.entries()) {
      seat.hand = deck.slice(index * size, (index + 1) * size);
      seat.bid = null;
      seat.tricks = 0;
      seat.roundPoints = null;
    }
    this.active = this.next(this.dealer);
    this.trick = [];
    this.trickWinnerId = null;
    this.phase = 'bidding';
    return deck[this.seats.length * size];
  }

  private next(index: number): number {
    return (index + 1) % this.seats.length;
  }

  private legalBids(): number[] {
    const size = HAND_SIZES[this.round];
    const total = this.seats.reduce((sum, seat) => sum + (seat.bid ?? 0), 0);
    return Array.from({ length: size + 1 }, (_, bid) => bid)
      .filter((bid) => this.active !== this.dealer || total + bid !== size);
  }

  private legalCards(seat: Seat): Card[] {
    const following = seat.hand.filter((card) => card.suit === this.trick[0]?.card.suit);
    return following.length ? following : [...seat.hand];
  }

  private strength(card: Card): number {
    return aceHighRankValue(card.rank) + (card.suit === this.trumpCard.suit ? 13 : 0);
  }
}
