import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { antennas, deck, fits, levels, roundMs, type Signal } from './rules.js';
import type { RelayAction, RelayView } from './types.js';

interface Seat { id: string; name: string; bot: boolean; connected: boolean; hand: Signal[] }

export class SignalRelayEngine {
  private readonly players: Seat[];
  private phase: RelayView['phase'] = 'playing';
  private level = 1;
  private endsAt: number | null = null;
  private antennaState: RelayView['antennas'] = [];
  private rerouteAvailable = true;
  private last: RelayView['last'] = null;
  private won = false;

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt, private readonly now: () => number = Date.now) {
    this.players = players.map((player) => ({ ...player, connected: true, hand: [] }));
    this.deal();
  }

  get revealing() { return this.phase === 'clear'; }
  get gameOver() { return this.phase === 'game-over'; }
  get deadline() { return this.endsAt; }

  setConnected(id: string, connected: boolean) {
    const seat = this.players.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    const signals = fisherYatesShuffle(deck(), this.random);
    const first = signals.shift()!;
    const [second] = signals.splice(signals.findIndex(({ channel }) => channel !== first.channel), 1);
    this.antennaState = [first, second].map((signal) => ({ signal, version: 0 }));
    for (const seat of this.players) {
      seat.hand = signals.splice(0, this.level + 1)
        .sort((a, b) => a.id - b.id);
    }
    this.rerouteAvailable = true;
    this.last = null;
    this.endsAt = this.now() + roundMs;
    this.phase = 'playing';
  }

  act(id: string, action: RelayAction) {
    this.apply(id, action, this.now());
  }

  private apply(id: string, action: RelayAction, now: number) {
    if (this.phase !== 'playing' || action.level !== this.level || this.endsAt === null || now >= this.endsAt) {
      throw new GameRuleError('This relay has ended.');
    }
    const seat = this.players.find((player) => player.id === id);
    const signal = seat?.hand.find(({ id }) => id === action.signal);
    const antenna = this.antennaState[action.antenna];
    if (!seat || !signal || !antenna || action.version !== antenna.version) {
      throw new GameRuleError('The antenna changed. Choose a current transmission.');
    }
    const rerouted = action.type === 'reroute';
    if (rerouted ? !this.rerouteAvailable : !fits(signal, antenna.signal)) {
      throw new GameRuleError(rerouted ? 'The team already used its reroute.' : 'That signal does not fit this antenna.');
    }
    if (rerouted) this.rerouteAvailable = false;
    seat.hand = seat.hand.filter((card) => card !== signal);
    antenna.signal = signal;
    antenna.version++;
    this.last = { playerId: seat.id, signal, antenna: action.antenna, rerouted };
    if (this.players.every(({ hand }) => !hand.length)) {
      this.phase = 'clear';
      this.endsAt = null;
    }
  }

  expire() {
    if (this.phase !== 'playing' || this.endsAt === null || this.now() < this.endsAt) return false;
    this.phase = 'game-over';
    this.endsAt = null;
    return true;
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.level === levels) {
      this.won = true;
      this.phase = 'game-over';
    } else {
      this.level++;
      this.deal();
    }
  }

  automaticMove(): (() => void) | undefined {
    const now = this.now();
    if (this.phase !== 'playing' || this.endsAt === null || now >= this.endsAt ||
      (!this.players.every((seat) => seat.bot) && !this.players.some((seat) => seat.connected && !seat.bot))) return;
    for (const seat of this.players) {
      if (!seat.bot && seat.connected) continue;
      for (const antenna of antennas) {
        const current = this.antennaState[antenna];
        const card = seat.hand.find((signal) => fits(signal, current.signal));
        if (card) return () => this.apply(seat.id, {
          type: 'send', level: this.level, signal: card.id, antenna, version: current.version,
        }, now);
      }
    }
    const allWaiting = this.players.every(({ bot, connected, hand }) => bot || !connected || !hand.length);
    const seat = this.players.find(({ bot, connected, hand }) => (bot || !connected) && hand.length);
    if (allWaiting && this.rerouteAvailable && seat) {
      return () => this.apply(seat.id, {
        type: 'reroute', level: this.level, signal: seat.hand[0].id, antenna: 0, version: this.antennaState[0].version,
      }, now);
    }
  }

  view(id?: string): RelayView {
    const me = this.players.find((player) => player.id === id);
    return {
      phase: this.phase, level: this.level, deadline: this.endsAt,
      players: this.players.map(({ id, name, bot, connected, hand }) => ({ id, name, bot, connected, remaining: hand.length })),
      hand: me?.hand.map((card) => ({ ...card })) ?? [],
      antennas: this.antennaState.map(({ signal, version }) => ({ signal: { ...signal }, version })),
      rerouteAvailable: this.rerouteAvailable, won: this.won,
      last: this.last && { ...this.last, signal: { ...this.last.signal } },
    };
  }
}
