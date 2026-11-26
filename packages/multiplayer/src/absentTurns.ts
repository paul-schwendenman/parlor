/**
 * Stand-in turns for absent seats (plan 3.9).
 *
 * A seat is absent while its player is disconnected (in the reconnect grace
 * window); removed seats are taken out of the turn order by each engine and are
 * never active. When the turn reaches an absent seat, the game makes the same
 * stand-in move it already makes for a player who disconnects on their own turn,
 * so the table never waits on someone who is not there.
 */
import type { GameContext } from './defineGame.js';

export const ABSENT_TURN_SLOT = 'absent-turn';

export interface AbsentTurnPolicy {
  /** Whose turn it is, or null when nobody in particular is to act (a reveal, game over). */
  activePlayer(): string | null;
  /** True while the seat's player is disconnected. Bots are never absent. */
  isAbsent(playerId: string): boolean;
  /**
   * True if at least one seat still in the game is present (a connected human
   * or a bot). When nobody is, stand-ins pause until someone reconnects, rather
   * than playing the whole game out for an empty table.
   */
  anyonePresent(): boolean;
  /** The stand-in move. It must end the seat's turn or the game. */
  takeTurn(playerId: string): void;
  /** Runs after the stand-in has been broadcast (for example to schedule a bot). */
  afterTurn?(): void;
}

/**
 * If the active seat is absent, schedule its stand-in turn on the game instance.
 * The stand-in re-checks everything when it runs (the player may have come back),
 * broadcasts, and then covers the next seat in the same way.
 */
export function scheduleAbsentTurn<State>(game: GameContext<State>, policy: AbsentTurnPolicy): void {
  const active = policy.activePlayer();
  if (active === null || !policy.isAbsent(active) || !policy.anyonePresent()) return;

  game.instance.schedule(() => {
    if (policy.activePlayer() !== active || !policy.isAbsent(active) || !policy.anyonePresent()) return;
    policy.takeTurn(active);
    game.broadcast();
    policy.afterTurn?.();
    // The stand-in always moves the turn on (or ends the game), so this stops at
    // the first present seat.
    if (policy.activePlayer() !== active) scheduleAbsentTurn(game, policy);
  }, 0, ABSENT_TURN_SLOT);
}
