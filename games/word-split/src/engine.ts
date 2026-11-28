import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { isEnglishWord, RACKS } from './lexicon.js';
import type { WordSplitAction, WordSplitView } from './types.js';

export const ROUNDS = 3;
const WRITING_MS = 75_000;
const REVEAL_MS = 12_000;
type Seat = Pick<WordSplitView['players'][number], 'id' | 'name'>;
type Player = WordSplitView['players'][number] & { words: Set<string>; removed: boolean };

export class WordSplitEngine {
  private readonly players: Player[];
  private readonly racks: string[];
  private phase: WordSplitView['phase'] = 'writing';
  private round = 0;
  private letters: string[] = [];
  private results: WordSplitView['results'] = [];
  deadline = 0;

  constructor(
    seats: Seat[],
    private readonly random: RandomInt = secureRandomInt,
    private readonly now = Date.now,
  ) {
    this.players = seats.map((seat) => ({
      ...seat, connected: true, ready: false, score: 0, words: new Set(), removed: false,
    }));
    this.racks = fisherYatesShuffle(RACKS, random);
    this.startRound();
  }

  get gameOver() { return this.phase === 'game-over'; }

  private startRound() {
    this.letters = fisherYatesShuffle([...this.racks[this.round]], this.random);
    this.round++;
    this.phase = 'writing';
    this.deadline = this.now() + WRITING_MS;
    this.results = [];
    for (const player of this.players) {
      player.ready = player.removed;
      player.words.clear();
    }
  }

  private reveal() {
    const owners = new Map<string, Player[]>();
    for (const player of this.players) {
      for (const word of player.words) {
        const matches = owners.get(word);
        if (matches) matches.push(player);
        else owners.set(word, [player]);
      }
    }
    this.results = [...owners].sort(([a], [b]) => a.localeCompare(b)).map(([word, players]) => {
      const points = players.length === 1 ? word.length : 0;
      if (points) players[0].score += points;
      return { word, playerIds: players.map(({ id }) => id), points };
    });
    this.phase = this.round === ROUNDS || this.players.every((player) => player.removed) ? 'game-over' : 'reveal';
    this.deadline = this.gameOver ? 0 : this.now() + REVEAL_MS;
  }

  advance() {
    if (this.gameOver || this.now() < this.deadline) return;
    if (this.phase === 'writing') this.reveal();
    else this.startRound();
  }

  setConnected(id: string, connected: boolean) {
    const player = this.players.find((seat) => seat.id === id);
    if (player && !player.removed) player.connected = connected;
  }

  remove(id: string) {
    const player = this.players.find((seat) => seat.id === id);
    if (!player) return;
    player.connected = false;
    player.removed = true;
    player.ready = true;
    if (this.phase === 'writing' && this.players.every((seat) => seat.ready)) this.reveal();
  }

  act(id: string, action: WordSplitAction) {
    const player = this.players.find((seat) => seat.id === id);
    if (!player || player.ready || this.phase !== 'writing' || this.now() >= this.deadline || action.round !== this.round) {
      throw new GameRuleError('This round is closed for you.');
    }
    if (action.type === 'finish') {
      player.ready = true;
      if (this.players.every((seat) => seat.ready)) this.reveal();
      return;
    }
    const word = action.word.trim().toLowerCase();
    if (!/^[a-z]{3,8}$/.test(word)) throw new GameRuleError('Enter a word with 3 to 8 letters.');
    if (player.words.has(word)) throw new GameRuleError('You already found that word.');
    const tiles = [...this.letters];
    for (const letter of word) {
      const index = tiles.indexOf(letter);
      if (index < 0) throw new GameRuleError('Use each letter tile at most once per word.');
      tiles.splice(index, 1);
    }
    if (!isEnglishWord(word)) throw new GameRuleError('That word is missing from the dictionary.');
    player.words.add(word);
  }

  view(id?: string): WordSplitView {
    const me = this.players.find((player) => player.id === id);
    return {
      phase: this.phase, round: this.round, totalRounds: ROUNDS, letters: [...this.letters], deadline: this.deadline, serverNow: this.now(),
      players: this.players.map(({ id, name, score, ready, connected }) => ({ id, name, score, ready, connected })),
      myWords: me ? [...me.words] : [],
      canWrite: this.phase === 'writing' && !!me && !me.ready,
      results: this.results.map((result) => ({ ...result, playerIds: [...result.playerIds] })),
    };
  }
}
