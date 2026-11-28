import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { deck, faces, guessPoints, rounds, type Seal } from './rules.js';
import type { CipherAction, CipherView, Guess } from './types.js';

interface Seat {
  id: string; name: string; bot: boolean; connected: boolean; score: number;
  hand: Seal[]; exposed: Seal | null; sent: CipherView['sent']; choice: number | null; guess: Guess | null;
}

export class CipherPostEngine {
  private readonly seats: Seat[];
  private phase: CipherView['phase'] = 'pass';
  private round = 1;
  private results: CipherView['results'] = [];

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[], private readonly random: RandomInt = secureRandomInt) {
    this.seats = players.map((player) => ({
      ...player, connected: true, score: 0, hand: [], exposed: null, sent: null, choice: null, guess: null,
    }));
    this.deal();
  }

  get revealing() { return this.phase === 'reveal'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    const cards = fisherYatesShuffle(deck(), this.random);
    for (const seat of this.seats) {
      seat.hand = cards.splice(0, 2);
      seat.exposed = null;
      seat.sent = null;
      seat.choice = null;
      seat.guess = null;
    }
    this.results = [];
    this.phase = 'pass';
  }

  private recipient(seat: Seat) {
    const direction = this.round % 2 ? 1 : -1;
    return this.seats[(this.seats.indexOf(seat) + direction + this.seats.length) % this.seats.length];
  }

  private ready(seat: Seat) {
    return this.phase === 'guess' ? !!seat.guess : seat.choice !== null;
  }

  act(id: string, action: CipherAction) {
    const seat = this.seats.find((player) => player.id === id);
    if (!seat || action.round !== this.round || this.phase !== action.type || this.ready(seat)) {
      throw new GameRuleError('That choice is unavailable.');
    }
    if (action.type === 'guess') {
      if (!faces.includes(action.face) || !this.seats.some((player) => player !== seat && player.id === action.target)) {
        throw new GameRuleError('Choose a rival and a seal value.');
      }
      seat.guess = { target: action.target, face: action.face };
    } else {
      if (!seat.hand.some(({ id }) => id === action.sealId)) throw new GameRuleError('Choose one of your seals.');
      seat.choice = action.sealId;
    }
    if (!this.seats.every((player) => this.ready(player))) return;
    if (this.phase === 'pass') this.passSeals();
    else if (this.phase === 'expose') this.exposeSeals();
    else this.reveal();
  }

  private takeChoice(seat: Seat) {
    const index = seat.hand.findIndex(({ id }) => id === seat.choice);
    seat.choice = null;
    return seat.hand.splice(index, 1)[0];
  }

  private passSeals() {
    const letters = this.seats.map((seat) => ({ from: seat, to: this.recipient(seat), seal: this.takeChoice(seat) }));
    for (const { from, to, seal } of letters) {
      from.sent = { face: seal.face, to: to.id };
      to.hand.push(seal);
    }
    this.phase = 'expose';
  }

  private exposeSeals() {
    for (const seat of this.seats) seat.exposed = this.takeChoice(seat);
    this.phase = 'guess';
  }

  private reveal() {
    this.results = this.seats.map((seat) => {
      const guess = seat.guess!;
      const sealed = seat.hand[0].face;
      const target = this.seats.find(({ id }) => id === guess.target)!;
      const right = target.hand[0].face === guess.face;
      const guessed = this.seats.some((player) => player.guess?.target === seat.id && player.guess.face === sealed);
      const points = (guessed ? 0 : sealed) + (right ? guessPoints : 0);
      seat.score += points;
      return { id: seat.id, sealed, guess: { ...guess }, right, guessed, points };
    });
    this.phase = 'reveal';
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.round === rounds) this.phase = 'game-over';
    else {
      this.round++;
      this.deal();
    }
  }

  automaticMove(): (() => void) | undefined {
    if (this.revealing || this.gameOver ||
      (!this.seats.every((seat) => seat.bot) && !this.seats.some((seat) => seat.connected && !seat.bot))) return;
    const seat = this.seats.find((player) => (player.bot || !player.connected) && !this.ready(player));
    if (!seat) return;
    if (this.phase === 'pass') {
      const [seal] = [...seat.hand].sort((a, b) => a.face - b.face);
      return () => this.act(seat.id, { type: 'pass', round: this.round, sealId: seal.id });
    }
    if (this.phase === 'expose') {
      const received = seat.hand[1];
      const own = seat.hand[0];
      const seal = own.face >= received.face - 1 ? received : own;
      return () => this.act(seat.id, { type: 'expose', round: this.round, sealId: seal.id });
    }
    const recipient = this.recipient(seat);
    const sent = seat.sent!;
    return () => {
      const face = recipient.exposed?.face !== sent.face ? sent.face : faces[3 + this.random(3)];
      this.act(seat.id, { type: 'guess', round: this.round, target: recipient.id, face });
    };
  }

  view(id?: string): CipherView {
    const me = this.seats.find((seat) => seat.id === id);
    const best = Math.max(...this.seats.map(({ score }) => score));
    return {
      phase: this.phase, round: this.round,
      players: this.seats.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, score: seat.score,
        exposed: seat.exposed?.face ?? null, ready: this.ready(seat),
      })),
      hand: me?.hand.map((seal) => ({ ...seal })) ?? [],
      sent: me?.sent ? { ...me.sent } : null,
      sentTo: me ? this.recipient(me).id : null,
      choice: me?.choice ?? null,
      myGuess: me?.guess ? { ...me.guess } : null,
      results: this.results.map((result) => ({ ...result, guess: { ...result.guess } })),
      winnerIds: this.gameOver ? this.seats.filter(({ score }) => score === best).map(({ id }) => id) : [],
    };
  }
}
