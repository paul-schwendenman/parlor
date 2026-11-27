import { inspect } from 'node:util';

const metrics = {
  rooms: 0,
  sockets: 0,
  gamesStarted: 0,
  rejectedActions: 0,
  caughtRoomFailures: 0,
};

export function recordMetric(metric: keyof typeof metrics, change = 1): void {
  metrics[metric] += change;
}

export function getMetrics() {
  return { ...metrics };
}

export interface ErrorLogContext {
  roomCode?: string;
  gameId?: string | null;
  playerId?: string;
  instanceId?: string;
  [key: string]: unknown;
}

export function logServerError(event: string, context: ErrorLogContext, error: unknown): void {
  const detail = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause === undefined ? undefined : inspect(error.cause, { customInspect: false }),
      }
    : { message: inspect(error, { customInspect: false }) };
  console.error(JSON.stringify({
    ...context,
    level: 'error',
    event,
    time: new Date().toISOString(),
    roomCode: context.roomCode ?? null,
    gameId: context.gameId ?? null,
    playerId: context.playerId ?? null,
    instanceId: context.instanceId ?? null,
    error: detail,
  }));
}
