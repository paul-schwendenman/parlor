import { GameRuleError } from '@parlor/multiplayer';
import { secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { challengeMs, goal, maxRounds, permitIds, permits, type Permit } from './rules.js';
import type { CouncilAction, CouncilView } from './types.js';

interface Seat { id: string; name: string; bot: boolean; connected: boolean; coins: number; standing: number }

export class CouncilLedgerEngine {
  private readonly seats: Seat[];
  private active: number;
  private permit: Permit;
  private phase: CouncilView['phase'] = 'proposal';
  private turn = 1;
  private claim: Permit | null = null;
  private endsAt: number | null = null;
  private responses = new Map<string, boolean>();
  private outcome: CouncilView['outcome'] = null;

  constructor(players: Pick<Seat, 'id' | 'name' | 'bot'>[], private readonly random: RandomInt = secureRandomInt,
    private readonly now: () => number = Date.now) {
    this.seats = players.map((player) => ({ ...player, connected: true, coins: 3, standing: 0 }));
    this.active = random(players.length);
    this.permit = permitIds[random(permitIds.length)];
  }

  private get player() { return this.seats[this.active]; }
  get revealing() { return this.phase === 'reveal'; }
  get gameOver() { return this.phase === 'game-over'; }
  get deadline() { return this.endsAt; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private mayRespond(seat: Seat) {
    return this.phase === 'response' && this.player !== seat && seat.coins > 0 && !this.responses.has(seat.id);
  }

  act(id: string, action: CouncilAction) {
    this.apply(id, action, this.now());
  }

  private apply(id: string, action: CouncilAction, now: number) {
    if (action.turn !== this.turn) throw new GameRuleError('That council turn has ended.');
    if (action.type === 'respond') {
      const seat = this.seats.find((player) => player.id === id);
      if (!seat || !this.mayRespond(seat) || this.endsAt === null || now >= this.endsAt) {
        throw new GameRuleError('This challenge window is closed.');
      }
      this.responses.set(id, action.challenge);
      if (!this.seats.some((player) => this.mayRespond(player))) this.resolve();
      return;
    }
    if (this.phase !== 'proposal' || this.player.id !== id) throw new GameRuleError('Wait for your proposal.');
    if (action.type === 'service') {
      this.player.coins++;
      this.player.standing++;
      this.outcome = { accepted: true, challengerIds: [], shown: null };
      this.phase = 'reveal';
      return;
    }
    if (!Object.hasOwn(permits, action.permit) || this.player.coins < permits[action.permit].cost) {
      throw new GameRuleError('You cannot afford that proposal.');
    }
    this.claim = action.permit;
    this.phase = 'response';
    this.endsAt = now + challengeMs;
    if (!this.seats.some((player) => this.mayRespond(player))) this.resolve();
  }

  private resolve() {
    const choice = this.claim!;
    const challengers = this.seats.filter(({ id }) => this.responses.get(id));
    const accepted = !challengers.length || choice === this.permit;
    if (accepted) {
      const result = permits[choice];
      this.player.coins += result.coins - result.cost;
      this.player.standing += result.standing;
      for (const rival of challengers) rival.coins--;
    } else {
      this.player.coins = Math.max(0, this.player.coins - 1);
      for (const rival of challengers) rival.standing++;
    }
    this.outcome = { accepted, challengerIds: challengers.map(({ id }) => id),
      shown: challengers.length ? this.permit : null };
    this.endsAt = null;
    this.phase = 'reveal';
  }

  expire() {
    if (this.phase !== 'response' || this.endsAt === null || this.now() < this.endsAt) return false;
    this.resolve();
    return true;
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.turn === this.seats.length * maxRounds || this.seats.some(({ standing }) => standing >= goal)) {
      this.phase = 'game-over';
      return;
    }
    this.turn++;
    this.active = (this.active + 1) % this.seats.length;
    this.pauseForProposal();
  }

  private pauseForProposal() {
    this.claim = null;
    this.outcome = null;
    this.responses.clear();
    this.permit = permitIds[this.random(permitIds.length)];
    this.phase = 'proposal';
  }

  automaticMove(): (() => void) | undefined {
    if (this.revealing || this.gameOver ||
      (!this.seats.every((seat) => seat.bot) && !this.seats.some((seat) => seat.connected && !seat.bot))) return;
    const now = this.now();
    if (this.phase === 'response') {
      if (this.endsAt === null || now >= this.endsAt) return;
      const rival = this.seats.find((seat) => (seat.bot || !seat.connected) && this.mayRespond(seat));
      if (!rival) return;
      return () => this.apply(rival.id, { type: 'respond', turn: this.turn, challenge: rival.coins > 1 && this.random(3) === 0 }, now);
    }
    const player = this.player;
    if (!player.bot && player.connected) return;
    return () => {
      const suitable = this.permit === 'outreach' || (this.permit === 'works' && player.coins >= 2) ||
        (this.permit === 'contracts' && player.coins < 2);
      if (suitable) this.apply(player.id, { type: 'claim', turn: this.turn, permit: this.permit }, now);
      else if (this.random(4) === 0) this.apply(player.id, { type: 'claim', turn: this.turn, permit: 'outreach' }, now);
      else this.apply(player.id, { type: 'service', turn: this.turn }, now);
    };
  }

  view(id?: string): CouncilView {
    const me = this.seats.find((seat) => seat.id === id);
    const best = Math.max(...this.seats.map(({ standing }) => standing));
    return {
      phase: this.phase, turn: this.turn, round: Math.ceil(this.turn / this.seats.length),
      activePlayerId: this.gameOver ? null : this.player.id, deadline: this.endsAt,
      players: this.seats.map((seat) => ({ ...seat, answered: this.responses.has(seat.id) })),
      myPermit: me === this.player && this.phase !== 'game-over' ? this.permit : null,
      canRespond: !!me && this.mayRespond(me), claim: this.claim,
      outcome: this.outcome ? { ...this.outcome, challengerIds: [...this.outcome.challengerIds] } : null,
      winnerIds: this.gameOver ? this.seats.filter(({ standing }) => standing === best).map(({ id }) => id) : [],
    };
  }
}
