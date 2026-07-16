import { afterEach, describe, expect, it } from 'vitest';
import {
  parseCorsOrigin,
  buildSocketServerOptions,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_RECOVERY_DURATION,
} from './server.js';

describe('parseCorsOrigin', () => {
  it('falls back to permissive when unset/empty', () => {
    expect(parseCorsOrigin(undefined)).toBe('*');
    expect(parseCorsOrigin('')).toBe('*');
    expect(parseCorsOrigin('   ')).toBe('*');
    expect(parseCorsOrigin(',, ,')).toBe('*');
  });

  it('returns a single string for one origin', () => {
    expect(parseCorsOrigin('https://parlor.example')).toBe('https://parlor.example');
  });

  it('splits and trims a comma-separated allowlist', () => {
    expect(parseCorsOrigin('https://a.example, https://b.example ,https://c.example')).toEqual([
      'https://a.example',
      'https://b.example',
      'https://c.example',
    ]);
  });

  it('drops empty entries between commas', () => {
    expect(parseCorsOrigin('https://a.example,,https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('buildSocketServerOptions', () => {
  const original = process.env.CORS_ORIGIN;
  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = original;
  });

  it('applies sensible defaults', () => {
    delete process.env.CORS_ORIGIN;
    const opts = buildSocketServerOptions();
    expect(opts.cors).toEqual({ origin: '*' });
    expect(opts.pingInterval).toBe(DEFAULT_PING_INTERVAL);
    expect(opts.pingTimeout).toBe(DEFAULT_PING_TIMEOUT);
    expect(opts.connectionStateRecovery).toEqual({
      maxDisconnectionDuration: DEFAULT_RECOVERY_DURATION,
      skipMiddlewares: true,
    });
  });

  it('reads CORS_ORIGIN from the environment', () => {
    process.env.CORS_ORIGIN = 'https://a.example,https://b.example';
    const opts = buildSocketServerOptions();
    expect(opts.cors).toEqual({ origin: ['https://a.example', 'https://b.example'] });
  });

  it('lets explicit input override env and defaults', () => {
    process.env.CORS_ORIGIN = 'https://ignored.example';
    const opts = buildSocketServerOptions({
      corsOrigin: 'https://explicit.example',
      pingInterval: 1000,
      pingTimeout: 500,
      recoveryDurationMs: 42,
    });
    expect(opts.cors).toEqual({ origin: 'https://explicit.example' });
    expect(opts.pingInterval).toBe(1000);
    expect(opts.pingTimeout).toBe(500);
    expect(opts.connectionStateRecovery?.maxDisconnectionDuration).toBe(42);
  });
});
