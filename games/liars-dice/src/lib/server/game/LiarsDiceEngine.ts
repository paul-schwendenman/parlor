import { fisherYatesShuffle, secureRandomInt, type RandomInt } from '@parlor/multiplayer/random';
import { isValidBid } from '../../game/bidding.js';
import { appendGameLog, GameRuleError } from '@parlor/multiplayer';
import { MAX_DICE_IN_PLAY } from '../validateAction.js';
import type { LiarsDiceBotView } from '../ai/AIStrategy.js';
import type {
  LiarsDiceGameState,
  LiarsDicePlayer,
  LiarsDicePlayerView,
  Bid,
  ChallengeResult,
  SpotOnResult,
  LogEntry,
} from '../../types/game.js';

export class LiarsDiceEngine {
  private state: LiarsDiceGameState;
  private lastBroadcastLogIndex = 0;

  constructor(
    players: LiarsDicePlayer[],
    roomCode: string,
    private readonly randomInt: RandomInt = secureRandomInt,
  ) {
    // Shuffle player order
    const shuffled = fisherYatesShuffle(players, this.randomInt);

    this.state = {
      roomCode,
      players: shuffled,
      activePlayerIndex: 0,
      phase: 'bidding',
      currentBid: null,
      previousBidderId: null,
      totalDiceInPlay: shuffled.length * 5,
      round: 1,
      gameOver: false,
      winner: null,
      wildOnes: true,
      spotOnEnabled: true,
      revealedDice: null,
      challengeResult: null,
      spotOnResult: null,
      gameLog: [],
      bidHistory: [],
    };

    this.rollAllDice();
    this.addLog(shuffled[0].id, `Round 1 begins. ${shuffled[0].name} starts bidding.`, 'round');
  }

  getState(): LiarsDiceGameState {
    return {
      ...this.state,
      players: this.state.players.map((p) => ({ ...p, dice: [...p.dice] })),
      gameLog: [...this.state.gameLog],
    };
  }

  /**
   * What a bot may see on its turn: its own dice and the public table, built
   * fresh with no other field (CORE-AUDIT D-11 / F-30).
   */
  getBotView(botId: string): LiarsDiceBotView {
    const bot = this.state.players.find((p) => p.id === botId);
    return {
      myDice: bot ? [...bot.dice] : [],
      totalDiceInPlay: this.state.totalDiceInPlay,
      currentBid: this.state.currentBid ? { ...this.state.currentBid } : null,
      wildOnes: this.state.wildOnes,
      spotOnEnabled: this.state.spotOnEnabled,
    };
  }

  /**
   * The stand-in bid for an absent player in their grace window (plan 3.9): the
   * least-penalising legal move. It never challenges or calls spot-on, which
   * would put a die at stake straight away. It is the lowest-quantity legal bid
   * (an opening bid with no bid standing, otherwise the smallest legal raise);
   * at equal quantity a non-1 face is preferred, since with wild ones it also
   * counts the 1s and is the likelier bid to hold. Null only if no legal bid
   * exists below twice the dice in play plus one (never, in practice).
   */
  getStandInBid(): { quantity: number; faceValue: number } | null {
    return this.findLegalBid([2, 3, 4, 5, 6, 1], this.state.totalDiceInPlay * 2 + 1);
  }

  getActivePlayerId(): string {
    return this.state.players[this.state.activePlayerIndex].id;
  }

