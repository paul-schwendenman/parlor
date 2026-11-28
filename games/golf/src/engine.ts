import { createDeck, type Card } from '@parlor/cards';
import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { COLUMN_COUNT, DEFAULT_OPTIONS, SLOT_COUNT, golfValue, gridScore } from './rules.js';
import type { GolfAction, GolfOptions, GolfPhase, GolfView } from './types.js';

interface Player { id: string; name: string; bot: boolean }
interface Slot { card: Card; faceUp: boolean }
interface Seat extends Player {
  connected: boolean;
  grid: Slot[];
  holeScores: number[];
}

const sum = (scores: readonly number[]) => scores.reduce((total, score) => total + score, 0);
const publicGrid = (seat: Pick<Seat, 'grid'>) => seat.grid.map(({ card, faceUp }) => faceUp ? { ...card } : null);
const hiddenSlots = (seat: Seat) => seat.grid.flatMap(({ faceUp }, slot) => faceUp ? [] : [slot]);

export class GolfEngine {
  private readonly seats: Seat[];
  private readonly options: GolfOptions;
  private dealer: number;
  private active = 0;
  private phase: GolfPhase = 'setup';
  private hole = 1;
  private stock: Card[] = [];
  private discard: Card[] = [];
  private stockRecycled = false;
  private drawn: Card | null = null;
  private wentOutId: string | null = null;

  constructor(players: Player[], private readonly randomInt: RandomInt = secureRandomInt, options: Partial<GolfOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.seats = players.map((player) => ({ ...player, connected: true, grid: [], holeScores: [] }));
    this.dealer = randomInt(players.length);
    this.deal();
  }

  get revealing() { return this.phase === 'hole-scoring'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    const deck = createDeck();
    if (this.seats.length >= 5) deck.push(...createDeck());
    this.stock = fisherYatesShuffle(deck, this.randomInt);
    for (const seat of this.seats) {
      seat.grid = this.stock.splice(0, SLOT_COUNT).map((card) => ({ card, faceUp: false }));
    }
    this.discard = [this.stock.pop()!];
    this.stockRecycled = false;
    this.active = (this.dealer + 1) % this.seats.length;
    this.wentOutId = null;
    this.phase = 'setup';
  }

  private get canDraw() { return this.stock.length > 0 || this.discard.length > 1; }

  act(id: string, action: GolfAction) {
    const seat = this.seats.find((player) => player.id === id);
    if (!seat || (this.phase !== 'setup' && seat !== this.seats[this.active])) {
      throw new GameRuleError('Wait for your turn.');
    }
    const slot = 'slot' in action && Number.isInteger(action.slot) ? seat.grid[action.slot] : undefined;
    switch (action.type) {
      case 'reveal':
        if (this.phase !== 'setup' || !slot || slot.faceUp || hiddenSlots(seat).length <= 4) break;
        slot.faceUp = true;
        if (this.seats.every((player) => hiddenSlots(player).length === 4)) this.phase = 'turn';
        return;
      case 'draw-stock':
        if (this.phase !== 'turn' || !this.canDraw) break;
        if (!this.stock.length) {
          this.stock = fisherYatesShuffle(this.discard.splice(0, this.discard.length - 1), this.randomInt);
          this.stockRecycled = true;
        }
        this.drawn = this.stock.pop()!;
        this.phase = 'drawn';
        return;
      case 'take-discard':
        if (this.phase !== 'turn' || !slot || !this.discard.length) break;
        this.swap(slot, this.discard.pop()!);
        return;
      case 'swap-drawn':
        if (this.phase !== 'drawn' || !slot || !this.drawn) break;
        this.swap(slot, this.drawn);
        return;
      case 'discard-drawn':
        if (this.phase !== 'drawn' || !this.drawn) break;
        this.discard.push(this.drawn);
        this.drawn = null;
        if (this.options.flipOnDiscard && hiddenSlots(seat).length >= 2) this.phase = 'flip';
        else this.finishTurn();
        return;
      case 'flip':
        if (this.phase !== 'flip' || !slot || slot.faceUp) break;
        slot.faceUp = true;
        this.finishTurn();
        return;
    }
    throw new GameRuleError('That move is unavailable.');
  }

  private swap(slot: Slot, card: Card) {
    this.discard.push(slot.card);
    slot.card = card;
    slot.faceUp = true;
    this.drawn = null;
    this.finishTurn();
  }

  private finishTurn() {
    const seat = this.seats[this.active];
    if (!this.wentOutId && hiddenSlots(seat).length === 0) {
      this.wentOutId = seat.id;
      if (!this.options.finalTurns) {
        this.scoreHole();
        return;
      }
    }
    this.active = (this.active + 1) % this.seats.length;
    if (this.seats[this.active].id === this.wentOutId) this.scoreHole();
    else this.phase = 'turn';
  }

  private scoreHole() {
    this.phase = 'hole-scoring';
    for (const seat of this.seats) {
      for (const slot of seat.grid) slot.faceUp = true;
      seat.holeScores.push(gridScore(publicGrid(seat), this.options.fourOfAKind));
    }
  }

