import { writeSync } from 'node:fs';
import { inspect } from 'node:util';

/** Stop serving immediately after a fault that escaped the room boundaries. */
export function setupFatalProcessHandlers(): void {
  function fail(event: 'uncaughtException' | 'unhandledRejection', error: unknown, origin?: string): never {
    try {
      // Write synchronously because process.exit does not flush piped stderr.
      const record = {
        level: 'fatal',
        event,
        origin,
        pid: process.pid,
        time: new Date().toISOString(),
        error: inspect(error, { customInspect: false, colors: false }),
      };
      writeSync(2, JSON.stringify(record) + '\n');
    } finally {
      process.exit(1);
    }
  }

  process.once('uncaughtException', (error, origin) => fail('uncaughtException', error, origin));
  process.once('unhandledRejection', (reason: unknown) => fail('unhandledRejection', reason));
}
