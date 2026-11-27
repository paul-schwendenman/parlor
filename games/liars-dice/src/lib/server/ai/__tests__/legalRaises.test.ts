import { it, expect } from 'vitest';
import { LiarsDiceEngine } from '../../game/LiarsDiceEngine.js';
import { AIStrategy } from '../AIStrategy.js';
import { createPlayer } from '../../../types/game.js';

// A bot's illegal bid throws inside its scheduled turn, which resets the room
// to the lobby. Raising from a bid on 1s needs double plus one; the strategy
// once answered "one 1" with "one 2".
it('answers a bid on ones with a legal raise or a challenge', () => {
  const illegal: string[] = [];
  for (let trial = 0; trial < 200; trial++) {
    const engine = new LiarsDiceEngine([createPlayer('human', 'H'), createPlayer('bot-b', 'B', true)], 'ROOM');
    const opener = engine.getState().players[engine.getState().activePlayerIndex].id;
    engine.placeBid(opener, 1, 1);
    const state = engine.getState();
    const botId = state.players[state.activePlayerIndex].id;
    if (botId !== 'bot-b') continue;
    const decision = new AIStrategy().decide(engine.getBotView(botId));
    try {
      if (decision.action === 'bid') engine.placeBid(botId, decision.quantity, decision.faceValue);
    } catch (error) {
      illegal.push(`${JSON.stringify(decision)}: ${(error as Error).message}`);
    }
  }
  expect(illegal).toEqual([]);
});
