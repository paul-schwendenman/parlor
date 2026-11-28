import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { isWord, solve } from './lexicon.js';
import { DICE, findPath, MIN_LENGTH, normalise, points } from './rules.js';
import type { BoggleAction, BoggleResult, BoggleView } from './types.js';

export const ROUNDS = 3;
const PLAY_MS = 180_000;
const REVEAL_MS = 15_000;

interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  removed: boolean;
  done: boolean;
  /** Word -> when it was found (bots find theirs over the round). */
  words: Map<string, number>;
  roundScore: number;
  score: number;
}

export interface BoggleOptions { rounds: number; playMs: number }

export class BoggleEngine {
  private readonly seats: Seat[];
  private readonly options: BoggleOptions;
  private phase: BoggleView['phase'] = 'playing';
  private round = 0;
  private grid: string[] = [];
  private solutions: string[] = [];
  private results: BoggleResult[] = [];
  private startedAt = 0;
  private winnerIds: string[] = [];
  deadline = 0;

  constructor(
    players: Pick<Seat, 'id' | 'name' | 'bot'>[],
    private readonly random: RandomInt = secureRandomInt,
    private readonly now: () => number = Date.now,
    options: Partial<BoggleOptions> = {},
  ) {
    if (players.length < 2 || players.length > 8) throw new GameRuleError('Boggle needs 2 to 8 players.');
    this.options = { rounds: ROUNDS, playMs: PLAY_MS, ...options };
    this.seats = players.map((player) => ({
      ...player, connected: true, removed: false, done: false, words: new Map(), roundScore: 0, score: 0,
    }));
    this.startRound();
  }

  get gameOver() { return this.phase === 'game-over'; }

  /** Test hook: set the grid (16 faces, Q for Qu). */
  rig(grid: string[]) {
    this.grid = [...grid];
    this.solutions = solve(this.grid);
    this.planBots();
  }

  private startRound() {
    this.round++;
    this.grid = fisherYatesShuffle(DICE, this.random).map((die) => die[this.random(6)]);
    this.solutions = solve(this.grid);
    this.phase = 'playing';
    this.startedAt = this.now();
    this.deadline = this.startedAt + this.options.playMs;
    this.results = [];
    for (const seat of this.seats) {
      seat.words.clear();
      seat.done = seat.removed;
      seat.roundScore = 0;
    }
    this.planBots();
  }

  /** Each bot finds a few of the shorter words (about a casual player's haul), spread over the round. */
  private planBots() {
    const pool = this.solutions.filter((word) => word.length <= 6);
    for (const seat of this.seats.filter(({ bot }) => bot)) {
      seat.words.clear();
      for (const word of fisherYatesShuffle(pool, this.random).slice(0, Math.min(12, Math.ceil(pool.length * 0.08)))) {
        seat.words.set(word, this.startedAt + this.random(this.options.playMs - 5000) + 3000);
      }
    }
  }

  setConnected(id: string, connected: boolean) {
    const seat = this.seats.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  remove(id: string) {
    const seat = this.seats.find((player) => player.id === id);
    if (!seat) return;
    seat.removed = true;
    seat.done = true;
    this.checkDone();
  }

  act(id: string, action: BoggleAction) {
    const seat = this.seats.find((player) => player.id === id);
    if (!seat || seat.removed) throw new GameRuleError('You are not playing this game.');
    if (this.phase !== 'playing' || action.round !== this.round) throw new GameRuleError('Time is up for this grid.');
    if (action.type === 'done') {
      seat.done = action.done;
      this.checkDone();
      return;
    }
    const word = normalise(action.word);
    switch (action.type) {
      case 'submit':
        if (word.length < MIN_LENGTH) throw new GameRuleError(`Words need at least ${MIN_LENGTH} letters.`);
        if (seat.words.has(word)) throw new GameRuleError(`You already have ${word.toUpperCase()}.`);
        if (!findPath(this.grid, word)) throw new GameRuleError(`${word.toUpperCase()} isn’t on the grid.`);
        if (!isWord(word)) throw new GameRuleError(`${word.toUpperCase()} isn’t in the dictionary.`);
        seat.words.set(word, this.now());
        return;
      case 'remove':
        if (!seat.words.delete(word)) throw new GameRuleError('That word isn’t on your list.');
        return;
    }
  }

  private checkDone() {
    if (this.phase === 'playing' && this.seats.every((seat) => seat.bot || seat.done)) this.score();
  }

  /** Moves on when the deadline passes. */
  advance() {
    if (this.now() < this.deadline || this.phase === 'game-over') return;
    if (this.phase === 'playing') return this.score();
    if (this.round >= this.options.rounds) {
      const best = Math.max(...this.seats.map(({ score }) => score));
      this.winnerIds = this.seats.filter(({ score }) => score === best).map(({ id }) => id);
      this.phase = 'game-over';
      return;
    }
    this.startRound();
  }

  private score() {
    const owners = new Map<string, Seat[]>();
    for (const seat of this.seats) {
      for (const word of seat.words.keys()) owners.set(word, [...owners.get(word) ?? [], seat]);
    }
    this.results = [...owners].map(([word, found]) => {
      const value = found.length === 1 ? points(word) : 0;
      if (value) found[0].roundScore += value;
      return { word, playerIds: found.map(({ id }) => id), points: value };
    }).sort((a, b) => b.points - a.points || b.word.length - a.word.length || a.word.localeCompare(b.word));
    for (const seat of this.seats) seat.score += seat.roundScore;
    this.phase = 'reveal';
    this.deadline = this.now() + REVEAL_MS;
  }

  view(playerId?: string): BoggleView {
    const now = this.now();
    const me = this.seats.find(({ id }) => id === playerId);
    const playing = this.phase === 'playing';
    const visible = (seat: Seat) => [...seat.words].filter(([, at]) => !playing || at <= now).map(([word]) => word);
    const found = new Set(this.results.map(({ word }) => word));
    return {
      phase: this.phase,
      round: this.round,
      rounds: this.options.rounds,
      grid: [...this.grid],
      endsInMs: Math.max(0, this.deadline - now),
      players: this.seats.map((seat) => ({
        id: seat.id, name: seat.name, bot: seat.bot, connected: seat.connected, done: seat.done,
        wordCount: visible(seat).length, roundScore: playing ? 0 : seat.roundScore, score: seat.score,
      })),
      results: playing ? [] : this.results.map((result) => ({ ...result, playerIds: [...result.playerIds] })),
      missed: playing ? [] : this.solutions.filter((word) => !found.has(word)).slice(0, 12),
      myWords: me ? visible(me).sort() : [],
      canSubmit: !!me && playing && !me.removed,
      winnerIds: [...this.winnerIds],
    };
  }
}
