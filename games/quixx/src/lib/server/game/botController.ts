import type { GameInstance } from '@parlor/multiplayer';
import type { QuixxEngine } from './QuixxEngine.js';
import { chooseBotPhase1Action, chooseBotPhase2Action } from './botStrategy.js';

const BOT_TIMER = 'bot';

function randomDelay(): number {
  return 700 + Math.random() * 500;
}

export function scheduleBotActions(
  instance: GameInstance,
  engine: QuixxEngine,
  broadcastViews: () => void,
): void {
  if (!instance.isCurrent() || engine.isGameOver()) return;
  if (engine.getBotPlayerIds().length === 0) return;

  instance.cancel(BOT_TIMER);
  const phase = engine.getPhase();

  if (phase === 'rolling') {
    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    if (!activePlayer.isBot || engine.shouldAutoRoll()) return;

    instance.schedule(() => {
      if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;
      engine.rollDice();
      broadcastViews();
      scheduleBotActions(instance, engine, broadcastViews);
    }, randomDelay(), BOT_TIMER);
    return;
  }

  if (phase === 'phase1') {
    const botsNeeding = engine.getPlayers().filter((p) => p.isBot && p.phase1Decision === null);
    if (botsNeeding.length === 0) return;

    instance.schedule(() => {
      if (engine.getPhase() !== 'phase1' || engine.isGameOver()) return;

      for (const bot of botsNeeding) {
        if (bot.phase1Decision !== null) continue;
        const action = chooseBotPhase1Action(
          bot.sheet,
          engine.getDice(),
          engine.getLockedRows(),
        );
        engine.submitPhase1(bot.id, action);
      }
      broadcastViews();

      if (engine.allPhase1Submitted()) {
        engine.resolvePhase1();
        broadcastViews();
        if (!engine.isGameOver()) scheduleBotActions(instance, engine, broadcastViews);
      }
    }, randomDelay(), BOT_TIMER);
    return;
  }

  if (phase === 'phase2') {
    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    if (!activePlayer.isBot) return;

    instance.schedule(() => {
      if (engine.getPhase() !== 'phase2' || engine.isGameOver()) return;
      if (engine.getPlayers()[engine.getActivePlayerIndex()] !== activePlayer) return;

      const action = chooseBotPhase2Action(
        activePlayer.sheet,
        engine.getDice(),
        engine.getLockedRows(),
        engine.getRemovedDice(),
      );
      engine.submitPhase2(activePlayer.id, action);

      if (engine.isGameOver()) {
        broadcastViews();
        return;
      }

      engine.advanceTurn();
      broadcastViews();
      if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) {
        // Recheck for bot work after the auto-roll interval.
        instance.schedule(() => scheduleBotActions(instance, engine, broadcastViews), 600, BOT_TIMER);
      } else {
        scheduleBotActions(instance, engine, broadcastViews);
      }
    }, randomDelay(), BOT_TIMER);
  }
}
