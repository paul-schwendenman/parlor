import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import type {
  Card,
  Suit,
  CrazyEightsPhase,
  CrazyEightsAction,
  CrazyEightsPlayerView,
  CrazyEightsConfig,
} from '../../types/game.js';
import { DEFAULT_CONFIG, SUITS } from '../../types/game.js';
import { createDeck } from '../../game/deck.js';
import { canPlayCard, getPlayableCards, cardEquals } from '../../game/validation.js';

interface Player {
  id: string;
  name: string;
  hand: Card[];
  connected: boolean;
}

export class CrazyEightsEngine {
  private players: Player[];
  private drawPile: Card[];
  private discardPile: Card[];
  private activePlayerIndex = 0;
  private phase: CrazyEightsPhase = 'playing';
  private declaredSuit: Suit | null = null;
  private drawnThisTurn = false;
  private drewCard: Card | null = null;
  private winner: { id: string; name: string } | null = null;
  private roomCode: string;
  private config: CrazyEightsConfig;
  /** Seats whose player left for good: out of the turn order (plan 3.9). */
  private removed = new Set<string>();

  constructor(
    playerInfos: { id: string; name: string }[],
    roomCode: string,
    config: CrazyEightsConfig = DEFAULT_CONFIG,
    private readonly randomInt: RandomInt = secureRandomInt,
  ) {
    this.roomCode = roomCode;
    this.config = config;

    const numPlayers = playerInfos.length;
    const cardsPerPlayer = numPlayers >= 5 ? 5 : 7;

    const deck = fisherYatesShuffle(createDeck(), randomInt);

    this.players = playerInfos.map((p) => ({
      id: p.id,
      name: p.name,
      hand: [],
      connected: true,
    }));

    // Deal cards
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (const player of this.players) {
        player.hand.push(deck.pop()!);
      }
    }

