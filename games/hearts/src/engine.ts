import { aceHighRankValue, cardEquals, createDeck, SUITS, type Card } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { legalCards, OPENING_CARD, PASS_OFFSET, penalty, winningPlay } from './rules.js';
import type { HeartsPhase, HeartsView, PassDirection, TrickPlay } from './types.js';

const PASS_SEQUENCE: readonly PassDirection[] = ['left', 'right', 'across', 'hold'];
const HAND_SIZE = 13;

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  hand: Card[];
  pass: Card[];
  received: Card[];
  roundScore: number;
  totalScore: number;
}

export class HeartsEngine {
  private readonly seats: Seat[];
  private phase: HeartsPhase = 'passing';
  private round = 0;
  private trickNumber = 1;
  private active = 0;
  private trick: TrickPlay[] = [];
  private heartsBroken = false;
  private trickWinnerId: string | null = null;
  private moonShooterId: string | null = null;
  private winnerIds: string[] = [];

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly randomInt: RandomInt = secureRandomInt,
    private readonly goal = 100,
  ) {
    if (players.length !== 4) throw new GameRuleError('Hearts requires four players.');
    this.seats = players.map((player) => ({
      ...player, connected: true, hand: [], pass: [], received: [], roundScore: 0, totalScore: 0,
    }));
    this.deal();
  }

  get currentPhase(): HeartsPhase {
    return this.phase;
  }

  private get direction(): PassDirection {
    return PASS_SEQUENCE[(this.round - 1) % PASS_SEQUENCE.length];
  }

  setConnected(id: string, connected: boolean): void {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  passCards(id: string, cards: Card[]): void {
    const seat = this.seats.find((player) => player.id === id);
    if (this.phase !== 'passing' || !seat || seat.pass.length) {
      throw new GameRuleError('You cannot pass cards right now.');
    }
    const selected = seat.hand.filter((card) => cards.some((choice) => cardEquals(card, choice)));
    if (selected.length !== 3 || cards.length !== 3) {
      throw new GameRuleError('Choose three different cards from your hand.');
    }

    seat.pass = selected;
    if (this.seats.some((player) => !player.pass.length)) return;

    for (const [index, player] of this.seats.entries()) {
      player.hand = player.hand.filter((card) => !player.pass.includes(card));
      this.seats[(index + PASS_OFFSET[this.direction]) % this.seats.length].received = player.pass;
    }
    for (const player of this.seats) {
      player.hand.push(...player.received);
      this.sortHand(player.hand);
    }
    this.openPlay();
  }

  playCard(id: string, card: Card): void {
    const seat = this.seats[this.active];
    if (this.phase !== 'playing' || seat.id !== id) {
      throw new GameRuleError('It is not your turn to play.', 'NOT_YOUR_TURN');
    }
    const choice = this.playable().find((candidate) => cardEquals(candidate, card));
    if (!choice) throw new GameRuleError('That card cannot be played on this trick.');

    seat.hand.splice(seat.hand.indexOf(choice), 1);
    this.trick.push({ playerId: id, card: choice });
    if (choice.suit === 'hearts') this.heartsBroken = true;
    if (this.trick.length < this.seats.length) {
      this.active = (this.active + 1) % this.seats.length;
      return;
    }

    const [first, ...rest] = this.trick;
    const winner = winningPlay([first, ...rest]);
    this.active = this.seats.findIndex((player) => player.id === winner.playerId);
    this.seats[this.active].roundScore += this.trick.reduce((total, play) => total + penalty(play.card), 0);
    this.trickWinnerId = winner.playerId;
    this.phase = 'trick-won';
  }

  advanceReveal(): void {
    if (this.phase === 'round-scoring') {
      this.deal();
      return;
    }
    if (this.phase !== 'trick-won') return;
    if (this.trickNumber === HAND_SIZE) {
      this.scoreRound();
      return;
    }
    this.trickNumber++;
    this.trick = [];
    this.trickWinnerId = null;
    this.phase = 'playing';
  }

  /** Return a stand-in move, if one is needed and the table still has a human. */
  automaticMove(): (() => void) | undefined {
    if (!this.seats.some((seat) => seat.connected && !seat.bot)) return;
    const automated = (seat: Seat) => seat.bot || !seat.connected;
    if (this.phase === 'passing') {
      const seat = this.seats.find((player) => automated(player) && !player.pass.length);
      if (seat) {
        const risk = (card: Card) => penalty(card) * 14 + aceHighRankValue(card.rank);
        return () => this.passCards(seat.id, [...seat.hand].sort((a, b) => risk(b) - risk(a)).slice(0, 3));
      }
    }
    if (this.phase === 'playing' && automated(this.seats[this.active])) {
      const { id } = this.seats[this.active];
      return () => {
        const ledSuit = this.trick[0]?.card.suit;
        const risk = (card: Card) => ledSuit && card.suit !== ledSuit
          ? penalty(card) * 14 + aceHighRankValue(card.rank)
          : -aceHighRankValue(card.rank);
        const card = [...this.playable()].sort((a, b) => risk(b) - risk(a))[0];
        this.playCard(id, card);
      };
    }
  }

  view(id?: string): HeartsView {
    const seat = this.seats.find((player) => player.id === id);
    const activePlayerId = this.phase === 'playing' ? this.seats[this.active].id : null;
    return {
      phase: this.phase,
      round: this.round,
      trickNumber: this.trickNumber,
      passDirection: this.direction,
      goal: this.goal,
      heartsBroken: this.heartsBroken,
      players: this.seats.map((player) => ({
        id: player.id,
        name: player.name,
        bot: player.bot,
        connected: player.connected,
        cardCount: player.hand.length,
        passed: player.pass.length > 0,
        roundScore: player.roundScore,
        totalScore: player.totalScore,
      })),
      activePlayerId,
      trick: [...this.trick],
      trickWinnerId: this.trickWinnerId,
      moonShooterId: this.moonShooterId,
      winnerIds: [...this.winnerIds],
      myHand: seat ? [...seat.hand] : [],
      receivedCards: seat ? [...seat.received] : [],
      playableCards: seat && activePlayerId === seat.id ? [...this.playable()] : [],
      canPass: this.phase === 'passing' && !!seat && seat.pass.length === 0,
    };
  }

  private deal(): void {
    this.round++;
    this.trickNumber = 1;
    this.trick = [];
    this.heartsBroken = false;
    this.trickWinnerId = null;
    this.moonShooterId = null;
    const deck = fisherYatesShuffle(createDeck(), this.randomInt);
    for (const [index, seat] of this.seats.entries()) {
      seat.hand = deck.slice(index * HAND_SIZE, (index + 1) * HAND_SIZE);
      this.sortHand(seat.hand);
      seat.pass = [];
      seat.received = [];
      seat.roundScore = 0;
    }
    if (this.direction === 'hold') this.openPlay();
    else this.phase = 'passing';
  }

  private sortHand(hand: Card[]): void {
    hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) ||
      aceHighRankValue(a.rank) - aceHighRankValue(b.rank));
  }

  private openPlay(): void {
    this.active = this.seats.findIndex((seat) => seat.hand.some((card) => cardEquals(card, OPENING_CARD)));
    this.phase = 'playing';
  }

  private playable(): Card[] {
    return legalCards(this.seats[this.active].hand, this.trick[0]?.card, this.trickNumber === 1, this.heartsBroken);
  }

  private scoreRound(): void {
    const moonShooter = this.seats.find((seat) => seat.roundScore === 26);
    this.moonShooterId = moonShooter?.id ?? null;
    for (const seat of this.seats) {
      if (moonShooter) seat.roundScore = seat === moonShooter ? 0 : 26;
      seat.totalScore += seat.roundScore;
    }
    if (this.seats.some((seat) => seat.totalScore >= this.goal)) {
      const lowest = Math.min(...this.seats.map((seat) => seat.totalScore));
      this.winnerIds = this.seats.filter((seat) => seat.totalScore === lowest).map((seat) => seat.id);
      this.phase = 'game-over';
    } else {
      this.phase = 'round-scoring';
    }
  }
}
