import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import type {
  Card,
  PilePosition,
  KingsCornerPhase,
  KingsCornerPlayerView,
  KingsCornerConfig,
  PlayableCard,
  MovablePile,
} from '../../types/game.js';
import {
  DEFAULT_CONFIG,
  CARDINAL_POSITIONS,
  CORNER_POSITIONS,
  ALL_POSITIONS,
} from '../../types/game.js';
import { createDeck } from '../../game/deck.js';
import { cardEquals, canPlayCardOnPile, canMovePile } from '../../game/validation.js';

interface Player {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
}

export class KingsCornerEngine {
  private players: Player[];
  private drawPile: Card[];
  private piles: Map<PilePosition, Card[]>;
  private activePlayerIndex = 0;
  private phase: KingsCornerPhase = 'drawing';
  private winner: { id: string; name: string } | null = null;
  private roomCode: string;
  private config: KingsCornerConfig;
  /** Seats whose player left for good: out of the turn order (plan 3.9). */
  private removed = new Set<string>();
  private passed = new Set<string>();
  private turnMadeProgress = false;
  private penalties?: Record<string, number>;

  constructor(
    playerInfos: { id: string; name: string }[],
    roomCode: string,
    config: KingsCornerConfig = DEFAULT_CONFIG,
    randomInt: RandomInt = secureRandomInt,
  ) {
    this.roomCode = roomCode;
    this.config = config;

    const deck = fisherYatesShuffle(createDeck(), randomInt);

    this.players = playerInfos.map((p) => ({
      id: p.id,
      name: p.name,
      hand: [],
      connected: true,
    }));

    // Deal 7 cards to each player
    for (let i = 0; i < 7; i++) {
      for (const player of this.players) {
        player.hand.push(deck.pop()!);
      }
    }

    // Set up piles
    this.piles = new Map<PilePosition, Card[]>();

    // Deal 1 card to each cardinal position
    for (const pos of CARDINAL_POSITIONS) {
      this.piles.set(pos, [deck.pop()!]);
    }

    // Corners start empty
    for (const pos of CORNER_POSITIONS) {
      this.piles.set(pos, []);
    }

    this.drawPile = deck;

    // If draw pile is empty (very unlikely with 2 players), go straight to playing
    if (this.drawPile.length === 0) {
      this.phase = 'playing';
    }
  }

  getPhase(): KingsCornerPhase {
    return this.phase;
  }

  getActivePlayerIndex(): number {
    return this.activePlayerIndex;
  }

  isGameOver(): boolean {
    return this.phase === 'game-over';
  }

  drawCard(playerId: string): void {
    if (this.phase !== 'drawing') {
      throw new GameRuleError('Not in drawing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    if (this.drawPile.length === 0) {
      throw new GameRuleError('Draw pile is empty');
    }

    const drawn = this.drawPile.pop()!;
    player.hand.push(drawn);
    this.recordProgress();
    this.phase = 'playing';
  }

  playCard(playerId: string, card: Card, target: PilePosition): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    const cardIndex = player.hand.findIndex((c) => cardEquals(c, card));
    if (cardIndex === -1) {
      throw new GameRuleError('Card not in hand');
    }

    const pile = this.piles.get(target);
    if (!pile) throw new GameRuleError('Invalid pile', 'INVALID_ACTION');
    // From here on use the server's own card, never the client's object (CORE-AUDIT A-05).
    const handCard = player.hand[cardIndex];
    if (!canPlayCardOnPile(handCard, { position: target, cards: pile }, target)) {
      throw new GameRuleError('Cannot play this card on that pile');
    }

    // Remove from hand, add to pile
    player.hand.splice(cardIndex, 1);
    pile.push(handCard);
    this.recordProgress();

    // Check win
    if (player.hand.length === 0) {
      this.winner = { id: player.id, name: player.name };
      this.phase = 'game-over';
    }
  }

  movePile(playerId: string, from: PilePosition, to: PilePosition): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    if (from === to) {
      throw new GameRuleError('Cannot move pile onto itself');
    }

    const fromPile = this.piles.get(from);
    const toPile = this.piles.get(to);
    if (!fromPile || !toPile) throw new GameRuleError('Invalid pile', 'INVALID_ACTION');

    if (!canMovePile(
      { position: from, cards: fromPile },
      { position: to, cards: toPile },
      to,
    )) {
      throw new GameRuleError('Cannot move this pile there');
    }

