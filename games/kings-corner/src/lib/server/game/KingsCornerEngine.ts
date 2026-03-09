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
import { createDeck, shuffle } from '../../game/deck.js';
import { cardEquals, canPlayCardOnPile, canMovePile, isCornerPosition } from '../../game/validation.js';

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

  constructor(
    playerInfos: { id: string; name: string }[],
    roomCode: string,
    config: KingsCornerConfig = DEFAULT_CONFIG,
  ) {
    this.roomCode = roomCode;
    this.config = config;

    let deck = shuffle(createDeck());

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
      throw new Error('Not in drawing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (this.drawPile.length === 0) {
      throw new Error('Draw pile is empty');
    }

    const drawn = this.drawPile.pop()!;
    player.hand.push(drawn);
    this.phase = 'playing';
  }

  playCard(playerId: string, card: Card, target: PilePosition): void {
    if (this.phase !== 'playing') {
      throw new Error('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    const cardIndex = player.hand.findIndex((c) => cardEquals(c, card));
    if (cardIndex === -1) {
      throw new Error('Card not in hand');
    }

    const pile = this.getPile(target);
    if (!canPlayCardOnPile(card, { position: target, cards: pile }, target)) {
      throw new Error('Cannot play this card on that pile');
    }

    // Remove from hand, add to pile
    player.hand.splice(cardIndex, 1);
    pile.push(card);

    // Check win
    if (player.hand.length === 0) {
      this.winner = { id: player.id, name: player.name };
      this.phase = 'game-over';
    }
  }

  movePile(playerId: string, from: PilePosition, to: PilePosition): void {
    if (this.phase !== 'playing') {
      throw new Error('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (from === to) {
      throw new Error('Cannot move pile onto itself');
    }

    const fromPile = this.getPile(from);
    const toPile = this.getPile(to);

    if (!canMovePile(
      { position: from, cards: fromPile },
      { position: to, cards: toPile },
      to,
    )) {
      throw new Error('Cannot move this pile there');
    }

    // Move all cards from source to destination
    toPile.push(...fromPile);
    fromPile.length = 0;
  }

  endTurn(playerId: string): void {
    if (this.phase !== 'playing') {
      throw new Error('Not in playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    // Check mandatory Kings rule
    if (this.playerMustPlayKing(player)) {
      throw new Error('You must play a King to an open corner before ending your turn');
    }

    this.advanceTurn();
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
      playableCards: [],
      movablePiles: [],
      canEndTurn: false,
      mustPlayKing: false,
    };
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = false;

    if (this.phase === 'game-over') return;

    const activePlayer = this.getActivePlayer();
    if (activePlayer.id !== playerId) return;

    // Auto-action for disconnected active player
    if (this.phase === 'drawing') {
      if (this.drawPile.length > 0) {
        this.drawCard(playerId);
      } else {
        this.phase = 'playing';
      }
    }

    if (this.phase === 'playing') {
      // Play any mandatory Kings first
      this.autoPlayKings(activePlayer);
      this.advanceTurn();
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

  private advanceTurn(): void {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;

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
