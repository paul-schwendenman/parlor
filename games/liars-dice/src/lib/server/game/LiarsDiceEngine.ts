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

  constructor(players: LiarsDicePlayer[], roomCode: string) {
    // Shuffle player order
    const shuffled = this.shuffle(players);

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
    };
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
    if (this.state.phase !== 'bidding') throw new Error('Not in bidding phase');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new Error('Not your turn');

    if (faceValue < 1 || faceValue > 6) throw new Error('Face value must be 1-6');
    if (quantity < 1) throw new Error('Quantity must be at least 1');

    const newBid: Bid = { playerId, quantity, faceValue };
    if (!this.isValidBid(newBid, this.state.currentBid)) {
      throw new Error('Bid is not high enough');
    }

    this.state.previousBidderId = this.state.currentBid?.playerId ?? null;
    this.state.currentBid = newBid;
    this.state.bidHistory.push(newBid);

    this.addLog(playerId, `${activePlayer.name} bids ${quantity}x ${faceValue}s`, 'bid');

    this.advanceToNextPlayer();
  }

  challenge(playerId: string): void {
    if (this.state.phase !== 'bidding') throw new Error('Not in bidding phase');
    if (!this.state.currentBid) throw new Error('No bid to challenge');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new Error('Not your turn');

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
    if (this.state.phase !== 'bidding') throw new Error('Not in bidding phase');
    if (!this.state.currentBid) throw new Error('No bid to call spot on');
    if (!this.state.spotOnEnabled) throw new Error('Spot on is not enabled');

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer.id !== playerId) throw new Error('Not your turn');

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

  startNextRound(): void {
    if (this.state.phase !== 'challenge' && this.state.phase !== 'spot-on' && this.state.phase !== 'round-result') {
      throw new Error('Cannot start next round from this phase');
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
    if (newBid.faceValue < 1 || newBid.faceValue > 6) return false;
    if (newBid.quantity < 1) return false;

    if (!currentBid) return true;

    if (this.state.wildOnes) {
      // Bidding on 1s from another number: quantity is halved (round up)
      if (newBid.faceValue === 1 && currentBid.faceValue !== 1) {
        return newBid.quantity >= Math.ceil(currentBid.quantity / 2);
      }
      // From 1s to another number: quantity doubled + 1
      if (newBid.faceValue !== 1 && currentBid.faceValue === 1) {
        return newBid.quantity >= currentBid.quantity * 2 + 1;
      }
    }

    // Standard: higher quantity, or same quantity with higher face
    if (newBid.quantity > currentBid.quantity) return true;
    if (newBid.quantity === currentBid.quantity && newBid.faceValue > currentBid.faceValue) return true;
    return false;
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
    if (!this.state.currentBid) {
      return { quantity: 1, faceValue: 1 };
    }

    const current = this.state.currentBid;

    // Try same quantity, next face value
    if (current.faceValue < 6) {
      return { quantity: current.quantity, faceValue: current.faceValue + 1 };
    }

    // Must increase quantity
    return { quantity: current.quantity + 1, faceValue: 1 };
  }

  // --- Private helpers ---

  private rollAllDice(): void {
    for (const player of this.state.players) {
      if (player.eliminated) continue;
      player.dice = [];
      for (let i = 0; i < player.diceCount; i++) {
        player.dice.push(Math.floor(Math.random() * 6) + 1);
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
    if (!player) return;

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
    this.state.gameLog.push({
      timestamp: Date.now(),
      playerId,
      message,
      type,
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
