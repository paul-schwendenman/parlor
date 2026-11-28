import { GameRuleError } from '@parlor/multiplayer';
import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { displayScore, goodKinds, goods, handSize, picksPerSeason, seasons, type Pick, type Tile } from './rules.js';
import type { MarketAction, MarketPlayer, MarketView } from './types.js';

interface Seat extends Omit<MarketPlayer, 'locked'> {
  hand: Tile[];
  selection: Pick | null;
}

export class NightMarketEngine {
  private readonly players: Seat[];
  private season = 1;
  private pickNumber = 1;
  private phase: MarketView['phase'] = 'draft';
  private revealed: MarketView['revealed'] = [];

  constructor(players: { id: string; name: string; bot: boolean }[], private readonly random: RandomInt = secureRandomInt) {
    this.players = players.map((player) => ({
      ...player, connected: true, coins: 0, stall: [], seasonScores: [], total: 0, hand: [], selection: null,
    }));
    this.deal();
  }

  get revealing() { return this.phase === 'reveal' || this.phase === 'season-end'; }
  get seasonEnd() { return this.phase === 'season-end'; }
  get gameOver() { return this.phase === 'game-over'; }

  setConnected(id: string, connected: boolean) {
    const seat = this.players.find((player) => player.id === id);
    if (seat) seat.connected = connected;
  }

  private deal() {
    const tiles = goodKinds.flatMap((good, kind) => Array.from({ length: 7 }, (_, index) => ({ id: kind * 7 + index, good })));
    const deck = fisherYatesShuffle(tiles, this.random);
    for (const seat of this.players) {
      seat.hand = deck.splice(0, handSize);
      seat.coins = 0;
      seat.stall = [];
      seat.selection = null;
    }
  }

  act(id: string, action: MarketAction) {
    const seat = this.players.find((player) => player.id === id);
    if (!seat || this.phase !== 'draft' || action.season !== this.season || action.pickNumber !== this.pickNumber || seat.selection || !seat.hand.some(({ id }) => id === action.tileId) ||
      (action.use !== 'sell' && action.use !== 'display')) throw new GameRuleError('Choose one good from your current hand.');
    seat.selection = { tileId: action.tileId, use: action.use };
    if (this.players.every((player) => player.selection)) this.reveal();
  }

  private reveal() {
    this.phase = 'reveal';
    this.revealed = this.players.map((seat) => {
      const { tileId, use } = seat.selection!;
      const index = seat.hand.findIndex(({ id }) => id === tileId);
      const [tile] = seat.hand.splice(index, 1);
      if (use === 'sell') seat.coins += goods[tile.good].sale;
      else seat.stall.push(tile);
      seat.selection = null;
      return { playerId: seat.id, tile, use };
    });
  }

  advanceReveal() {
    if (this.phase === 'reveal') {
      this.revealed = [];
      if (this.pickNumber === picksPerSeason) {
        for (const seat of this.players) {
          const points = seat.coins + displayScore(seat.stall);
          seat.seasonScores.push(points);
          seat.total += points;
          seat.hand = [];
        }
        this.phase = 'season-end';
      } else {
        const hands = this.players.map(({ hand }) => hand);
        const delta = this.season % 2 ? -1 : 1;
        this.players.forEach((seat, index) => seat.hand = hands[(index + delta + hands.length) % hands.length]);
        this.pickNumber++;
        this.phase = 'draft';
      }
    } else if (this.phase === 'season-end') {
      if (this.season === seasons) this.phase = 'game-over';
      else {
        this.season++;
        this.pickNumber = 1;
        this.deal();
        this.phase = 'draft';
      }
    }
  }

  automaticMove(): (() => void) | undefined {
    if (this.phase !== 'draft' ||
      (!this.players.every((seat) => seat.bot) && !this.players.some((seat) => seat.connected && !seat.bot))) return;
    const seat = this.players.find((player) => (player.bot || !player.connected) && !player.selection);
    if (!seat) return;
    const prior = displayScore(seat.stall);
    const [best] = seat.hand.flatMap((tile) => {
      const display = displayScore([...seat.stall, tile]) - prior;
      const future = this.pickNumber < picksPerSeason ? (tile.good === 'spice' ? 1 : 1.5) : 0;
      return [
        { tileId: tile.id, use: 'sell' as const, value: goods[tile.good].sale },
        { tileId: tile.id, use: 'display' as const, value: display + future },
      ];
    }).sort((a, b) => b.value - a.value);
    return () => this.act(seat.id, { type: 'pick', season: this.season, pickNumber: this.pickNumber, tileId: best.tileId, use: best.use });
  }

  view(id?: string): MarketView {
    const me = this.players.find((player) => player.id === id);
    const best = Math.max(...this.players.map(({ total }) => total));
    return {
      phase: this.phase, season: this.season, pickNumber: this.pickNumber,
      hand: this.phase === 'draft' ? me?.hand.map((tile) => ({ ...tile })) ?? [] : [],
      selection: me?.selection ? { ...me.selection } : null,
      players: this.players.map(({ id, name, bot, connected, coins, stall, selection, seasonScores, total }) => ({
        id, name, bot, connected, coins, stall: stall.map((tile) => ({ ...tile })), locked: !!selection, seasonScores: [...seasonScores], total,
      })),
      revealed: this.revealed.map((entry) => ({ ...entry, tile: { ...entry.tile } })),
      winnerIds: this.gameOver ? this.players.filter(({ total }) => total === best).map(({ id }) => id) : [],
    };
  }
}
