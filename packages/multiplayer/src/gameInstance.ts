import { randomUUID } from 'node:crypto';
import { logServerError } from './observability.js';
import { runWithTimeout } from './gameTimeout.js';

type Timer = ReturnType<typeof setTimeout>;
type GameTask = () => void | Promise<void>;

export class GameInstance {
  readonly id = randomUUID();
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private readonly timers = new Map<Timer, string | undefined>();
  private readonly slots = new Map<string, Timer>();

  constructor(private readonly onFailure: (error: unknown) => void) {}

  isCurrent(): boolean {
    return !this.signal.aborted;
  }

  schedule(task: GameTask, ms: number, slot?: string): Timer | undefined {
    if (!this.isCurrent()) return undefined;
    if (slot !== undefined) this.cancel(slot);

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (slot !== undefined) this.slots.delete(slot);
      if (!this.isCurrent()) return;
      try {
        const work = task();
        if (work) void work.catch((error: unknown) => this.fail(error));
      } catch (error) {
        this.fail(error);
      }
    }, ms);
    this.timers.set(timer, slot);
    if (slot !== undefined) this.slots.set(slot, timer);
    return timer;
  }

  cancel(timerOrSlot: Timer | string | undefined): void {
    const timer = typeof timerOrSlot === 'string' ? this.slots.get(timerOrSlot) : timerOrSlot;
    if (timer === undefined || !this.timers.has(timer)) return;
    const slot = this.timers.get(timer);
    this.timers.delete(timer);
    if (slot !== undefined) this.slots.delete(slot);
    clearTimeout(timer);
  }

  runWithTimeout(operation: (signal: AbortSignal) => Promise<void>, ms: number) {
    return runWithTimeout(this.signal, this, operation, ms);
  }

  emitIfCurrent(emit: () => void): void {
    if (this.isCurrent()) emit();
  }

  invalidate(): void {
    for (const timer of this.timers.keys()) clearTimeout(timer);
    this.timers.clear();
    this.slots.clear();
    this.controller.abort();
  }

  private fail(error: unknown): void {
    if (!this.isCurrent()) return;
    try {
      this.onFailure(error);
    } catch (failureError) {
      logServerError('game_failure_handler_failed', { instanceId: this.id }, failureError);
    }
  }
}