  advanceReveal() {
    if (!this.revealing) return;
    if (this.hole >= this.options.holes) {
      this.phase = 'game-over';
      return;
    }
    this.hole++;
    this.dealer = (this.dealer + 1) % this.seats.length;
    this.deal();
  }

  private bestSwap(seat: Seat, card: Card): { slot: number; gain: number } {
    const grid = publicGrid(seat);
    const prior = this.estimate(grid);
    const rivals = this.seats.filter((other) => other !== seat).map((other) => this.estimate(publicGrid(other)));
    const choices = grid.map((_, slot) => {
      const next = [...grid];
      next[slot] = card;
      const score = this.estimate(next);
      return { slot, gain: prior - score, risky: next.every(Boolean) && rivals.some((rival) => rival < score) };
    });
    return choices.sort((a, b) => Number(a.risky) - Number(b.risky) || b.gain - a.gain)[0];
  }

  private estimate(grid: (Card | null)[]) {
    // The mean rank value of an unseen card in a full deck.
    return gridScore(grid, this.options.fourOfAKind) + grid.filter((card) => !card).length * (71 / 13);
  }

  automaticMove(): (() => void) | undefined {
    if (this.revealing || this.gameOver) return;
    const automated = (seat: Seat) => seat.bot || !seat.connected;
    if (!this.seats.every((seat) => seat.bot) && !this.seats.some((seat) => !automated(seat))) return;
    if (this.phase === 'setup') {
      const seat = this.seats.find((player) => automated(player) && hiddenSlots(player).length > 4);
      if (!seat) return;
      const slot = [0, COLUMN_COUNT, ...hiddenSlots(seat)].find((index) => !seat.grid[index].faceUp)!;
      return () => this.act(seat.id, { type: 'reveal', slot });
    }
    const seat = this.seats[this.active];
    if (!automated(seat)) return;
    if (this.phase === 'flip') return () => this.act(seat.id, { type: 'flip', slot: hiddenSlots(seat)[0] });

    const card = this.drawn ?? this.discard.at(-1)!;
    const { slot, gain } = this.bestSwap(seat, card);
    const pairs = seat.grid[(slot + COLUMN_COUNT) % SLOT_COUNT];
    const matches = pairs.faceUp && pairs.card.rank === card.rank;
    if (this.phase === 'drawn') {
      if (gain >= 1 && (matches || golfValue(card.rank) <= 5)) {
        return () => this.act(seat.id, { type: 'swap-drawn', slot });
      }
      // Once the stock has cycled, take a chance on a hidden slot to keep the hole moving.
      if (this.stockRecycled) {
        const [hidden] = hiddenSlots(seat);
        if (hidden !== undefined) return () => this.act(seat.id, { type: 'swap-drawn', slot: hidden });
      }
      return () => this.act(seat.id, { type: 'discard-drawn' });
    }
    return () => this.act(seat.id, !this.canDraw || (gain > 0 && (matches || golfValue(card.rank) <= 2))
      ? { type: 'take-discard', slot }
      : { type: 'draw-stock' });
  }

  view(id?: string): GolfView {
    const viewer = this.seats.find((seat) => seat.id === id);
    const acting = !!viewer && viewer === this.seats[this.active];
    const players = this.seats.map((seat) => {
      const { id, name, bot, connected, holeScores } = seat;
      const grid = publicGrid(seat);
      return {
        id, name, bot, connected, grid, showing: gridScore(grid, this.options.fourOfAKind),
        holeScores: [...holeScores], total: sum(holeScores), setupDone: grid.filter(Boolean).length >= 2,
      };
    });
    const hidden = viewer ? hiddenSlots(viewer) : [];
    const setupFlipsLeft = this.phase === 'setup' && viewer ? Math.max(0, hidden.length - 4) : 0;
    const targetSlots = setupFlipsLeft || (acting && this.phase === 'flip') ? hidden
      : acting && (this.phase === 'turn' || this.phase === 'drawn') ? viewer.grid.map((_, slot) => slot) : [];
    const discardTop = this.discard.at(-1);
    return {
      phase: this.phase, hole: this.hole, holes: this.options.holes, dealerId: this.seats[this.dealer].id,
      activePlayerId: this.phase === 'setup' || this.revealing || this.gameOver ? null : this.seats[this.active].id,
      wentOutId: this.wentOutId, players, stockCount: this.stock.length, discardTop: discardTop ? { ...discardTop } : null,
      drawn: this.drawn ? { ...this.drawn } : null, setupFlipsLeft, targetSlots,
      canDrawStock: acting && this.phase === 'turn' && this.canDraw,
      canTakeDiscard: acting && this.phase === 'turn' && !!discardTop,
      canDiscardDrawn: acting && this.phase === 'drawn',
      winnerIds: this.gameOver
        ? players.filter(({ total }) => total === Math.min(...players.map((player) => player.total))).map(({ id }) => id)
        : [],
    };
  }
}