    // Move all cards from source to destination
    toPile.push(...fromPile);
    fromPile.length = 0;
    this.recordProgress();
  }

  endTurn(playerId: string): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    // Check mandatory Kings rule
    if (this.playerMustPlayKing(player)) {
      throw new GameRuleError('You must play a King to an open corner before ending your turn');
    }

    this.completeTurn();
  }

  getPlayerView(playerId: string): KingsCornerPlayerView {
    const myIndex = this.players.findIndex((p) => p.id === playerId);
    const isActivePlayer = myIndex === this.activePlayerIndex;
    const myHand = myIndex >= 0 ? [...this.players[myIndex].hand] : [];

    let playableCards: PlayableCard[] = [];
    let movablePiles: MovablePile[] = [];
    let canEndTurn = false;
    let mustPlayKing = false;

    if (isActivePlayer && this.phase === 'playing') {
      playableCards = this.getPlayableCards(myHand);
      movablePiles = this.getMovablePiles();
      const player = this.players[myIndex];
      mustPlayKing = this.playerMustPlayKing(player);
      canEndTurn = !mustPlayKing;
    }

    return {
      myHand,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        connected: p.connected,
        isBot: RoomManager.isBotPlayer(p.id),
      })),
      myIndex,
      activePlayerIndex: this.activePlayerIndex,
      isActivePlayer,
      piles: ALL_POSITIONS.map((pos) => ({
        position: pos,
        cards: [...this.getPile(pos)],
      })),
      drawPileCount: this.drawPile.length,
      phase: this.phase,
      winner: this.winner,
      gameOver: this.phase === 'game-over',
      ...(this.penalties && { penalties: { ...this.penalties } }),
      playableCards,
      movablePiles,
      canEndTurn,
      mustPlayKing,
    };
  }

  getSpectatorView(): KingsCornerPlayerView {
    return {
      myHand: [],
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        connected: p.connected,
        isBot: RoomManager.isBotPlayer(p.id),
      })),
      myIndex: -1,
      activePlayerIndex: this.activePlayerIndex,
      isActivePlayer: false,
      piles: ALL_POSITIONS.map((pos) => ({
        position: pos,
        cards: [...this.getPile(pos)],
      })),
      drawPileCount: this.drawPile.length,
      phase: this.phase,
      winner: this.winner,
      gameOver: this.phase === 'game-over',
      ...(this.penalties && { penalties: { ...this.penalties } }),
      playableCards: [],
      movablePiles: [],
      canEndTurn: false,
      mustPlayKing: false,
    };
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
    this.takeAbsentTurn(playerId);
  }

  /** The id of the seat whose turn it is, in engine seat order. */
  getActivePlayerId(): string {
    return this.getActivePlayer().id;
  }

  isConnected(playerId: string): boolean {
    return this.players.find((p) => p.id === playerId)?.connected ?? false;
  }

  /** At least one seat still in the game is connected (bots always are). */
  hasConnectedPlayer(): boolean {
    return this.players.some((p) => p.connected && !this.removed.has(p.id));
  }

  /**
   * Remove a departing seat from the turn order and impasse scoring.
   * With fewer than two seats left, the last seat wins by forfeit.
   */
  removePlayer(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || this.removed.has(playerId)) return;
    player.connected = false;
    this.removed.add(playerId);
    this.passed.delete(playerId);
    if (this.phase === 'game-over') return;

    const remaining = this.players.filter((p) => !this.removed.has(p.id));
    if (remaining.length < 2) {
      const last = remaining[0];
      this.winner = last ? { id: last.id, name: last.name } : null;
      this.phase = 'game-over';
      return;
    }
    if (this.getActivePlayer().id === playerId) this.advanceTurn();
    this.finishImpasseIfReady();
  }

  /**
   * Stand in for an active seat during disconnect grace. Play mandatory kings
   * and pass without drawing. Always ends their turn (or the game).
   */
  takeAbsentTurn(playerId: string): void {
    if (this.phase === 'game-over') return;
    const activePlayer = this.getActivePlayer();
    if (activePlayer.id !== playerId) return;

    this.phase = 'playing';
    this.autoPlayKings(activePlayer);
    if (this.phase === 'playing') this.completeTurn();
  }

  /**
   * The fallback for a bot that overran its time: draw, play any mandatory
   * kings, and pass if the game is still running.
   */
  takeTimedOutTurn(playerId: string): void {
    if (this.phase === 'game-over') return;
    const activePlayer = this.getActivePlayer();
    if (activePlayer.id !== playerId) return;

    if (this.phase === 'drawing') {
      if (this.drawPile.length > 0) {
        this.drawCard(playerId);
      } else {
        this.phase = 'playing';
      }
    }

    if (this.phase === 'playing') {
      this.autoPlayKings(activePlayer);
      if (this.phase === 'playing') this.completeTurn();
    }
  }

  handleReconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = true;
  }

  private getActivePlayer(): Player {
    return this.players[this.activePlayerIndex];
  }

  private getPile(position: PilePosition): Card[] {
    return this.piles.get(position)!;
  }

  private recordProgress(): void {
    this.turnMadeProgress = true;
    this.passed.clear();
  }

  private completeTurn(): void {
    if (this.drawPile.length === 0 && !this.turnMadeProgress) {
      this.passed.add(this.getActivePlayerId());
      this.finishImpasseIfReady();
    }
    if (!this.isGameOver()) this.advanceTurn();
  }

  private finishImpasseIfReady(): void {
    if (this.drawPile.length > 0) return;
    const remaining = this.players.filter((player) => !this.removed.has(player.id));
    if (!remaining.every((player) => this.passed.has(player.id))) return;

    const penalties = Object.fromEntries(remaining.map(({ id, hand }) => [
      id, hand.reduce((points, card) => points + (card.rank === 'K' ? 10 : 1), 0),
    ]));
    const lowest = Math.min(...Object.values(penalties));
    const leaders = remaining.filter(({ id }) => penalties[id] === lowest);
    this.penalties = penalties;
    this.winner = leaders.length === 1 ? { id: leaders[0].id, name: leaders[0].name } : null;
    this.phase = 'game-over';
  }

  private advanceTurn(): void {
    // Skip seats that have left the game.
    let next = (this.activePlayerIndex + 1) % this.players.length;
    for (let i = 0; i < this.players.length && this.removed.has(this.players[next].id); i++) {
      next = (next + 1) % this.players.length;
    }
    this.activePlayerIndex = next;
    this.turnMadeProgress = false;

    if (this.drawPile.length > 0) {
      this.phase = 'drawing';
    } else {
      this.phase = 'playing';
    }
  }

  private playerMustPlayKing(player: Player): boolean {
    const hasKing = player.hand.some((c) => c.rank === 'K');
    if (!hasKing) return false;

    const hasEmptyCorner = CORNER_POSITIONS.some(
      (pos) => this.getPile(pos).length === 0,
    );
    return hasEmptyCorner;
  }

  private autoPlayKings(player: Player): void {
    let changed = true;
    while (changed) {
      changed = false;
      const kings = player.hand.filter((c) => c.rank === 'K');
      for (const king of kings) {
        const emptyCorner = CORNER_POSITIONS.find(
          (pos) => this.getPile(pos).length === 0,
        );
        if (emptyCorner) {
          const idx = player.hand.findIndex((c) => cardEquals(c, king));
          player.hand.splice(idx, 1);
          this.getPile(emptyCorner).push(king);
          this.recordProgress();
          changed = true;

          if (player.hand.length === 0) {
            this.winner = { id: player.id, name: player.name };
            this.phase = 'game-over';
            return;
          }
        }
      }
    }
  }

  private getPlayableCards(hand: Card[]): PlayableCard[] {
    const result: PlayableCard[] = [];

    for (const card of hand) {
      const validTargets: PilePosition[] = [];
      for (const pos of ALL_POSITIONS) {
        const pile = this.getPile(pos);
        if (canPlayCardOnPile(card, { position: pos, cards: pile }, pos)) {
          validTargets.push(pos);
        }
      }
      if (validTargets.length > 0) {
        result.push({ card, validTargets });
      }
    }

    return result;
  }

  private getMovablePiles(): MovablePile[] {
    const result: MovablePile[] = [];

    for (const fromPos of ALL_POSITIONS) {
      const fromPile = this.getPile(fromPos);
      if (fromPile.length === 0) continue;

      const validTargets: PilePosition[] = [];
      for (const toPos of ALL_POSITIONS) {
        if (fromPos === toPos) continue;
        const toPile = this.getPile(toPos);
        if (canMovePile(
          { position: fromPos, cards: fromPile },
          { position: toPos, cards: toPile },
          toPos,
        )) {
          validTargets.push(toPos);
        }
      }
      if (validTargets.length > 0) {
        result.push({ from: fromPos, validTargets });
      }
    }

    return result;
  }
}
