import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

const moduleUrl = new URL('./processSafety.ts', import.meta.url).href;

it.each([
  ['uncaughtException', 'setImmediate(() => { throw new Error("escaped exception"); });', 'escaped exception'],
  ['unhandledRejection', 'void Promise.reject(new Error("escaped rejection"));', 'escaped rejection'],
])('logs %s and exits non-zero before continuing', (event, trigger, message) => {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    '--experimental-strip-types',
    '--input-type=module',
    '--eval',
    `
      import { setupFatalProcessHandlers } from ${JSON.stringify(moduleUrl)};
      setupFatalProcessHandlers();
      ${trigger}
      setTimeout(() => console.log('continued serving'), 50);
    `,
  ], { encoding: 'utf8', timeout: 5_000 });

  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(JSON.parse(result.stderr)).toEqual(expect.objectContaining({
    level: 'fatal',
    event,
    pid: expect.any(Number),
    time: expect.any(String),
    error: expect.stringContaining(`Error: ${message}\n    at `),
  }));
});
