import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import {
  BREATH_MS, botDelay, LEVELS_BY_PLAYERS, MAX_LIVES, MAX_STARS, nextReward, REVEAL_MS, rewardFor, startingLives, VOTE_MS,
} from './rules.js';
import type { MindAction, MindEvent, MindPhase, MindView } from './types.js';

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  /** A removed human, now played by the bot logic. */
  standIn: boolean;
  /** Ascending, without cards in flight. */
  hand: number[];
  ready: boolean;
  vote: boolean | null;
  returned: number[];
  jitter: number;
}

interface PendingPlay { playerId: string; card: number; at: number }
export interface MindSettings { settleMs: number }

export class TheMindEngine {
  private readonly seats: Seat[];
  private readonly settings: MindSettings;
  private readonly totalLevels: number;
  private phase: MindPhase = 'focus';
  private phaseEndsAt: number | null = null;
  private level = 0;
  private lives: number;
  private stars = 1;
  private pile: number[] = [];
  private pending: PendingPlay[] = [];
  private stopQueued: { kind: 'stop' | 'star'; by: string } | null = null;
  private clockStartedAt = 0;
  private starVote: { proposerId: string; endsAt: number } | null = null;
  private lastEvent: MindEvent | null = null;
  private outcome: 'won' | 'lost' | null = null;
  private levelsCleared = 0;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    private readonly now: () => number = Date.now,
    settings: Partial<MindSettings> = {},
  ) {
    if (players.length < 2 || players.length > 4) throw new GameRuleError('The Mind needs 2 to 4 players.');
    this.seats = players.map((player) => ({
      ...player, connected: true, standIn: false, hand: [], ready: false, vote: null, returned: [], jitter: 1,
    }));
    this.settings = { settleMs: 150, ...settings };
    this.totalLevels = LEVELS_BY_PLAYERS[players.length];
    this.lives = startingLives(players.length);
    this.deal(1);
  }

  get currentPhase() { return this.phase; }
  get gameOver() { return this.phase === 'game-over'; }

  private automated(seat: Seat) { return seat.bot || seat.standIn; }
  private get humansPresent() { return this.seats.some((seat) => !this.automated(seat) && seat.connected); }
  private find(id: string) { return this.seats.find((seat) => seat.id === id); }
  private get handsEmpty() { return this.seats.every(({ hand }) => !hand.length) && !this.pending.length; }

  private deal(level: number) {
    this.level = level;
    const deck = fisherYatesShuffle(Array.from({ length: 100 }, (_, i) => i + 1), this.random);
    for (const seat of this.seats) {
      seat.hand = deck.splice(0, level).sort((a, b) => a - b);
      seat.returned = [];
    }
    this.pile = [];
    this.enterFocus();
  }

  private enterFocus() {
    this.phase = 'focus';
    this.phaseEndsAt = null;
    this.stopQueued = null;
    this.starVote = null;
    for (const seat of this.seats) {
      seat.ready = this.automated(seat);
      seat.vote = null;
    }
    this.checkReady();
  }

  private checkReady() {
    if (this.phase === 'focus' && this.humansPresent && this.seats.every((seat) => seat.ready && (seat.connected || this.automated(seat)))) {
      this.phase = 'breath';
      this.phaseEndsAt = this.now() + BREATH_MS;
    }
  }

  private restartClock(at: number) {
    this.clockStartedAt = at;
    for (const seat of this.seats) seat.jitter = 0.9 + this.random(21) / 100;
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.find(id);
    if (!seat || seat.connected === connected) return;
    seat.connected = connected;
    if (connected || this.automated(seat)) {
      this.checkReady();
      return;
    }
    // The team waits for a dropped player: back to hands on the table.
    if (this.phase === 'playing' || this.phase === 'breath' || this.phase === 'star-vote') {
      this.returnPending();
      this.enterFocus();
      this.lastEvent = { kind: 'paused', waitingForId: id };
    } else if (this.phase === 'focus') seat.ready = false;
  }

  remove(id: string) {
    const seat = this.find(id);
    if (!seat) return;
    seat.standIn = true;
    seat.connected = false;
    if (this.phase === 'focus') seat.ready = true;
    if (this.phase === 'star-vote' && seat.vote === null) this.castVote(seat, this.botVote());
    this.checkReady();
  }

  private returnPending() {
    for (const play of this.pending) {
      const seat = this.find(play.playerId)!;
      seat.hand = [...seat.hand, play.card].sort((a, b) => a - b);
      seat.returned.push(play.card);
    }
    this.pending = [];
  }

  act(id: string, action: MindAction) {
    const seat = this.find(id);
    if (!seat) throw new GameRuleError('You are not playing this game.');
    if (this.phase === 'game-over') throw new GameRuleError('The game is over.');
    const now = this.now();
    switch (action.type) {
      case 'play':
        if (this.phase !== 'playing' || this.stopQueued) throw new GameRuleError('Play has stopped.');
        if (seat.hand[0] !== action.card) throw new GameRuleError('That card isn’t your lowest any more.');
        seat.hand.shift();
        seat.returned = [];
        this.pending.push({ playerId: id, card: action.card, at: now });
        this.resolve(now);
        return;
      case 'ready':
        if (this.phase !== 'focus') throw new GameRuleError('Play is already under way.');
        seat.ready = action.ready;
        this.checkReady();
        return;
      case 'stop':
        if (this.phase !== 'playing' && this.phase !== 'breath') throw new GameRuleError('Play has already stopped.');
        if (this.stopQueued) throw new GameRuleError('A stop is already on its way.');
        if (this.pending.length) this.stopQueued = { kind: 'stop', by: id };
        else this.stop(id);
        return;
      case 'propose-star':
        if (!['focus', 'playing', 'breath'].includes(this.phase)) throw new GameRuleError('You can’t call for a throwing star right now.');
        if (!this.stars) throw new GameRuleError('There are no throwing stars left.');
        if (this.stopQueued) throw new GameRuleError('A stop is already on its way.');
        if (this.pending.length) this.stopQueued = { kind: 'star', by: id };
        else this.startVote(id, now);
        return;
      case 'vote-star':
        if (this.phase !== 'star-vote') throw new GameRuleError('Nobody has asked for a throwing star.');
        if (seat.vote !== null) throw new GameRuleError('You have already voted.');
        this.castVote(seat, action.agree);
        return;
    }
  }

  private stop(by: string) {
    this.enterFocus();
    this.lastEvent = { kind: 'stop', byId: by };
  }

  private startVote(by: string, now: number) {
    this.phase = 'star-vote';
    this.phaseEndsAt = null;
    this.starVote = { proposerId: by, endsAt: now + VOTE_MS };
    for (const seat of this.seats) seat.vote = seat.id === by ? true : null;
    const agree = this.botVote();
    for (const seat of this.seats) if (seat.vote === null && this.automated(seat)) this.castVote(seat, agree);
    this.settleVote();
  }

  private botVote() {
    return this.lives <= 1 || this.level >= Math.ceil(this.totalLevels / 2);
  }

  private castVote(seat: Seat, agree: boolean) {
    seat.vote = agree;
    this.settleVote();
  }

  private settleVote() {
    if (this.phase !== 'star-vote') return;
    const no = this.seats.find(({ vote }) => vote === false);
    if (no) {
      this.enterFocus();
      this.lastEvent = { kind: 'star-declined', byId: no.id };
      return;
    }
    if (!this.seats.every(({ vote }) => vote)) return;
    this.stars--;
    this.lastEvent = {
      kind: 'star',
      discarded: this.seats.map((seat) => ({ playerId: seat.id, card: seat.hand.shift() ?? null })),
    };
    this.starVote = null;
    this.reveal('star-reveal');
  }

  private reveal(phase: 'mistake' | 'star-reveal' | 'level-complete') {
    this.phase = phase;
    this.phaseEndsAt = this.now() + REVEAL_MS[phase];
  }

  private resolve(now: number) {
    while (this.pending.length) {
      this.pending.sort((a, b) => a.card - b.card);
      const play = this.pending[0];
      const lower = this.seats.some(({ hand }) => hand.some((card) => card < play.card));
      if (!lower) {
        this.pending.shift();
        this.pile.push(play.card);
        this.restartClock(now);
        continue;
      }
      if (now - play.at < this.settings.settleMs) return;
      this.pending.shift();
      this.pile.push(play.card);
      const discarded = this.seats.map((seat) => ({ playerId: seat.id, cards: seat.hand.filter((card) => card < play.card) }))
        .filter(({ cards }) => cards.length);
      for (const seat of this.seats) seat.hand = seat.hand.filter((card) => card >= play.card);
      this.returnPending();
      this.lives = Math.max(0, this.lives - 1);
      this.lastEvent = { kind: 'mistake', playerId: play.playerId, card: play.card, livesLost: 1, discarded };
      this.stopQueued = null;
      this.reveal('mistake');
      return;
    }
    const queued = this.stopQueued;
    this.stopQueued = null;
    if (this.handsEmpty) return this.completeLevel();
    if (queued?.kind === 'stop') this.stop(queued.by);
    else if (queued) this.startVote(queued.by, now);
  }

  private completeLevel() {
    this.levelsCleared++;
    const reward = rewardFor(this.level);
    let wasted = false;
    if (reward === 'life') { wasted = this.lives >= MAX_LIVES; this.lives = Math.min(MAX_LIVES, this.lives + 1); }
    if (reward === 'star') { wasted = this.stars >= MAX_STARS; this.stars = Math.min(MAX_STARS, this.stars + 1); }
    this.lastEvent = { kind: 'level-complete', level: this.level, reward, wasted };
    this.reveal('level-complete');
  }

  /** The earliest time something is due: a breath, a reveal, a vote, a settling play, or a bot's card. */
  nextDeadline(): number | null {
    if (this.phase === 'game-over') return null;
    const times: number[] = [];
    if (this.phaseEndsAt !== null) times.push(this.phaseEndsAt);
    if (this.starVote) times.push(this.starVote.endsAt);
    if (this.pending.length) times.push(Math.min(...this.pending.map(({ at }) => at)) + this.settings.settleMs);
    if (this.phase === 'playing' && !this.stopQueued && this.humansPresent) {
      for (const seat of this.seats) if (this.automated(seat) && seat.hand.length) times.push(this.botPlayAt(seat));
    }
    return times.length ? Math.min(...times) : null;
  }

  private botPlayAt(seat: Seat) {
    const remaining = this.seats.reduce((sum, { hand }) => sum + hand.length, 0);
    return this.clockStartedAt + botDelay(seat.hand[0], this.pile.at(-1) ?? null, remaining, seat.jitter);
  }

  /** Applies everything due by now. */
  tick() {
    const now = this.now();
    if (this.phase === 'breath' && this.phaseEndsAt !== null && now >= this.phaseEndsAt) {
      this.phase = 'playing';
      this.phaseEndsAt = null;
      this.restartClock(now);
    }
    if (this.phase === 'star-vote' && this.starVote && now >= this.starVote.endsAt) {
      this.enterFocus();
      this.lastEvent = { kind: 'star-declined', byId: null };
    }
    if ((this.phase === 'mistake' || this.phase === 'star-reveal' || this.phase === 'level-complete') &&
      this.phaseEndsAt !== null && now >= this.phaseEndsAt) this.endReveal();
    if (this.phase !== 'playing') return;
    if (this.pending.length) this.resolve(now);
    if (this.phase !== 'playing' || this.stopQueued || !this.humansPresent) return;
    const due = this.seats.filter((seat) => this.automated(seat) && seat.hand.length && this.botPlayAt(seat) <= now)
      .sort((a, b) => a.hand[0] - b.hand[0])[0];
    if (due) this.act(due.id, { type: 'play', card: due.hand[0] });
  }

  private endReveal() {
    const phase = this.phase;
    if (phase === 'level-complete') {
      if (this.level >= this.totalLevels) {
        this.outcome = 'won';
        this.phase = 'game-over';
        this.phaseEndsAt = null;
        return;
      }
      this.deal(this.level + 1);
      return;
    }
    if (phase === 'mistake' && this.lives <= 0) {
      this.outcome = 'lost';
      this.phase = 'game-over';
      this.phaseEndsAt = null;
      return;
    }
    if (this.handsEmpty) this.completeLevel();
    else this.enterFocus();
  }

  view(playerId?: string): MindView {
    const me = playerId === undefined ? undefined : this.find(playerId);
    const now = this.now();
    const inFlight = (id: string) => this.pending.filter((play) => play.playerId === id).map(({ card }) => card);
    const active = this.phase !== 'game-over';
    return {
      phase: this.phase,
      phaseEndsInMs: this.phaseEndsAt === null ? null : Math.max(0, this.phaseEndsAt - now),
      level: this.level,
      totalLevels: this.totalLevels,
      lives: this.lives,
      stars: this.stars,
      maxLives: MAX_LIVES,
      maxStars: MAX_STARS,
      nextReward: nextReward(this.level, this.totalLevels),
      pile: { top: this.pile.at(-1) ?? null, count: this.pile.length, recent: this.pile.slice(-4, -1) },
      players: this.seats.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, standIn: seat.standIn,
        cardCount: seat.hand.length + inFlight(seat.id).length, ready: seat.ready,
        vote: this.phase === 'star-vote' && seat.vote !== null ? (seat.vote ? 'yes' : 'no') : null,
      })),
      starVote: this.starVote ? { proposerId: this.starVote.proposerId, endsInMs: Math.max(0, this.starVote.endsAt - now) } : null,
      lastEvent: this.lastEvent,
      outcome: this.outcome,
      levelsCleared: this.levelsCleared,
      myHand: me ? [...me.hand] : [],
      myInFlight: me ? inFlight(me.id) : [],
      myReturned: me ? [...me.returned] : [],
      nextCard: me?.hand[0] ?? null,
      canPlay: !!me && this.phase === 'playing' && !this.stopQueued && me.hand.length > 0,
      canReady: !!me && this.phase === 'focus',
      canStop: !!me && active && (this.phase === 'playing' || this.phase === 'breath') && !this.stopQueued,
      canProposeStar: !!me && ['focus', 'playing', 'breath'].includes(this.phase) && this.stars > 0 && !this.stopQueued,
      canVote: !!me && this.phase === 'star-vote' && me.vote === null,
    };
  }
}
