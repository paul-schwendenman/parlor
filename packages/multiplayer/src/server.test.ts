import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import {
  parseCorsOrigin,
  buildSocketServerOptions,
  createOriginCheck,
  isOriginAllowed,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
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
    expect(opts.allowRequest).toBeUndefined();
    expect(opts.pingInterval).toBe(DEFAULT_PING_INTERVAL);
    expect(opts.pingTimeout).toBe(DEFAULT_PING_TIMEOUT);
    expect(opts.connectionStateRecovery).toBeUndefined();
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
    });
    expect(opts.cors).toEqual({ origin: 'https://explicit.example' });
    expect(opts.pingInterval).toBe(1000);
    expect(opts.pingTimeout).toBe(500);
  });
});

describe('isOriginAllowed', () => {
  it('allows everything with the permissive allowlist', () => {
    expect(isOriginAllowed('https://evil.example', '*')).toBe(true);
    expect(isOriginAllowed(undefined, '*')).toBe(true);
    expect(isOriginAllowed('https://evil.example', ['https://a.example', '*'])).toBe(true);
  });

  it('allows listed origins, ignoring case and a trailing slash', () => {
    expect(isOriginAllowed('https://a.example', 'https://a.example')).toBe(true);
    expect(isOriginAllowed('https://B.example', ['https://a.example', 'https://b.example/'])).toBe(true);
  });

  it('rejects unlisted origins, including the opaque "null" origin', () => {
    expect(isOriginAllowed('https://evil.example', 'https://a.example')).toBe(false);
    expect(isOriginAllowed('http://a.example', 'https://a.example')).toBe(false);
    expect(isOriginAllowed('https://a.example:8443', 'https://a.example')).toBe(false);
    expect(isOriginAllowed('https://a.example.evil.example', 'https://a.example')).toBe(false);
    expect(isOriginAllowed('null', 'https://a.example')).toBe(false);
  });

  it('allows requests with no Origin header (non-browser clients)', () => {
    expect(isOriginAllowed(undefined, 'https://a.example')).toBe(true);
    expect(isOriginAllowed('', 'https://a.example')).toBe(true);
  });
});

describe('createOriginCheck', () => {
  it('reports allowed and rejected handshakes to engine.io', () => {
    const check = createOriginCheck(['https://a.example']);
    const fn = vi.fn();
    check({ headers: { origin: 'https://a.example' } }, fn);
    check({ headers: { origin: 'https://evil.example' } }, fn);
    check({ headers: {} }, fn);
    expect(fn.mock.calls).toEqual([
      [null, true],
      ['Origin not allowed', false],
      [null, true],
    ]);
  });

  it('is installed by buildSocketServerOptions only when an allowlist is configured', () => {
    expect(buildSocketServerOptions({ corsOrigin: '*' }).allowRequest).toBeUndefined();
    expect(buildSocketServerOptions({ corsOrigin: 'https://a.example' }).allowRequest).toBeTypeOf('function');
  });
});

describe('origin check over a real socket.io server (D-06)', () => {
  const ALLOWED = 'https://parlor.example';
  let http: HttpServer;
  let io: Server | undefined;
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await io?.close();
    io = undefined;
  });

  async function startServer(): Promise<string> {
    http = createServer();
    io = new Server(http, buildSocketServerOptions({ corsOrigin: ALLOWED }));
    await new Promise<void>((r) => http.listen(0, r));
    return `http://localhost:${(http.address() as AddressInfo).port}`;
  }

  /** Resolves 'connected' or 'refused' (connect_error) for one client attempt. */
  function attempt(url: string, transport: 'websocket' | 'polling', origin?: string) {
    const client = ioc(url, {
      transports: [transport],
      reconnection: false,
      extraHeaders: origin ? { Origin: origin } : {},
    });
    clients.push(client);
    return new Promise<'connected' | 'refused'>((resolve) => {
      client.on('connect', () => resolve('connected'));
      client.on('connect_error', () => resolve('refused'));
    });
  }

  it.each(['websocket', 'polling'] as const)(
    'refuses a disallowed Origin and accepts an allowed one (%s)',
    async (transport) => {
      const url = await startServer();
      expect(await attempt(url, transport, 'https://evil.example')).toBe('refused');
      expect(await attempt(url, transport, ALLOWED)).toBe('connected');
      // No Origin header at all (a non-browser client) is allowed by design.
      expect(await attempt(url, transport)).toBe('connected');
    },
  );
});
