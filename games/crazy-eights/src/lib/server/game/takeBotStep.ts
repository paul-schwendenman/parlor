import { SUITS, type Suit } from '../../types/game.js';
import type { CrazyEightsEngine } from './CrazyEightsEngine.js';

export function takeBotStep(engine: CrazyEightsEngine, botId: string): void {
  const view = engine.getPlayerView(botId);
  const suitCounts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
  for (const card of view.myHand) {
    if (card.rank !== '8') suitCounts[card.suit]++;
  }

  if (view.phase === 'choosing-suit') {
    const suit = SUITS.reduce((best, next) => suitCounts[next] > suitCounts[best] ? next : best);
    engine.chooseSuit(botId, suit);
    return;
  }

  // Save wild cards when a regular card is playable. Favor the suit that
  // leaves the bot with the most follow-up cards.
  const regularCard = view.playableCards
    .filter((card) => card.rank !== '8')
    .sort((a, b) => suitCounts[b.suit] - suitCounts[a.suit])[0];
  const card = regularCard ?? view.playableCards[0];
  if (card) {
    engine.playCard(botId, card);
  } else if (view.canDraw) {
    engine.drawCard(botId);
  } else if (view.canPass) {
    engine.pass(botId);
  }
}
