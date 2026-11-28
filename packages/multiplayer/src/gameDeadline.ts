import type { GameContext } from './defineGame.js';

interface DeadlineState {
  readonly deadline: number | null;
  expire(): boolean;
}

/** Schedule an absolute deadline on the active game instance. */
export function scheduleGameDeadline<State extends DeadlineState>(
  game: GameContext<State>, key: string, afterExpire?: (game: GameContext<State>) => void,
) {
  game.instance.cancel(key);
  const deadline = game.state.deadline;
  if (deadline === null) return;
  game.instance.schedule(() => {
    if (game.state.expire()) {
      afterExpire?.(game);
      game.broadcast();
    } else {
      scheduleGameDeadline(game, key, afterExpire);
    }
  }, Math.max(1, deadline - Date.now()), key);
}