  /** Track a player's connection (shown in views as `connected`). */
  setConnected(playerId: string, connected: boolean): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player) player.connected = connected;
  }

  isAbsent(playerId: string): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    return !!player && !player.isAI && !player.connected;
  }

  /** A seat still in the game whose player is connected, or a bot. */
  hasPresentPlayer(): boolean {
    return this.state.players.some((p) => !p.eliminated && (p.isAI || p.connected));
  }

  /**
   * A player left for good (plan 3.9): the seat is eliminated, the same way
   * losing its last die eliminates it, so turn order already skips it and the
   * last player standing wins. Their dice leave the table at once.
   */
  forfeit(playerId: string): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.eliminated) return;
    player.connected = false;
    player.diceCount = 0;
    player.dice = [];
    player.eliminated = true;
    this.addLog(playerId, `${player.name} left the game`, 'elimination');
    if (this.state.gameOver) return;

    const alivePlayers = this.state.players.filter((p) => !p.eliminated);
    if (alivePlayers.length <= 1) {
      this.state.winner = alivePlayers[0]?.id ?? null;
      this.state.gameOver = true;
      this.state.phase = 'game-over';
      if (this.state.winner) {
        const winnerPlayer = this.state.players.find((p) => p.id === this.state.winner)!;
        this.addLog(this.state.winner, `${winnerPlayer.name} wins the game!`, 'win');
      }
      return;
    }
    if (this.state.phase === 'bidding' && this.getActivePlayerId() === playerId) this.advanceToNextPlayer();
  }

  getNewLogEntries(): LogEntry[] {
    const entries = this.state.gameLog.slice(this.lastBroadcastLogIndex);
    this.lastBroadcastLogIndex = this.state.gameLog.length;
    return entries;
  }

  getPlayerView(playerId: string): LiarsDicePlayerView {
    const myIndex = this.state.players.findIndex((p) => p.id === playerId);
    const myPlayer = this.state.players[myIndex];
    const isMyTurn = myIndex === this.state.activePlayerIndex;

    return {
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        diceCount: p.diceCount,
        eliminated: p.eliminated,
        isBot: p.isAI,
        dice: this.state.revealedDice ? this.state.revealedDice[p.id] ?? null : null,
      })),
      myDice: myPlayer ? [...myPlayer.dice] : [],
      myIndex,
      activePlayerIndex: this.state.activePlayerIndex,
      phase: this.state.phase,
      currentBid: this.state.currentBid,
      totalDiceInPlay: this.state.totalDiceInPlay,
      minimumBid: isMyTurn && this.state.phase === 'bidding' ? this.getMinimumBid() : null,
      canChallenge: isMyTurn && this.state.phase === 'bidding' && this.state.currentBid !== null,
      canSpotOn:
        isMyTurn &&
        this.state.phase === 'bidding' &&
        this.state.currentBid !== null &&
        this.state.spotOnEnabled,
      revealedDice: this.state.revealedDice,
      actualCount: this.state.challengeResult?.actualCount ?? this.state.spotOnResult?.actualCount ?? null,
      challengeResult: this.state.challengeResult,
      spotOnResult: this.state.spotOnResult,
      round: this.state.round,
      gameOver: this.state.gameOver,
      winner: this.state.winner,
      bidHistory: [...this.state.bidHistory],
      gameLog: [...this.state.gameLog],
      isMyTurn,
    };
  }

  getSpectatorView(): LiarsDicePlayerView {
    return {
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        diceCount: p.diceCount,
        eliminated: p.eliminated,
        isBot: p.isAI,
        dice: this.state.revealedDice ? this.state.revealedDice[p.id] ?? null : null,
      })),
      myDice: [],
      myIndex: -1,
      activePlayerIndex: this.state.activePlayerIndex,
      phase: this.state.phase,
      currentBid: this.state.currentBid,
      totalDiceInPlay: this.state.totalDiceInPlay,
      minimumBid: null,
      canChallenge: false,
      canSpotOn: false,
      revealedDice: this.state.revealedDice,
      actualCount: this.state.challengeResult?.actualCount ?? this.state.spotOnResult?.actualCount ?? null,
      challengeResult: this.state.challengeResult,
      spotOnResult: this.state.spotOnResult,
      round: this.state.round,
      gameOver: this.state.gameOver,
      winner: this.state.winner,
      bidHistory: [...this.state.bidHistory],
      gameLog: [...this.state.gameLog],
      isMyTurn: false,
    };
  }

  placeBid(playerId: string, quantity: number, faceValue: number): void {
    if (this.state.phase !== 'bidding') throw new GameRuleError('Not in bidding phase');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');

    if (faceValue < 1 || faceValue > 6) throw new GameRuleError('Face value must be 1-6');
    if (quantity < 1) throw new GameRuleError('Quantity must be at least 1');

    const newBid: Bid = { playerId, quantity, faceValue };
    if (!this.isValidBid(newBid, this.state.currentBid)) {
      throw new GameRuleError('Bid is not high enough');
    }

    this.state.previousBidderId = this.state.currentBid?.playerId ?? null;
    this.state.currentBid = newBid;
    this.state.bidHistory.push(newBid);

    this.addLog(playerId, `${activePlayer.name} bids ${quantity}x ${faceValue}s`, 'bid');

    this.advanceToNextPlayer();
  }

  challenge(playerId: string): void {
    if (this.state.phase !== 'bidding') throw new GameRuleError('Not in bidding phase');
    if (!this.state.currentBid) throw new GameRuleError('No bid to challenge');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');

    const bid = this.state.currentBid;
    const allDice = this.state.players
      .filter((p) => !p.eliminated)
      .map((p) => p.dice);
    const actualCount = this.countMatchingDice(allDice, bid.faceValue);
    const bidWasCorrect = actualCount >= bid.quantity;
    const loserId = bidWasCorrect ? playerId : bid.playerId;

    // Reveal all dice
    this.state.revealedDice = {};
    for (const p of this.state.players) {
      if (!p.eliminated) {
        this.state.revealedDice[p.id] = [...p.dice];
      }
    }

    this.state.challengeResult = {
      challengerId: playerId,
      bidderId: bid.playerId,
      bidWasCorrect,
      loserId,
      actualCount,
    };
    this.state.phase = 'challenge';

    const challenger = activePlayer;
    const bidder = this.state.players.find((p) => p.id === bid.playerId)!;
    const loser = this.state.players.find((p) => p.id === loserId)!;

    this.addLog(
      playerId,
      `${challenger.name} challenges ${bidder.name}'s bid of ${bid.quantity}x ${bid.faceValue}s! ` +
        `Actual count: ${actualCount}. Bid was ${bidWasCorrect ? 'correct' : 'wrong'}! ` +
        `${loser.name} loses a die.`,
      'challenge',
    );

    // Apply the die loss
    this.removeDie(loserId);
  }

  spotOn(playerId: string): void {
    if (this.state.phase !== 'bidding') throw new GameRuleError('Not in bidding phase');
    if (!this.state.currentBid) throw new GameRuleError('No bid to call spot on');
    if (!this.state.spotOnEnabled) throw new GameRuleError('Spot on is not enabled');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');

    const bid = this.state.currentBid;
    const allDice = this.state.players
      .filter((p) => !p.eliminated)
      .map((p) => p.dice);
    const actualCount = this.countMatchingDice(allDice, bid.faceValue);
    const wasExact = actualCount === bid.quantity;

    // Reveal all dice
    this.state.revealedDice = {};
    for (const p of this.state.players) {
      if (!p.eliminated) {
        this.state.revealedDice[p.id] = [...p.dice];
      }
    }

    const losers: string[] = [];
    if (wasExact) {
      // Everyone else loses a die
      for (const p of this.state.players) {
        if (!p.eliminated && p.id !== playerId) {
          losers.push(p.id);
        }
      }
    } else {
      // Caller loses a die
      losers.push(playerId);
    }

    this.state.spotOnResult = {
      callerId: playerId,
      wasExact,
      actualCount,
      losers,
    };
    this.state.phase = 'spot-on';

    this.addLog(
      playerId,
      `${activePlayer.name} calls Spot On! Bid: ${bid.quantity}x ${bid.faceValue}s. ` +
        `Actual count: ${actualCount}. ${wasExact ? 'Exact! Everyone else loses a die!' : 'Not exact! ' + activePlayer.name + ' loses a die.'}`,
      'spot-on',
    );

    // Apply die losses
    for (const loserId of losers) {
      this.removeDie(loserId);
    }
  }

  /**
   * A player's `nextRound` request. Any player in the game may advance from a
   * reveal, eliminated players included (they still see the reveal); anyone
   * else, or any other phase, is a rule error and changes nothing.
   */
  requestNextRound(playerId: string): void {
    if (!playerId || !this.state.players.some((p) => p.id === playerId)) {
      throw new GameRuleError('Only players in this game can start the next round');
    }
    this.startNextRound();
  }

  /** Advance from a reveal to the next round (server auto-advance path). */
  startNextRound(): void {
    if (this.state.phase !== 'challenge' && this.state.phase !== 'spot-on' && this.state.phase !== 'round-result') {
      throw new GameRuleError('Cannot start next round from this phase');
    }

    if (this.state.gameOver) return;

    // Check for winner
    const alivePlayers = this.state.players.filter((p) => !p.eliminated);
    if (alivePlayers.length <= 1) {
      this.state.winner = alivePlayers[0]?.id ?? null;
      this.state.gameOver = true;
      this.state.phase = 'game-over';
      if (this.state.winner) {
        const winnerPlayer = this.state.players.find((p) => p.id === this.state.winner)!;
        this.addLog(this.state.winner, `${winnerPlayer.name} wins the game!`, 'win');
      }
      return;
    }

    // Find who starts the next round (the loser of the previous challenge/spot-on)
    let starterId: string;
    if (this.state.challengeResult) {
      starterId = this.state.challengeResult.loserId;
    } else if (this.state.spotOnResult) {
      if (this.state.spotOnResult.wasExact) {
        starterId = this.state.spotOnResult.callerId;
      } else {
        starterId = this.state.spotOnResult.callerId;
      }
    } else {
      starterId = this.state.players[this.state.activePlayerIndex].id;
    }

    // If the starter was eliminated, find the next alive player
    const starter = this.state.players.find((p) => p.id === starterId);
    if (!starter || starter.eliminated) {
      const starterIndex = this.state.players.findIndex((p) => p.id === starterId);
      let nextIndex = (starterIndex + 1) % this.state.players.length;
      let attempts = 0;
      while (this.state.players[nextIndex].eliminated && attempts < this.state.players.length) {
        nextIndex = (nextIndex + 1) % this.state.players.length;
        attempts++;
      }
      this.state.activePlayerIndex = nextIndex;
    } else {
      this.state.activePlayerIndex = this.state.players.findIndex((p) => p.id === starterId);
    }

    // Reset round state
    this.state.round++;
    this.state.currentBid = null;
    this.state.previousBidderId = null;
    this.state.revealedDice = null;
    this.state.challengeResult = null;
    this.state.spotOnResult = null;
    this.state.bidHistory = [];
    this.state.totalDiceInPlay = this.state.players
      .filter((p) => !p.eliminated)
      .reduce((sum, p) => sum + p.diceCount, 0);

    // Roll all dice
    this.rollAllDice();
    this.state.phase = 'bidding';

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    this.addLog(activePlayer.id, `Round ${this.state.round} begins. ${activePlayer.name} starts bidding.`, 'round');
  }

  // --- Validation helpers ---

  isValidBid(newBid: Bid, currentBid: Bid | null): boolean {
    return isValidBid(newBid, currentBid, this.state.wildOnes);
  }

  countMatchingDice(allDice: number[][], faceValue: number): number {
    let count = 0;
    for (const playerDice of allDice) {
      for (const die of playerDice) {
        if (die === faceValue) count++;
        else if (this.state.wildOnes && die === 1 && faceValue !== 1) count++;
      }
    }
    return count;
  }

  getMinimumBid(): { quantity: number; faceValue: number } | null {
    const current = this.state.currentBid;
    if (!current) return { quantity: 1, faceValue: 1 };

    const next = current.faceValue < 6
      ? { quantity: current.quantity, faceValue: current.faceValue + 1 }
      : { quantity: current.quantity + 1, faceValue: 1 };
    if (next.quantity <= MAX_DICE_IN_PLAY && this.isValidBid({ playerId: '', ...next }, current)) {
      return next;
    }

    return this.findLegalBid([1, 2, 3, 4, 5, 6], MAX_DICE_IN_PLAY);
  }

  // --- Private helpers ---

  private findLegalBid(faces: number[], maxQuantity: number): { quantity: number; faceValue: number } | null {
    for (let quantity = 1; quantity <= maxQuantity; quantity++) {
      for (const faceValue of faces) {
        if (this.isValidBid({ playerId: '', quantity, faceValue }, this.state.currentBid)) {
          return { quantity, faceValue };
        }
      }
    }
    return null;
  }

  private rollAllDice(): void {
    for (const player of this.state.players) {
      if (player.eliminated) continue;
      player.dice = [];
      for (let i = 0; i < player.diceCount; i++) {
        player.dice.push(this.randomInt(6) + 1);
      }
    }
  }

  private advanceToNextPlayer(): void {
    let nextIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    while (this.state.players[nextIndex].eliminated && attempts < this.state.players.length) {
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }
    this.state.activePlayerIndex = nextIndex;
  }

  private removeDie(playerId: string): void {
    const player = this.state.players.find((p) => p.id === playerId);
    // A seat that already left (forfeit) has no die to lose.
    if (!player || player.eliminated) return;

    player.diceCount--;
    if (player.diceCount <= 0) {
      player.diceCount = 0;
      player.eliminated = true;
      player.dice = [];
      this.addLog(playerId, `${player.name} has been eliminated!`, 'elimination');

      // Check for winner
      const alivePlayers = this.state.players.filter((p) => !p.eliminated);
      if (alivePlayers.length <= 1) {
        this.state.winner = alivePlayers[0]?.id ?? null;
        this.state.gameOver = true;
        if (this.state.winner) {
          const winnerPlayer = this.state.players.find((p) => p.id === this.state.winner)!;
          this.addLog(this.state.winner, `${winnerPlayer.name} wins the game!`, 'win');
        }
      }
    }
  }

  private addLog(playerId: string, message: string, type: LogEntry['type']): void {
    this.lastBroadcastLogIndex = appendGameLog(this.state.gameLog, this.lastBroadcastLogIndex, {
      timestamp: Date.now(),
      playerId,
      message,
      type,
    });
  }
}
