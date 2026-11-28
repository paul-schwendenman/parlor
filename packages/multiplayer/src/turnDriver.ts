import type { GameContext } from './defineGame.js';

interface AutomatedTurns {
  advanceReveal(): void;
  automaticMove(): (() => void) | undefined;
}

/** Reschedule a game's single pending reveal or automated turn on its instance. */
export function createTurnDriver<State extends AutomatedTurns>(
  key: string,
  botDelay: number,
  revealDelay: (state: State) => number | undefined,
  afterStep?: (game: GameContext<State>) => void,
) {
  function drive(game: GameContext<State>) {
    const { state, instance } = game;
    instance.cancel(key);
    const reveal = revealDelay(state);
    if (reveal === undefined && !state.automaticMove()) return;
    instance.schedule(() => {
      if (reveal === undefined) state.automaticMove()?.();
      else state.advanceReveal();
      afterStep?.(game);
      game.broadcast();
      drive(game);
    }, reveal ?? botDelay, key);
  }
  return drive;
}
