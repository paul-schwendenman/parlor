import type {
  Card,
  Suit,
  CrazyEightsPhase,
  CrazyEightsAction,
  CrazyEightsPlayerView,
  CrazyEightsConfig,
} from '../../types/game.js';
import { DEFAULT_CONFIG, SUITS } from '../../types/game.js';
import { createDeck, shuffle } from '../../game/deck.js';
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

  constructor(
    playerInfos: { id: string; name: string }[],
    roomCode: string,
    config: CrazyEightsConfig = DEFAULT_CONFIG,
  ) {
    this.roomCode = roomCode;
    this.config = config;

    const numPlayers = playerInfos.length;
    const cardsPerPlayer = numPlayers >= 5 ? 5 : 7;

    let deck = shuffle(createDeck());

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
      throw new Error('Cannot play card outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    // If player drew a card this turn, they can only play the drawn card
    if (this.drawnThisTurn && this.drewCard) {
      if (!cardEquals(card, this.drewCard)) {
        throw new Error('After drawing, you can only play the drawn card');
      }
    }

    const cardIndex = player.hand.findIndex((c) => cardEquals(c, card));
    if (cardIndex === -1) {
      throw new Error('Card not in hand');
    }

    if (!canPlayCard(card, this.getTopDiscard(), this.declaredSuit)) {
      throw new Error('Cannot play this card');
    }

    // Remove from hand, add to discard
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.declaredSuit = null;

    // Check win
    if (player.hand.length === 0) {
      this.winner = { id: player.id, name: player.name };
      this.phase = 'game-over';
      return;
    }

    // If played an 8, need to choose suit
    if (card.rank === '8') {
      this.phase = 'choosing-suit';
      return;
    }

    this.advanceTurn();
  }

  chooseSuit(playerId: string, suit: Suit): void {
    if (this.phase !== 'choosing-suit') {
      throw new Error('Not in choosing-suit phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (!SUITS.includes(suit)) {
      throw new Error('Invalid suit');
    }

    this.declaredSuit = suit;
    this.advanceTurn();
  }

  drawCard(playerId: string): void {
    if (this.phase !== 'playing') {
      throw new Error('Cannot draw outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (this.drawnThisTurn) {
      throw new Error('Already drew this turn');
    }

    this.ensureDrawPile();

    if (this.drawPile.length === 0) {
      // No cards to draw even after reshuffle — check for stalemate
      this.checkStalemate();
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
      throw new Error('Cannot pass outside of playing phase');
    }

    const player = this.getActivePlayer();
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (!this.drawnThisTurn) {
      throw new Error('Must draw before passing');
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

    const activePlayer = this.getActivePlayer();
    if (activePlayer.id !== playerId) return;

    // Auto-action for disconnected active player
    if (this.phase === 'choosing-suit') {
      // Pick a random suit
      const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
      this.chooseSuit(playerId, randomSuit);
    } else if (this.phase === 'playing') {
      if (this.drawnThisTurn) {
        // Already drew, just pass
        this.advanceTurn();
      } else {
        // Draw then pass
        try {
          this.drawCard(playerId);
        } catch {
          // Can't draw — pass/stalemate
        }
        if (this.phase === 'playing' && this.drawnThisTurn) {
          this.advanceTurn();
        }
      }
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
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
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
    this.drawPile = shuffle(toReshuffle);
  }

  private checkStalemate(): void {
    // Check if any player can play
    for (const player of this.players) {
      const playable = getPlayableCards(player.hand, this.getTopDiscard(), this.declaredSuit);
      if (playable.length > 0) return; // Not a stalemate, someone can play
    }

    // True stalemate — fewest cards wins
    let minCards = Infinity;
    let stalemateWinner: Player | null = null;
    for (const player of this.players) {
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
