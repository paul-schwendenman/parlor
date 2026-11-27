import { aceHighRankValue, type Card } from '@parlor/cards';
import type { RoundScore, TrickPlay } from './types.js';

const TRUMP = 'spades';

export function legalCards(hand: readonly Card[], lead: Card | undefined, spadesBroken: boolean): Card[] {
  if (lead) {
    const following = hand.filter((card) => card.suit === lead.suit);
    return following.length ? following : [...hand];
  }
  if (spadesBroken) return [...hand];

  const nonTrump = hand.filter((card) => card.suit !== TRUMP);
  return nonTrump.length ? nonTrump : [...hand];
}

export function winsAgainst(challenger: Card, best: Card): boolean {
  if (challenger.suit === best.suit) return aceHighRankValue(challenger.rank) > aceHighRankValue(best.rank);
  return challenger.suit === TRUMP;
}

export function winningPlay(trick: readonly TrickPlay[]): TrickPlay | undefined {
  let winner = trick[0];
  for (const play of trick.slice(1)) {
    if (winsAgainst(play.card, winner.card)) winner = play;
  }
  return winner;
}

export function scoreRound(players: readonly { bid: number; tricks: number }[], previousBags: number): RoundScore {
  let bid = 0;
  let tricks = 0;
  let nilPoints = 0;
  for (const player of players) {
    if (player.bid === 0) {
      nilPoints += player.tricks === 0 ? 100 : -100;
    } else {
      bid += player.bid;
      tricks += player.tricks;
    }
  }

  const madeBid = tricks >= bid;
  const bidPoints = (madeBid ? 1 : -1) * bid * 10;
  const bagPoints = madeBid ? tricks - bid : 0;
  const allBags = previousBags + bagPoints;
  const bagPenalty = 0 - Math.floor(allBags / 10) * 100;
  return {
    bidPoints, bagPoints, nilPoints, bagPenalty,
    total: bidPoints + bagPoints + nilPoints + bagPenalty,
    bags: allBags % 10,
  };
}
