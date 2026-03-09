import type { LiarsDiceGameState, Bid } from '../../types/game.js';

export type AIDecision =
  | { action: 'bid'; quantity: number; faceValue: number }
  | { action: 'challenge' }
  | { action: 'spot-on' };

export class AIStrategy {
  /**
   * Decide what to do on the AI's turn.
   *
   * Core probability: with wild ones, each die has a 2/6 (1/3) chance of matching
   * any non-1 face value (the face itself + wild 1). For 1s, it's 1/6.
   */
  decide(state: LiarsDiceGameState): AIDecision {
    const me = state.players[state.activePlayerIndex];
    const myDice = me.dice;
    const totalDice = state.totalDiceInPlay;
    const currentBid = state.currentBid;

    // Opening bid — no current bid
    if (!currentBid) {
      return this.makeOpeningBid(myDice, totalDice, state.wildOnes);
    }

    const bidFace = currentBid.faceValue;
    const bidQty = currentBid.quantity;

    // Count how many of the bid face I have (including wilds)
    const myCount = this.countMyMatching(myDice, bidFace, state.wildOnes);

    // Estimate total matching dice across all players
    const otherDice = totalDice - myDice.length;
    const expectedFromOthers = this.expectedCount(otherDice, bidFace, state.wildOnes);
    const estimatedTotal = myCount + expectedFromOthers;

    // How "over" the bid is compared to our estimate
    const overRatio = bidQty / Math.max(estimatedTotal, 0.5);

    // Challenge if bid seems very unlikely
    if (overRatio > 1.5) {
      return { action: 'challenge' };
    }

    // Aggressive challenge when bid is moderately over and we have few matching
    if (overRatio > 1.2 && myCount <= 1) {
      return { action: 'challenge' };
    }

    // Spot-on if bid is very close to estimate and enabled
    if (
      state.spotOnEnabled &&
      Math.abs(bidQty - estimatedTotal) < 0.5 &&
      bidQty <= totalDice / 2 &&
      Math.random() < 0.15
    ) {
      return { action: 'spot-on' };
    }

    // Otherwise, raise the bid
    return this.makeRaiseBid(currentBid, myDice, totalDice, state.wildOnes);
  }

  /**
   * Make an opening bid based on our dice.
   * Bid on our most common face (including wilds), with a slight bluff.
   */
  private makeOpeningBid(
    myDice: number[],
    totalDice: number,
    wildOnes: boolean,
  ): AIDecision {
    // Count each face in our hand (including wild 1s for non-1 faces)
    let bestFace = 2;
    let bestCount = 0;

    for (let face = 2; face <= 6; face++) {
      const count = this.countMyMatching(myDice, face, wildOnes);
      if (count > bestCount) {
        bestCount = count;
        bestFace = face;
      }
    }

    // Bid our count + a small bluff based on how many other dice are out there
    const otherDice = totalDice - myDice.length;
    const expectedOthers = this.expectedCount(otherDice, bestFace, wildOnes);
    const bluffAmount = Math.floor(expectedOthers * (0.3 + Math.random() * 0.4));
    const quantity = Math.max(1, bestCount + bluffAmount);

    return { action: 'bid', quantity, faceValue: bestFace };
  }

  /**
   * Raise the current bid minimally, preferring faces we hold.
   */
  private makeRaiseBid(
    currentBid: Bid,
    myDice: number[],
    totalDice: number,
    wildOnes: boolean,
  ): AIDecision {
    // Try raising face value first (same quantity, higher face)
    if (currentBid.faceValue < 6) {
      // Find the best face above the current one that we hold
      for (let face = currentBid.faceValue + 1; face <= 6; face++) {
        const myCount = this.countMyMatching(myDice, face, wildOnes);
        if (myCount >= 1) {
          return {
            action: 'bid',
            quantity: currentBid.quantity,
            faceValue: face,
          };
        }
      }

      // No good face — just raise to next face
      return {
        action: 'bid',
        quantity: currentBid.quantity,
        faceValue: currentBid.faceValue + 1,
      };
    }

    // At face 6, must increase quantity
    // Pick the face we have the most of
    let bestFace = 2;
    let bestCount = 0;
    for (let face = 2; face <= 6; face++) {
      const count = this.countMyMatching(myDice, face, wildOnes);
      if (count > bestCount) {
        bestCount = count;
        bestFace = face;
      }
    }

    const newQty = currentBid.quantity + 1;

    // If the new bid seems too risky, challenge instead
    const estimatedTotal =
      bestCount + this.expectedCount(totalDice - myDice.length, bestFace, wildOnes);
    if (newQty > estimatedTotal * 1.4) {
      return { action: 'challenge' };
    }

    return { action: 'bid', quantity: newQty, faceValue: bestFace };
  }

  /** Count how many of my dice match a face value (with wild ones). */
  countMyMatching(myDice: number[], faceValue: number, wildOnes: boolean): number {
    let count = 0;
    for (const die of myDice) {
      if (die === faceValue) count++;
      else if (wildOnes && die === 1 && faceValue !== 1) count++;
    }
    return count;
  }

  /** Expected count of matching dice from N unknown dice. */
  expectedCount(numDice: number, faceValue: number, wildOnes: boolean): number {
    if (faceValue === 1 || !wildOnes) {
      return numDice / 6;
    }
    // Non-1 face with wild ones: 2/6 = 1/3 chance
    return numDice / 3;
  }
}
