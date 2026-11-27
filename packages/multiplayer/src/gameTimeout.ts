type Timer = ReturnType<typeof setTimeout>;

export interface GameScheduling {
  schedule(fn: () => void, ms: number): Timer | undefined;
  cancel(timer: Timer): void;
}

export type TimedGameWorkResult = 'completed' | 'timed-out' | 'aborted';

/** Abort the operation before resolving the deadline or instance cancellation. */
export async function runWithTimeout(
  parentSignal: AbortSignal,
  scheduler: GameScheduling,
  operation: (signal: AbortSignal) => Promise<void>,
  ms: number,
): Promise<TimedGameWorkResult> {
  if (parentSignal.aborted) return 'aborted';

  const controller = new AbortController();
  let onAbort: (() => void) | undefined;
  let timer: Timer | undefined;
  let outcome: TimedGameWorkResult | undefined;
  const interrupted = new Promise<TimedGameWorkResult>((resolve) => {
    function interrupt(result: 'timed-out' | 'aborted'): void {
      if (outcome) return;
      outcome = result;
      controller.abort();
      resolve(result);
    }
    onAbort = () => interrupt('aborted');
    parentSignal.addEventListener('abort', onAbort, { once: true });
    timer = scheduler.schedule(() => interrupt('timed-out'), ms);
  });

  try {
    return await Promise.race([
      interrupted,
      operation(controller.signal).then(() => outcome ?? 'completed'),
    ]);
  } catch (error) {
    if (outcome) return outcome;
    throw error;
  } finally {
    if (onAbort) parentSignal.removeEventListener('abort', onAbort);
    if (timer !== undefined) scheduler.cancel(timer);
  }
}

const defaultScheduler: GameScheduling = {
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (timer) => clearTimeout(timer),
};

/** Resolve false on cancellation so an AI turn can exit without running its next callback. */
export function abortableDelay(
  ms: number,
  signal?: AbortSignal,
  scheduler = defaultScheduler,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const timer = scheduler.schedule(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    if (timer === undefined) {
      resolve(false);
      return;
    }

    function onAbort(): void {
      if (timer !== undefined) scheduler.cancel(timer);
      resolve(false);
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