    // Set up discard pile — first non-8 card
    this.discardPile = [];
    let startCardIndex = deck.findIndex((c) => c.rank !== '8');
    if (startCardIndex === -1) {
      // Extremely unlikely: all remaining cards are 8s. Just use the top card.
      startCardIndex = deck.length - 1;
    }
    this.discardPile.push(deck.splice(startCardIndex, 1)[0]);
    this.drawPile = deck;
  }

  getPhase(): CrazyEightsPhase {
    return this.phase;
  }

  getActivePlayerIndex(): number {
    return this.activePlayerIndex;
  }

  getPlayers(): { id: string; name: string; connected: boolean; handSize: number }[] {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      handSize: p.hand.length,
    }));
  }

  isGameOver(): boolean {
    return this.phase === 'game-over';
  }

  getConfig(): CrazyEightsConfig {
    return { ...this.config };
  }

  private getTopDiscard(): Card {
    return this.discardPile[this.discardPile.length - 1];
  }

  playCard(playerId: string, card: Card): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Cannot play card outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    // If player drew a card this turn, they can only play the drawn card
    if (this.drawnThisTurn && this.drewCard) {
      if (!cardEquals(card, this.drewCard)) {
        throw new GameRuleError('After drawing, you can only play the drawn card');
      }
    }

    const cardIndex = player.hand.findIndex((c) => cardEquals(c, card));
    if (cardIndex === -1) {
      throw new GameRuleError('Card not in hand');
    }

    // From here on use the server's own card, never the client's object (CORE-AUDIT A-05).
    const handCard = player.hand[cardIndex];
    if (!canPlayCard(handCard, this.getTopDiscard(), this.declaredSuit)) {
      throw new GameRuleError('Cannot play this card');
    }

    // Remove from hand, add to discard
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(handCard);
    this.declaredSuit = null;

    // Check win
    if (player.hand.length === 0) {
      this.winner = { id: player.id, name: player.name };
      this.phase = 'game-over';
      return;
    }

    // If played an 8, need to choose suit
    if (handCard.rank === '8') {
      this.phase = 'choosing-suit';
      return;
    }

    this.advanceTurn();
  }

  chooseSuit(playerId: string, suit: Suit): void {
    if (this.phase !== 'choosing-suit') {
      throw new GameRuleError('Not in choosing-suit phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    if (!SUITS.includes(suit)) {
      throw new GameRuleError('Invalid suit', 'INVALID_ACTION');
    }

    this.declaredSuit = suit;
    this.advanceTurn();
  }

  drawCard(playerId: string): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Cannot draw outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    if (this.drawnThisTurn) {
      throw new GameRuleError('Already drew this turn');
    }

    this.ensureDrawPile();

    if (this.drawPile.length === 0) {
      // Both piles are exhausted (only the top discard is left). If nobody can
      // play, that is a stalemate; otherwise this player cannot draw, so their
      // turn passes. Before, the turn stayed with them and they could neither
      // draw nor pass, which stalled the game.
      this.checkStalemate();
      if (this.phase === 'playing') this.advanceTurn();
      return;
    }

    const drawn = this.drawPile.pop()!;
    player.hand.push(drawn);
    this.drawnThisTurn = true;
    this.drewCard = drawn;

    // If the drawn card is not playable, auto-advance
    if (!canPlayCard(drawn, this.getTopDiscard(), this.declaredSuit)) {
      this.advanceTurn();
    }
  }

  pass(playerId: string): void {
    if (this.phase !== 'playing') {
      throw new GameRuleError('Cannot pass outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
    }

    if (!this.drawnThisTurn) {
      throw new GameRuleError('Must draw before passing');
    }

    this.advanceTurn();
  }

  getPlayerView(playerId: string): CrazyEightsPlayerView {
    const myIndex = this.players.findIndex((p) => p.id === playerId);
    const isActivePlayer = myIndex === this.activePlayerIndex;
    const myHand = myIndex >= 0 ? [...this.players[myIndex].hand] : [];
    const topDiscard = this.getTopDiscard();

    let playableCards: Card[] = [];
    let canDraw = false;
    let canPass = false;
    let drewCard: Card | null = null;

    if (isActivePlayer && this.phase === 'playing') {
      if (this.drawnThisTurn && this.drewCard) {
        // After drawing, can only play the drawn card if it's legal
        if (canPlayCard(this.drewCard, topDiscard, this.declaredSuit)) {
          playableCards = [this.drewCard];
        }
        canPass = true;
        drewCard = this.drewCard;
      } else {
        playableCards = getPlayableCards(myHand, topDiscard, this.declaredSuit);
        canDraw = true;
      }
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
      topDiscard,
      declaredSuit: this.declaredSuit,
      drawPileCount: this.drawPile.length,
      playableCards,
      canDraw,
      canPass,
      drewCard,
      phase: this.phase,
      winner: this.winner,
      gameOver: this.phase === 'game-over',
    };
  }

  getSpectatorView(): CrazyEightsPlayerView {
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
      topDiscard: this.getTopDiscard(),
      declaredSuit: this.declaredSuit,
      drawPileCount: this.drawPile.length,
      playableCards: [],
      canDraw: false,
      canPass: false,
      drewCard: null,
      phase: this.phase,
      winner: this.winner,
      gameOver: this.phase === 'game-over',
    };
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = false;

    if (this.phase === 'game-over') return;
    if (this.getActivePlayer().id !== playerId) return;
    this.takeAbsentTurn(playerId);
  }

  getActivePlayerId(): string {
    return this.getActivePlayer().id;
  }

  isConnected(playerId: string): boolean {
    return this.players.find((p) => p.id === playerId)?.connected ?? false;
  }

  /** At least one seat still in the game has its player connected. */
  hasConnectedPlayer(): boolean {
    return this.players.some((p) => p.connected && !this.removed.has(p.id));
  }

  /**
   * A player left for good (plan 3.9). Their turn, if it is theirs, gets the
   * disconnect stand-in; then the seat leaves the turn order. With fewer than
   * two seats left the game ends and the last seat wins.
   */
  removePlayer(playerId: string): void {
    if (this.removed.has(playerId) || !this.players.some((p) => p.id === playerId)) return;
    this.handleDisconnect(playerId);
    this.removed.add(playerId);
    if (this.phase === 'game-over') return;

    const remaining = this.players.filter((p) => !this.removed.has(p.id));
    if (remaining.length < 2) {
      const last = remaining[0];
      this.winner = last ? { id: last.id, name: last.name } : null;
      this.phase = 'game-over';
      return;
    }
    if (this.getActivePlayer().id === playerId) this.advanceTurn();
  }

  /**
   * The stand-in turn for an absent active player (disconnected in grace, or
   * leaving). It never penalises the seat: in the suit-choosing phase it picks
   * a suit for the eight they played; otherwise it passes without drawing.
   * Always ends their turn (or the game).
   */
  takeAbsentTurn(playerId: string): void {
    if (this.phase === 'game-over' || this.getActivePlayer().id !== playerId) return;

    if (this.phase === 'choosing-suit') {
      const randomSuit = SUITS[this.randomInt(SUITS.length)];
      this.chooseSuit(playerId, randomSuit);
    } else if (this.phase === 'playing') {
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

  private advanceTurn(): void {
    // Skip seats that have left the game.
    let next = (this.activePlayerIndex + 1) % this.players.length;
    for (let i = 0; i < this.players.length && this.removed.has(this.players[next].id); i++) {
      next = (next + 1) % this.players.length;
    }
    this.activePlayerIndex = next;
    this.drawnThisTurn = false;
    this.drewCard = null;
    this.phase = 'playing';

    // Check stalemate for new player
    const topDiscard = this.getTopDiscard();
    const activePlayer = this.getActivePlayer();
    const playable = getPlayableCards(activePlayer.hand, topDiscard, this.declaredSuit);
    if (playable.length === 0 && this.drawPile.length === 0) {
      this.ensureDrawPile();
      if (this.drawPile.length === 0) {
        this.checkStalemate();
      }
    }
  }

  private ensureDrawPile(): void {
    if (this.drawPile.length > 0) return;
    if (this.discardPile.length <= 1) return;

    // Keep top card, reshuffle rest
    const topCard = this.discardPile.pop()!;
    const toReshuffle = this.discardPile.splice(0);
    this.discardPile = [topCard];
    this.drawPile = fisherYatesShuffle(toReshuffle, this.randomInt);
  }

  private checkStalemate(): void {
    const seated = this.players.filter((p) => !this.removed.has(p.id));

    // Check if any player can play
    for (const player of seated) {
      const playable = getPlayableCards(player.hand, this.getTopDiscard(), this.declaredSuit);
      if (playable.length > 0) return; // Not a stalemate, someone can play
    }

    // True stalemate — fewest cards wins
    let minCards = Infinity;
    let stalemateWinner: Player | null = null;
    for (const player of seated) {
      if (player.hand.length < minCards) {
        minCards = player.hand.length;
        stalemateWinner = player;
      }
    }

    if (stalemateWinner) {
      this.winner = { id: stalemateWinner.id, name: stalemateWinner.name };
    }
    this.phase = 'game-over';
  }
}
