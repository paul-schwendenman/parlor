import { aceHighRankValue, cardEquals, createDeck, SUITS, type Card, type Suit } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { beats, effectiveSuit, legalCards, scoreRound, trumpRank, winningPlay } from './rules.js';
import type { EuchreAction, EuchrePhase, EuchreView, RoundResult, Team, TrickPlay } from './types.js';

const SEATS = 4;
const HAND_SIZE = 5;

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  team: Team;
  hand: Card[];
}

export class EuchreEngine {
  private readonly seats: Seat[];
  private readonly teams: [number, number] = [0, 0];
  private tricks: [number, number] = [0, 0];
  private phase: EuchrePhase = 'order-up';
  private dealer = -1;
  private active = 0;
  private round = 0;
  private trickNumber = 1;
  private trump: Suit | null = null;
  private maker: number | null = null;
  private loner: number | null = null;
  private upCard: Card;
  private trick: TrickPlay[] = [];
  private trickWinnerId: string | null = null;
  private result: RoundResult | null = null;
  private winningTeam: Team | null = null;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly randomInt: RandomInt = secureRandomInt,
    private readonly goal = 10,
  ) {
    if (players.length !== SEATS) throw new GameRuleError('Euchre requires four players.');
    this.seats = players.map((player, index) => ({
      ...player, team: index % 2 === 0 ? 0 : 1, connected: true, hand: [],
    }));
    this.upCard = this.deal();
  }

  get currentPhase(): EuchrePhase { return this.phase; }

  private get sittingOut(): number | null {
    return this.loner === null ? null : (this.loner + 2) % SEATS;
  }

  setConnected(id: string, connected: boolean): void {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  pass(id: string): void {
    this.assertTurn(id, 'order-up', 'name-trump');
    if (this.phase === 'name-trump' && this.active === this.dealer) {
      throw new GameRuleError('The dealer must name trump.');
    }
    if (this.active === this.dealer) this.phase = 'name-trump';
    this.active = this.next(this.active);
  }

  orderUp(id: string, alone: boolean): void {
    this.assertTurn(id, 'order-up');
    this.callTrump(this.upCard.suit, alone);
    this.seats[this.dealer].hand.push(this.upCard);
    this.active = this.dealer;
    this.phase = 'discard';
  }

  nameTrump(id: string, suit: Suit, alone: boolean): void {
    this.assertTurn(id, 'name-trump');
    if (suit === this.upCard.suit) throw new GameRuleError('Name a suit different from the turned-down card.');
    this.callTrump(suit, alone);
    this.openPlay();
  }

  discard(id: string, card: Card): void {
    const seat = this.assertTurn(id, 'discard');
    const index = seat.hand.findIndex((choice) => cardEquals(card, choice));
    if (index < 0) throw new GameRuleError('Choose a card from your hand.');
    seat.hand.splice(index, 1);
    this.openPlay();
  }

  playCard(id: string, card: Card): void {
    const seat = this.assertTurn(id, 'playing');
    const trump = this.requireTrump();
    const choice = legalCards(seat.hand, this.trick[0]?.card, trump).find((candidate) => cardEquals(candidate, card));
    if (!choice) throw new GameRuleError('That card cannot be played on this trick.');
    seat.hand.splice(seat.hand.indexOf(choice), 1);
    const play = { playerId: id, card: choice };
    this.trick.push(play);
    if (this.trick.length !== (this.sittingOut === null ? 4 : 3)) {
      this.active = this.nextPlaying(this.active);
      return;
    }
    const [first, ...rest] = this.trick;
    const winner = winningPlay([first, ...rest], trump);
    this.active = this.seats.findIndex((player) => player.id === winner.playerId);
    this.tricks[this.seats[this.active].team]++;
    this.trickWinnerId = winner.playerId;
    this.phase = 'trick-won';
  }

  advanceReveal(): void {
    if (this.phase === 'round-scoring') {
      this.upCard = this.deal();
    } else if (this.phase === 'trick-won' && this.trickNumber === HAND_SIZE) {
      if (this.maker === null) throw new Error('Expected a maker');
      const makers = this.seats[this.maker].team;
      const result = scoreRound(makers, this.tricks[makers], this.loner !== null);
      this.result = result;
      this.teams[result.team] += result.points;
      if (this.teams[result.team] >= this.goal) {
        this.winningTeam = result.team;
        this.phase = 'game-over';
      } else {
        this.phase = 'round-scoring';
      }
    } else if (this.phase === 'trick-won') {
      this.trickNumber++;
      this.trick = [];
      this.trickWinnerId = null;
      this.phase = 'playing';
    }
  }

  automaticAction(): { id: string; action: EuchreAction } | undefined {
    const seat = this.seats[this.active];
    if ((seat.connected && !seat.bot) || !this.seats.some((player) => player.connected && !player.bot)) return;
    const action = this.chooseAction(seat);
    if (action) return { id: seat.id, action };
  }

  private chooseAction(seat: Seat): EuchreAction | undefined {
    const evaluate = (suit: Suit) => seat.hand.reduce((sum, card) => {
      const rank = trumpRank(card, suit);
      if (effectiveSuit(card, suit) === suit) return sum + (rank >= 15 ? 1.2 : rank >= 13 ? 0.85 : 0.55);
      return sum + (rank === 14 ? 0.55 : 0);
    }, 0);

    if (this.phase === 'order-up') {
      const value = evaluate(this.upCard.suit);
      const friendlyDealer = this.seats[this.dealer].team === seat.team;
      return value >= (friendlyDealer ? 2.5 : 3.15)
        ? { type: 'order-up', alone: value >= 4.55 }
        : { type: 'pass' };
    }
    if (this.phase === 'name-trump') {
      const suits = SUITS.filter((suit) => suit !== this.upCard.suit);
      const [suit] = suits.sort((a, b) => evaluate(b) - evaluate(a));
      const value = evaluate(suit);
      return this.active === this.dealer || value >= 2.7
        ? { type: 'name-trump', suit, alone: value >= 4.55 }
        : { type: 'pass' };
    }
    if (this.phase !== 'discard' && this.phase !== 'playing') return;

    const trump = this.requireTrump();
    const strength = (card: Card) => trumpRank(card, trump) + (effectiveSuit(card, trump) === trump ? 16 : 0);
    if (this.phase === 'discard') {
      const [card] = [...seat.hand].sort((a, b) => strength(a) - strength(b));
      return { type: 'discard', card };
    }
    const [first, ...rest] = this.trick;
    const cards = legalCards(seat.hand, first?.card, trump).sort((a, b) => strength(a) - strength(b));
    if (!first) return { type: 'play-card', card: cards.at(-1) ?? cards[0] };
    const winner = winningPlay([first, ...rest], trump);
    const partnerWinning = winner.playerId === this.seats[(this.active + 2) % SEATS].id;
    const card = partnerWinning ? cards[0] : cards.find((candidate) => beats(candidate, winner.card, trump)) ?? cards[0];
    return { type: 'play-card', card };
  }

  view(id?: string): EuchreView {
    const seat = this.seats.find((player) => player.id === id);
    const acting = this.phase === 'order-up' || this.phase === 'name-trump' ||
      this.phase === 'discard' || this.phase === 'playing';
    return {
      phase: this.phase, round: this.round, trickNumber: this.trickNumber, trump: this.trump, goal: this.goal,
      dealerId: this.seats[this.dealer].id,
      activePlayerId: acting ? this.seats[this.active].id : null,
      players: this.seats.map(({ id: playerId, name, bot, connected, team }, index) => ({
        id: playerId, name, bot, connected, team, sittingOut: index === this.sittingOut,
      })),
      teams: [...this.teams],
      tricks: [...this.tricks],
      makerId: this.maker === null ? null : this.seats[this.maker].id,
      lonerId: this.loner === null ? null : this.seats[this.loner].id,
      upCard: this.phase === 'order-up' || this.phase === 'discard' ? this.upCard : null,
      turnedSuit: this.upCard.suit,
      trick: [...this.trick], trickWinnerId: this.trickWinnerId, result: this.result, winningTeam: this.winningTeam,
      myHand: seat ? [...seat.hand] : [],
      playableCards: seat && seat === this.seats[this.active] && this.phase === 'playing'
        ? legalCards(seat.hand, this.trick[0]?.card, this.requireTrump())
        : [],
      canPass: !!seat && seat === this.seats[this.active] &&
        (this.phase === 'order-up' || (this.phase === 'name-trump' && this.active !== this.dealer)),
    };
  }

  private deal(): Card {
    this.round++;
    this.dealer = this.next(this.dealer);
    this.active = this.next(this.dealer);
    this.phase = 'order-up';
    this.trump = null;
    this.maker = null;
    this.loner = null;
    this.trick = [];
    this.trickNumber = 1;
    this.tricks = [0, 0];
    this.trickWinnerId = null;
    this.result = null;
    const deck = fisherYatesShuffle(createDeck().filter((card) => aceHighRankValue(card.rank) >= 9), this.randomInt);
    for (const [index, seat] of this.seats.entries()) {
      seat.hand = deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE);
    }
    return deck[SEATS * HAND_SIZE];
  }

  private next(index: number): number { return (index + 1) % SEATS; }

  private nextPlaying(index: number): number {
    const next = this.next(index);
    return next === this.sittingOut ? this.next(next) : next;
  }

  private callTrump(suit: Suit, alone: boolean): void {
    this.trump = suit;
    this.maker = this.active;
    this.loner = alone ? this.active : null;
  }

  private openPlay(): void {
    this.active = this.nextPlaying(this.sittingOut ?? this.dealer);
    this.phase = 'playing';
  }

  private assertTurn(id: string, ...phases: EuchrePhase[]): Seat {
    const seat = this.seats[this.active];
    if (seat.id !== id || !phases.includes(this.phase)) throw new GameRuleError('It is not your turn.', 'NOT_YOUR_TURN');
    return seat;
  }

  private requireTrump(): Suit {
    if (!this.trump) throw new Error('Expected trump to be set');
    return this.trump;
  }
}
