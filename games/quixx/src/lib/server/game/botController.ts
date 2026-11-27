import type { GameInstance } from '@parlor/multiplayer';
import type { QuixxEngine } from './QuixxEngine.js';
import { chooseBotPhase1Action, chooseBotPhase2Action } from './botStrategy.js';

const BOT_TIMER = 'bot';

function randomDelay(): number {
  return 700 + Math.random() * 500;
}

/**
 * What the bot driver reports back after each move, so the definition can run
 * the same follow-up (phase timers, auto-roll, stand-ins, the next bot move) it
 * runs after a human's move. Each is called after the move has been broadcast.
 */
export interface BotMoveHooks {
  broadcast(): void;
  /** A bot rolled the dice. */
  rolled(): void;
  /** Phase 1 resolved after the bots' submissions (the game is still on). */
  resolved(): void;
  /** A bot finished its phase 2 and the turn moved on (the game is still on). */
  advanced(): void;
}

export function scheduleBotActions(
  instance: GameInstance,
  engine: QuixxEngine,
  hooks: BotMoveHooks,
): void {
  if (!instance.isCurrent() || engine.isGameOver()) return;
  if (engine.getBotPlayerIds().length === 0) return;

  instance.cancel(BOT_TIMER);
  const phase = engine.getPhase();

  if (phase === 'rolling') {
    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    // With auto-roll on, the definition's auto-roll timer rolls for everyone.
    if (!activePlayer.isBot || engine.shouldAutoRoll()) return;

    instance.schedule(() => {
      if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;
      engine.rollDice();
      hooks.broadcast();
      hooks.rolled();
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
      hooks.broadcast();

      if (engine.allPhase1Submitted()) {
        engine.resolvePhase1();
        hooks.broadcast();
        if (!engine.isGameOver()) hooks.resolved();
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
        hooks.broadcast();
        return;
      }

      engine.advanceTurn();
      hooks.broadcast();
      // The next seat may be another bot: the definition auto-rolls and
      // reschedules from here (CORE-AUDIT C-03 / B-04, F-09).
      hooks.advanced();
    }, randomDelay(), BOT_TIMER);
  }
}
