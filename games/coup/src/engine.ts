import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import {
  ACTION_INFO, ACTIONS, BLOCKERS, CARD_VALUE, CHARACTER_INFO, CLAIM, COST, deck as fullDeck, FORCED_COUP, TARGETED,
  type Character, type CourtAction,
} from './rules.js';
import type { CoupActionMsg, CoupView, CourtPhase, LogEntry, WindowKind } from './types.js';

interface Card { character: Character; exposed: boolean }
interface Seat { id: string; name: string; bot: boolean; connected: boolean; coins: number; hand: Card[]; out: boolean }
interface Turn {
  actor: number;
  action: CourtAction;
  target: number | null;
  paid: number;
  block: { blocker: number; character: Character } | null;
  challenge: { challenger: number; claimant: number; about: 'action' | 'block' } | null;
}
interface Window { id: number; kind: WindowKind; eligible: Set<number>; passed: Set<number>; deadlineAt: number | null }

export interface CoupOptions { windowSeconds: number | null; twoPlayerStartCoin: boolean }
export const DEFAULT_OPTIONS: CoupOptions = { windowSeconds: 15, twoPlayerStartCoin: true };
const GRACE_MS = 600;

export class CoupEngine {
  private readonly seats: Seat[];
  private readonly options: CoupOptions;
  private deck: Character[];
  private phase: CourtPhase = 'choose-action';
  private active: number;
  private turnStartCoins = 0;
  private turnNumber = 1;
  private turn: Turn | null = null;
  private window: Window | null = null;
  private windowSeq = 0;
  private awaiting: number | null = null;
  private reveal: CoupView['reveal'] = null;
  private afterReveal: (() => void) | null = null;
  private afterExpose: (() => void) | null = null;
  private exchangeOptions: Character[] | null = null;
  private log: LogEntry[] = [];
  private logSeq = 0;
  private outOrder: string[] = [];
  private winnerId: string | null = null;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    options: Partial<CoupOptions> = {},
    private readonly now: () => number = Date.now,
  ) {
    if (players.length < 2 || players.length > 6) throw new GameRuleError('Coup needs 2 to 6 players.');
    this.options = { ...DEFAULT_OPTIONS, ...options };
    const cards = fisherYatesShuffle(fullDeck(), random);
    this.seats = players.map((player) => ({
      ...player, connected: true, coins: 2, out: false,
      hand: cards.splice(0, 2).map((character) => ({ character, exposed: false })),
    }));
    this.deck = cards;
    this.active = random(players.length);
    if (players.length === 2 && this.options.twoPlayerStartCoin) this.seats[this.active].coins = 1;
    this.startTurn();
  }

  /** Test hook: set hands, coins, the deck and who acts. */
  rig(setup: { hands?: Record<string, Character[]>; coins?: Record<string, number>; deck?: Character[]; active?: string }) {
    for (const seat of this.seats) {
      const hand = setup.hands?.[seat.id];
      if (hand) seat.hand = hand.map((character) => ({ character, exposed: false }));
      if (setup.coins?.[seat.id] !== undefined) seat.coins = setup.coins[seat.id];
    }
    if (setup.deck) this.deck = [...setup.deck];
    if (setup.active) this.active = this.index(setup.active);
    this.startTurn();
  }

  get currentPhase() { return this.phase; }
  get revealing() { return this.phase === 'reveal'; }
  get deadline() { return this.humansPresent ? this.window?.deadlineAt ?? null : null; }

  private get humansPresent() {
    return this.seats.every(({ bot }) => bot) || this.seats.some(({ bot, connected }) => !bot && connected);
  }

  private index(id: string) { return this.seats.findIndex((seat) => seat.id === id); }
  private alive() { return this.seats.flatMap((seat, i) => seat.out ? [] : [i]); }
  private hidden(seat: Seat) { return seat.hand.filter(({ exposed }) => !exposed); }
  private holds(seat: Seat, character: Character) { return this.hidden(seat).some((card) => card.character === character); }
  private name(i: number) { return this.seats[i].name; }

  private note(text: string) {
    this.log.push({ id: ++this.logSeq, text });
    if (this.log.length > 40) this.log.shift();
  }

  private startTurn() {
    this.phase = 'choose-action';
    this.turn = null;
    this.window = null;
    this.awaiting = this.active;
    this.turnStartCoins = this.seats[this.active].coins;
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats[this.index(id)];
    if (seat) seat.connected = connected;
  }

  /** Legal actions for the active seat. */
  private legalActions(i: number) {
    const seat = this.seats[i];
    const others = this.alive().filter((other) => other !== i).map((other) => this.seats[other].id);
    const forced = this.turnStartCoins >= FORCED_COUP;
    return ACTIONS.filter((action) => (!forced || action === 'coup') && seat.coins >= (COST[action] ?? 0)).map((action) => ({
      action,
      targets: TARGETED.includes(action) ? others : [],
      bluff: !!CLAIM[action] && !this.holds(seat, CLAIM[action]),
      cost: COST[action] ?? 0,
    }));
  }

  act(id: string, msg: CoupActionMsg) {
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    const i = this.index(id);
    if (i < 0) throw new GameRuleError('You are not playing this game.');
    const seat = this.seats[i];
    if (seat.out) throw new GameRuleError('You are out of the game.');
    switch (msg.type) {
      case 'declare': return this.declare(i, msg.action, msg.targetId);
      case 'challenge': return this.respond(i, msg.windowId, 'challenge');
      case 'pass': return this.respond(i, msg.windowId, 'pass');
      case 'block': return this.respond(i, msg.windowId, 'block', msg.character);
      case 'prove': return this.prove(i);
      case 'expose': return this.expose(i, msg.index);
      case 'keep': return this.keep(i, msg.indices);
    }
  }

  private declare(i: number, action: CourtAction, targetId?: string) {
    if (this.phase !== 'choose-action' || i !== this.active) throw new GameRuleError('It is not your turn.');
    const legal = this.legalActions(i).find((option) => option.action === action);
    if (!legal) {
      throw new GameRuleError(this.turnStartCoins >= FORCED_COUP ? 'With 10 or more coins you must Coup.' : `You need ${COST[action]} coins for that.`);
    }
    let target: number | null = null;
    if (legal.targets.length) {
      if (!targetId || !legal.targets.includes(targetId)) throw new GameRuleError('Choose another player who is still in.');
      target = this.index(targetId);
    } else if (targetId !== undefined) throw new GameRuleError('That action has no target.');
    const paid = COST[action] ?? 0;
    this.seats[i].coins -= paid;
    this.turn = { actor: i, action, target, paid, block: null, challenge: null };
    const claim = CLAIM[action];
    const verb = claim ? `claims ${CHARACTER_INFO[claim].name}: ${ACTION_INFO[action].name}` : action === 'coup' ? 'stages a Coup' : `takes ${ACTION_INFO[action].name}`;
    this.note(`${this.name(i)} ${verb}${target !== null ? ` on ${this.name(target)}` : ''}.`);
    if (action === 'income') {
      this.seats[i].coins++;
      return this.endTurn();
    }
    if (action === 'coup') return this.loseCard(target!, () => this.endTurn());
    if (action === 'foreign-aid') return this.openWindow('block', this.alive().filter((other) => other !== i), () => this.resolve());
    this.openWindow('challenge-action', this.alive().filter((other) => other !== i), () => this.afterActionClaim());
  }

  /** What to do when a window closes with nobody stepping in. */
  private onQuiet: (() => void) | null = null;

  private openWindow(kind: WindowKind, eligible: number[], quiet: () => void) {
    if (!eligible.length) return quiet();
    this.phase = kind;
    this.awaiting = null;
    this.onQuiet = quiet;
    const seconds = this.options.windowSeconds;
    this.window = {
      id: ++this.windowSeq, kind, eligible: new Set(eligible), passed: new Set(),
      deadlineAt: seconds === null ? null : this.now() + seconds * 1000 + GRACE_MS,
    };
  }

  private closeQuiet() {
    const quiet = this.onQuiet!;
    this.window = null;
    this.onQuiet = null;
    quiet();
  }

  private respond(i: number, windowId: number, kind: 'challenge' | 'pass' | 'block', character?: Character) {
    const window = this.window;
    if (!window || window.id !== windowId) throw new GameRuleError('Too late, that moment has passed.');
    if (!window.eligible.has(i) || window.passed.has(i)) throw new GameRuleError('You can’t respond to this.');
    const turn = this.turn!;
    if (kind === 'pass') {
      window.passed.add(i);
      if (window.passed.size === window.eligible.size) this.closeQuiet();
      return;
    }
    if (kind === 'block') {
      if (window.kind !== 'block' || !BLOCKERS[turn.action]?.includes(character!)) throw new GameRuleError('That character can’t block this.');
      this.window = null;
      turn.block = { blocker: i, character: character! };
      this.note(`${this.name(i)} blocks, claiming ${CHARACTER_INFO[character!].name}.`);
      this.openWindow('challenge-block', this.alive().filter((other) => other !== i), () => {
        this.note('The block stands.');
        this.endTurn();
      });
      return;
    }
    if (window.kind === 'block') throw new GameRuleError('Block or let it go.');
    const about = window.kind === 'challenge-action' ? 'action' : 'block';
    const claimant = about === 'action' ? turn.actor : turn.block!.blocker;
    this.window = null;
    turn.challenge = { challenger: i, claimant, about };
    this.note(`${this.name(i)} challenges ${this.name(claimant)}.`);
    this.phase = 'answer-challenge';
    this.awaiting = claimant;
  }

  /** Called by the definition when a window's time is up. */
  expire() {
    if (!this.window || this.window.deadlineAt === null || this.now() < this.window.deadlineAt) return false;
    this.closeQuiet();
    return true;
  }

  private claimOf(turn: Turn) {
    return turn.challenge!.about === 'action' ? CLAIM[turn.action]! : turn.block!.character;
  }

  private prove(i: number) {
    const turn = this.turn;
    if (this.phase !== 'answer-challenge' || !turn?.challenge || turn.challenge.claimant !== i) throw new GameRuleError('Nobody has challenged you.');
    const claim = this.claimOf(turn);
    const card = this.hidden(this.seats[i]).find((hand) => hand.character === claim);
    if (!card) throw new GameRuleError(`You don’t hold the ${CHARACTER_INFO[claim].name}.`);
    this.phase = 'reveal';
    this.awaiting = null;
    this.reveal = { claimantId: this.seats[i].id, claim, proved: true, shown: claim };
    this.note(`${this.name(i)} shows the ${CHARACTER_INFO[claim].name} and draws a new card.`);
    const { challenger, about } = turn.challenge;
    this.afterReveal = () => {
      const seat = this.seats[i];
      seat.hand.splice(seat.hand.indexOf(card), 1);
      this.deck = fisherYatesShuffle([...this.deck, claim], this.random);
      seat.hand.push({ character: this.deck.pop()!, exposed: false });
      this.loseCard(challenger, () => {
        if (about === 'action') this.afterActionClaim();
        else {
          this.note('The block stands.');
          this.endTurn();
        }
      });
    };
  }

  private expose(i: number, index: number) {
    const seat = this.seats[i];
    const card = seat.hand[index];
    const turn = this.turn;
    if (this.phase === 'answer-challenge' && turn?.challenge?.claimant === i) {
      if (!card || card.exposed) throw new GameRuleError('Choose one of your hidden cards.');
      const claim = this.claimOf(turn);
      const { about } = turn.challenge;
      this.phase = 'reveal';
      this.awaiting = null;
      this.reveal = { claimantId: seat.id, claim, proved: false, shown: null };
      this.note(`${this.name(i)} can’t prove it.`);
      if (this.flip(i, index)) return;
      this.afterReveal = () => {
        if (about === 'action') {
          if (turn.action === 'assassinate') this.seats[turn.actor].coins += turn.paid;
          this.endTurn();
        } else this.resolve();
      };
      return;
    }
    if (this.phase !== 'expose' || this.awaiting !== i) throw new GameRuleError('You don’t have to lose a card now.');
    if (!card || card.exposed) throw new GameRuleError('Choose one of your hidden cards.');
    if (this.flip(i, index)) return;
    const next = this.afterExpose!;
    this.afterExpose = null;
    next();
  }

  /** Turns a card face up. True when that ended the game. */
  private flip(i: number, index: number) {
    const seat = this.seats[i];
    seat.hand[index].exposed = true;
    this.note(`${seat.name} loses a ${CHARACTER_INFO[seat.hand[index].character].name}.`);
    if (!this.hidden(seat).length) {
      seat.out = true;
      seat.coins = 0;
      this.outOrder.push(seat.id);
      this.note(`${seat.name} is out.`);
    }
    return this.checkWinner();
  }

  private checkWinner() {
    const alive = this.alive();
    if (alive.length > 1) return false;
    this.winnerId = this.seats[alive[0]].id;
    this.phase = 'game-over';
    this.window = null;
    this.awaiting = null;
    this.note(`${this.seats[alive[0]].name} wins.`);
    return true;
  }

  /** The seat picks a card to lose (or loses its last one), then `then` runs. */
  private loseCard(i: number, then: () => void) {
    const seat = this.seats[i];
    if (seat.out) return then();
    const hidden = this.hidden(seat);
    if (hidden.length === 1) {
      if (this.flip(i, seat.hand.indexOf(hidden[0]))) return;
      return then();
    }
    this.phase = 'expose';
    this.awaiting = i;
    this.afterExpose = then;
  }

  private afterActionClaim() {
    const turn = this.turn!;
    if (this.seats[turn.actor].out) return this.endTurn();
    const blockers = BLOCKERS[turn.action];
    if (blockers && turn.target !== null && !this.seats[turn.target].out) {
      return this.openWindow('block', [turn.target], () => this.resolve());
    }
    this.resolve();
  }

  private resolve() {
    const turn = this.turn!;
    const actor = this.seats[turn.actor];
    const target = turn.target === null ? null : this.seats[turn.target];
    switch (turn.action) {
      case 'foreign-aid': actor.coins += 2; break;
      case 'tax': actor.coins += 3; break;
      case 'steal': {
        if (!target || target.out) break;
        const amount = Math.min(2, target.coins);
        target.coins -= amount;
        actor.coins += amount;
        this.note(`${actor.name} takes ${amount} from ${target.name}.`);
        break;
      }
      case 'assassinate':
        if (target && !target.out) return this.loseCard(turn.target!, () => this.endTurn());
        break;
      case 'exchange': {
        if (actor.out) break;
        const drawn = this.deck.splice(-2);
        this.exchangeOptions = fisherYatesShuffle([...this.hidden(actor).map(({ character }) => character), ...drawn], this.random);
        this.phase = 'exchange';
        this.awaiting = turn.actor;
        return;
      }
    }
    this.endTurn();
  }

  private keep(i: number, indices: number[]) {
    const options = this.exchangeOptions;
    if (this.phase !== 'exchange' || this.awaiting !== i || !options) throw new GameRuleError('You are not exchanging cards.');
    const seat = this.seats[i];
    const count = this.hidden(seat).length;
    if (indices.length !== count || new Set(indices).size !== count || indices.some((at) => at < 0 || at >= options.length)) {
      throw new GameRuleError(`Keep exactly ${count} ${count === 1 ? 'card' : 'cards'}.`);
    }
    seat.hand = [...seat.hand.filter(({ exposed }) => exposed), ...indices.map((at) => ({ character: options[at], exposed: false }))];
    this.deck = fisherYatesShuffle([...this.deck, ...options.filter((_, at) => !indices.includes(at))], this.random);
    this.exchangeOptions = null;
    this.endTurn();
  }

  private endTurn() {
    if (this.checkWinner()) return;
    this.reveal = null;
    this.exchangeOptions = null;
    let next = this.active;
    do next = (next + 1) % this.seats.length; while (this.seats[next].out);
    this.active = next;
    this.turnNumber++;
    this.startTurn();
  }

  advanceReveal() {
    if (this.phase !== 'reveal') return;
    const next = this.afterReveal;
    this.afterReveal = null;
    this.reveal = null;
    next?.();
  }

  /** A player left for good: every card face up, and the turn is repaired. */
  removePlayer(id: string) {
    const i = this.index(id);
    const seat = this.seats[i];
    if (!seat || seat.out || this.phase === 'game-over') return;
    for (const card of seat.hand) card.exposed = true;
    seat.out = true;
    seat.coins = 0;
    this.outOrder.push(seat.id);
    this.note(`${seat.name} left and is out.`);
    if (this.checkWinner()) return;
    const turn = this.turn;
    if (this.phase === 'exchange' && this.awaiting === i) {
      this.deck = fisherYatesShuffle([...this.deck, ...this.exchangeOptions!.slice(0, 2)], this.random);
      return this.endTurn();
    }
    if (i === this.active && (this.phase === 'choose-action' || this.window)) return this.endTurn();
    if (this.window) {
      this.window.eligible.delete(i);
      this.window.passed.delete(i);
      if (this.window.passed.size >= this.window.eligible.size) this.closeQuiet();
      return;
    }
    if (this.phase === 'answer-challenge' && turn?.challenge?.claimant === i) {
      if (turn.challenge.about === 'action') return this.endTurn();
      return this.resolve();
    }
    if (this.phase === 'expose' && this.awaiting === i) {
      const next = this.afterExpose!;
      this.afterExpose = null;
      next();
    }
  }

  automaticMove(): (() => void) | undefined {
    if (this.phase === 'game-over' || this.phase === 'reveal' || !this.humansPresent) return;
    const automated = (i: number) => this.seats[i].bot || !this.seats[i].connected;
    if (this.window) {
      const window = this.window;
      const pending = [...window.eligible].filter((i) => !window.passed.has(i) && automated(i));
      if (!pending.length) return;
      return () => {
        for (const i of pending) {
          if (this.window !== window) return;
          const choice = this.windowChoice(i);
          if (choice === 'challenge') this.respond(i, window.id, 'challenge');
          else if (choice) this.respond(i, window.id, 'block', choice);
          else this.respond(i, window.id, 'pass');
        }
      };
    }
    const i = this.awaiting;
    if (i === null || !automated(i)) return;
    return () => this.act(this.seats[i].id, this.privateChoice(i));
  }

  private chance(percent: number) {
    return this.random(100) < percent;
  }

  private danger(i: number) {
    const seat = this.seats[i];
    return this.hidden(seat).length * 10 + seat.coins;
  }

  /** Every copy of a character is visible to this seat. */
  private impossible(i: number, character: Character) {
    const mine = this.hidden(this.seats[i]).filter((card) => card.character === character).length;
    const shown = this.seats.flatMap(({ hand }) => hand).filter((card) => card.exposed && card.character === character).length;
    return mine + shown >= 3;
  }

  private windowChoice(i: number): 'challenge' | Character | null {
    const seat = this.seats[i];
    const turn = this.turn!;
    const honest = !seat.bot;
    const window = this.window!;
    if (window.kind === 'block') {
      const options = BLOCKERS[turn.action] ?? [];
      const held = options.find((character) => this.holds(seat, character));
      if (held) return held;
      if (honest) return null;
      if (turn.action === 'assassinate' && this.hidden(seat).length === 1 && this.chance(60)) return 'contessa';
      if (turn.action === 'steal' && seat.coins >= 2 && this.chance(20)) return 'captain';
      return null;
    }
    if (honest) return null;
    const claim = window.kind === 'challenge-action' ? CLAIM[turn.action]! : turn.block!.character;
    if (this.impossible(i, claim)) return 'challenge';
    if (window.kind === 'challenge-action' && turn.target === i && this.hidden(seat).length === 1 && turn.action === 'assassinate' &&
      !this.holds(seat, 'contessa')) return this.chance(70) ? 'challenge' : null;
    return this.chance(window.kind === 'challenge-block' && turn.actor === i ? 15 : 10) ? 'challenge' : null;
  }

  private privateChoice(i: number): CoupActionMsg {
    const seat = this.seats[i];
    const honest = !seat.bot;
    const hidden = seat.hand.map((card, at) => ({ ...card, at })).filter(({ exposed }) => !exposed);
    const lowest = () => [...hidden].sort((a, b) => CARD_VALUE[a.character] - CARD_VALUE[b.character])[0].at;
    switch (this.phase) {
      case 'answer-challenge':
        return this.holds(seat, this.claimOf(this.turn!)) ? { type: 'prove' } : { type: 'expose', index: lowest() };
      case 'expose':
        return { type: 'expose', index: lowest() };
      case 'exchange': {
        const options = this.exchangeOptions!;
        const ranked = options.map((character, at) => ({ character, at })).sort((a, b) => CARD_VALUE[b.character] - CARD_VALUE[a.character]);
        const kept: number[] = [];
        for (const option of ranked) {
          if (kept.length === hidden.length) break;
          if (kept.some((at) => options[at] === option.character) && ranked.length - kept.length > hidden.length - kept.length) continue;
          kept.push(option.at);
        }
        for (const option of ranked) if (kept.length < hidden.length && !kept.includes(option.at)) kept.push(option.at);
        return { type: 'keep', indices: kept };
      }
      default: return this.turnChoice(i, honest);
    }
  }

  private turnChoice(i: number, honest: boolean): CoupActionMsg {
    const seat = this.seats[i];
    const others = this.alive().filter((other) => other !== i).sort((a, b) => this.danger(b) - this.danger(a));
    const target = this.seats[others[0]].id;
    if (seat.coins >= FORCED_COUP || (seat.coins >= 7 && (honest || this.chance(90)))) return { type: 'declare', action: 'coup', targetId: target };
    if (honest) return { type: 'declare', action: this.holds(seat, 'duke') ? 'tax' : 'income' };
    if (this.holds(seat, 'assassin') && seat.coins >= 3) return { type: 'declare', action: 'assassinate', targetId: target };
    if (this.holds(seat, 'duke')) return { type: 'declare', action: 'tax' };
    const rich = others.filter((other) => this.seats[other].coins >= 2).sort((a, b) => this.seats[b].coins - this.seats[a].coins);
    if (this.holds(seat, 'captain') && rich.length) return { type: 'declare', action: 'steal', targetId: this.seats[rich[0]].id };
    const hand = this.hidden(seat).map(({ character }) => character);
    if (this.holds(seat, 'ambassador') && (new Set(hand).size < hand.length || hand.includes('ambassador'))) {
      return { type: 'declare', action: 'exchange' };
    }
    if (this.chance(30)) return { type: 'declare', action: 'tax' };
    return { type: 'declare', action: this.chance(50) ? 'foreign-aid' : 'income' };
  }

  view(playerId?: string): CoupView {
    const at = playerId === undefined ? -1 : this.index(playerId);
    const me = at >= 0 ? this.seats[at] : null;
    const turn = this.turn;
    const window = this.window;
    const claimant = window && turn ? (window.kind === 'challenge-action' ? turn.actor : window.kind === 'challenge-block' ? turn.block!.blocker : null) : null;
    const claim = window && turn ? (window.kind === 'challenge-action' ? CLAIM[turn.action]! : window.kind === 'challenge-block' ? turn.block!.character : null) : null;
    const canRespond = !!me && !!window && !me.out && window.eligible.has(at) && !window.passed.has(at);
    const playing = this.phase !== 'game-over';
    return {
      phase: this.phase,
      turnNumber: this.turnNumber,
      actorId: playing ? this.seats[this.active].id : null,
      awaitingId: this.awaiting === null || !playing ? null : this.seats[this.awaiting].id,
      players: this.seats.map((seat, i) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, seat: i, coins: seat.coins,
        hiddenCount: this.hidden(seat).length, exposed: seat.hand.filter(({ exposed }) => exposed).map(({ character }) => character), out: seat.out,
      })),
      deckCount: this.deck.length,
      pending: turn ? {
        action: turn.action, targetId: turn.target === null ? null : this.seats[turn.target].id, claim: CLAIM[turn.action] ?? null, paid: turn.paid,
        challenge: turn.challenge && {
          challengerId: this.seats[turn.challenge.challenger].id, claimantId: this.seats[turn.challenge.claimant].id, about: turn.challenge.about,
        },
        block: turn.block && { blockerId: this.seats[turn.block.blocker].id, character: turn.block.character },
      } : null,
      window: window ? {
        id: window.id, kind: window.kind, claimantId: claimant === null ? null : this.seats[claimant].id, claim,
        eligibleIds: [...window.eligible].map((i) => this.seats[i].id), passedIds: [...window.passed].map((i) => this.seats[i].id),
        endsInMs: window.deadlineAt === null ? null : Math.max(0, window.deadlineAt - GRACE_MS - this.now()),
      } : null,
      reveal: this.reveal && { ...this.reveal },
      log: this.log.map((entry) => ({ ...entry })),
      winnerId: this.winnerId,
      outOrder: [...this.outOrder],
      me: me && {
        hand: me.hand.map((card) => ({ ...card })),
        actions: playing && this.phase === 'choose-action' && at === this.active ? this.legalActions(at) : [],
        mustCoup: this.phase === 'choose-action' && at === this.active && this.turnStartCoins >= FORCED_COUP,
        respond: canRespond ? {
          challenge: window.kind !== 'block',
          blocks: window.kind === 'block' ? (BLOCKERS[turn!.action] ?? []).map((character) => ({ character, bluff: !this.holds(me, character) })) : [],
        } : null,
        canProve: this.phase === 'answer-challenge' && turn?.challenge?.claimant === at && this.holds(me, this.claimOf(turn)),
        canExpose: (this.phase === 'answer-challenge' && turn?.challenge?.claimant === at) || (this.phase === 'expose' && this.awaiting === at),
        exchangeOptions: this.phase === 'exchange' && this.awaiting === at ? [...this.exchangeOptions!] : null,
        keepCount: this.phase === 'exchange' && this.awaiting === at ? this.hidden(me).length : 0,
      },
    };
  }
}
