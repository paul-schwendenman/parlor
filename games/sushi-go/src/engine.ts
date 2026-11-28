import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { choosePick } from './bot.js';
import {
  addToPlate, buildDeck, handSize, makiIcons, ROUNDS, scoreMaki, scorePlate, scorePuddings, usableChopsticks,
  type PlateCard, type RoundScore, type SushiCard,
} from './rules.js';
import type { SushiGoAction, SushiGoPhase, SushiGoView } from './types.js';

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  removed: boolean;
  hand: SushiCard[];
  plate: PlateCard[];
  bankedPuddings: number;
  pick: { ids: number[]; byStandIn: boolean } | null;
  roundScores: RoundScore[];
  puddingScore: number | null;
  revealed: number[];
  usedChopsticks: boolean;
}

export class SushiGoEngine {
  private readonly seats: Seat[];
  private readonly handSize: number;
  private readonly rounds: number;
  /** Undealt cards; the top is the end. */
  private deck: SushiCard[];
  private phase: SushiGoPhase = 'picking';
  private round = 0;
  private pickNo = 1;
  private winnerIds: string[] = [];

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    random: RandomInt = secureRandomInt,
    options: { rounds?: number } = {},
  ) {
    if (players.length < 2 || players.length > 5) throw new GameRuleError('Sushi Go needs 2 to 5 players.');
    this.seats = players.map((player) => ({
      ...player, connected: true, removed: false, hand: [], plate: [], bankedPuddings: 0, pick: null,
      roundScores: [], puddingScore: null, revealed: [], usedChopsticks: false,
    }));
    this.handSize = handSize(players.length);
    this.rounds = options.rounds ?? ROUNDS;
    this.deck = fisherYatesShuffle(buildDeck(), random);
    this.deal();
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'reveal' || this.phase === 'round-scoring'; }
  get revealDelay() {
    if (this.phase === 'round-scoring') return 6000;
    return this.seats.some(({ usedChopsticks }) => usedChopsticks) ? 2200 : 1600;
  }

  private deal() {
    this.round++;
    this.pickNo = 1;
    for (const seat of this.seats) {
      seat.hand = this.deck.splice(-this.handSize).reverse();
      seat.plate = seat.plate.filter(({ card }) => card.kind === 'pudding');
      seat.bankedPuddings += seat.plate.length;
      seat.plate = [];
      seat.pick = null;
      seat.revealed = [];
      seat.usedChopsticks = false;
    }
    this.phase = 'picking';
  }

  private find(id: string) {
    return this.seats.find((seat) => seat.id === id);
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.find(id);
    if (seat) seat.connected = connected;
  }

  remove(id: string) {
    const seat = this.find(id);
    if (seat) {
      seat.removed = true;
      seat.connected = false;
    }
  }

  act(id: string, action: SushiGoAction, byStandIn = false) {
    const seat = this.find(id);
    if (!seat) throw new GameRuleError('You are not seated in this game.');
    if (this.phase !== 'picking') throw new GameRuleError('The cards are already on the table.');
    if (action.type === 'unpick') {
      if (!seat.pick) throw new GameRuleError('You have not picked yet.');
      seat.pick = null;
      return;
    }
    if (seat.pick) throw new GameRuleError('You’ve already picked. Change it first.');
    const ids = action.cardIds;
    if (!ids.length || ids.length > 2 || new Set(ids).size !== ids.length) throw new GameRuleError('Choose one card, or two with chopsticks.');
    if (!ids.every((cardId) => seat.hand.some((card) => card.id === cardId))) throw new GameRuleError('That card isn’t in your hand.');
    if (ids.length === 2 && (!usableChopsticks(seat.plate, this.pickNo) || seat.hand.length < 2)) {
      throw new GameRuleError('You need chopsticks from an earlier turn to take two.');
    }
    seat.pick = { ids: [...ids], byStandIn };
    if (this.seats.every(({ pick }) => pick)) this.reveal();
  }

  private reveal() {
    for (const seat of this.seats) {
      const picked = seat.pick!.ids.map((cardId) => seat.hand.find((card) => card.id === cardId)!);
      picked.sort((a, b) => Number(b.kind === 'wasabi') - Number(a.kind === 'wasabi'));
      seat.hand = seat.hand.filter((card) => !picked.includes(card));
      for (const card of picked) addToPlate(seat.plate, card, this.pickNo);
      seat.usedChopsticks = picked.length === 2;
      if (seat.usedChopsticks) {
        const chopsticks = usableChopsticks(seat.plate, this.pickNo)!;
        seat.plate.splice(seat.plate.indexOf(chopsticks), 1);
        seat.hand.push(chopsticks.card);
      }
      seat.revealed = picked.map(({ id }) => id);
    }
    this.phase = 'reveal';
  }

  advanceReveal() {
    if (this.phase === 'round-scoring') return this.deal();
    if (this.phase !== 'reveal') return;
    if (this.seats.every(({ hand }) => !hand.length)) return this.scoreRound();
    const hands = this.seats.map(({ hand }) => hand);
    this.seats.forEach((seat, i) => {
      seat.hand = hands[(i - 1 + hands.length) % hands.length];
      seat.pick = null;
      seat.revealed = [];
      seat.usedChopsticks = false;
    });
    this.pickNo++;
    this.phase = 'picking';
  }

  private scoreRound() {
    const maki = scoreMaki(this.seats.map(({ plate }) => makiIcons(plate)));
    this.seats.forEach((seat, i) => {
      const base = scorePlate(seat.plate);
      seat.roundScores.push({ ...base, maki: maki[i], total: base.tempura + base.sashimi + base.dumpling + base.nigiri + maki[i] });
      seat.revealed = [];
      seat.usedChopsticks = false;
    });
    if (this.round < this.rounds) {
      this.phase = 'round-scoring';
      return;
    }
    const puddings = this.seats.map((seat) => this.puddings(seat));
    const points = scorePuddings(puddings);
    this.seats.forEach((seat, i) => { seat.puddingScore = points[i]; });
    const totals = this.seats.map((seat) => this.total(seat));
    const best = Math.max(...totals);
    const leaders = this.seats.filter((_, i) => totals[i] === best);
    const mostPuddings = Math.max(...leaders.map((seat) => this.puddings(seat)));
    this.winnerIds = leaders.filter((seat) => this.puddings(seat) === mostPuddings).map(({ id }) => id);
    this.phase = 'game-over';
  }

  private puddings(seat: Seat) {
    return seat.bankedPuddings + seat.plate.filter(({ card }) => card.kind === 'pudding').length;
  }

  private total(seat: Seat) {
    return seat.roundScores.reduce((sum, { total }) => sum + total, 0) + (seat.puddingScore ?? 0);
  }

  automaticMove(): (() => void) | undefined {
    if (this.phase !== 'picking') return;
    if (!this.seats.every(({ bot }) => bot) && !this.seats.some(({ bot, connected }) => connected && !bot)) return;
    const waiting = this.seats.filter(({ pick }) => !pick);
    // Bots pick at once; an absent human's stand-in waits for every present seat.
    const seat = waiting.find(({ bot }) => bot) ?? (waiting.every(({ bot, connected }) => !bot && !connected) ? waiting[0] : undefined);
    if (!seat) return;
    return () => this.act(seat.id, { type: 'pick', cardIds: this.botPick(seat) }, !seat.bot);
  }

  private botPick(seat: Seat) {
    return choosePick(seat.hand, seat.plate, {
      round: this.round,
      rivals: this.seats.filter((other) => other !== seat).map((other) => ({ maki: makiIcons(other.plate), puddings: this.puddings(other) })),
      puddings: this.puddings(seat),
      canUseChopsticks: !!usableChopsticks(seat.plate, this.pickNo) && seat.hand.length >= 2,
    });
  }

  view(playerId?: string): SushiGoView {
    const me = playerId === undefined ? undefined : this.find(playerId);
    const canPick = !!me && this.phase === 'picking' && !me.pick;
    return {
      phase: this.phase,
      round: this.round,
      rounds: this.rounds,
      pick: this.pickNo,
      handSize: this.handSize,
      players: this.seats.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, removed: seat.removed,
        handCount: seat.hand.length, locked: !!seat.pick, plate: seat.plate.map((item) => ({ ...item, card: { ...item.card } })),
        puddings: this.puddings(seat), roundScores: seat.roundScores.map((score) => ({ ...score })),
        puddingScore: seat.puddingScore, total: this.total(seat), revealed: [...seat.revealed], usedChopsticks: seat.usedChopsticks,
      })),
      winnerIds: [...this.winnerIds],
      myHand: me ? me.hand.map((card) => ({ ...card })) : [],
      myPick: me?.pick ? [...me.pick.ids] : null,
      pickedForMe: !!me?.pick?.byStandIn,
      canPick,
      canUseChopsticks: canPick && !!usableChopsticks(me.plate, this.pickNo) && me.hand.length >= 2,
    };
  }
}
