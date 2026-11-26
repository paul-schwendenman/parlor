import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { getMetrics } from './observability.js';
import {
  parseCorsOrigin,
  buildSocketServerOptions,
  createOriginCheck,
  createSocketServer,
  registerHealthCheck,
  type AppServer,
  type SocketServerInput,
  MAX_SOCKET_MESSAGE_BYTES,
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
    expect(opts.maxHttpBufferSize).toBe(MAX_SOCKET_MESSAGE_BYTES);
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
  let io: AppServer | undefined;
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await io?.close();
    io = undefined;
  });

  async function startServer(): Promise<string> {
    http = createServer();
    io = createSocketServer(http, { corsOrigin: ALLOWED });
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

describe('Socket.IO transport limits', () => {
  let io: AppServer | undefined;
  const clients: ClientSocket[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    await io?.close();
    io = undefined;
  });

  async function start(input: SocketServerInput = {}) {
    const http = createServer();
    registerHealthCheck({
      get(path, handler) {
        http.on('request', (req, res) => {
          if (req.url === path) handler(req, res);
          else res.writeHead(404).end();
        });
      },
    });
    const socketServer = createSocketServer(http, { corsOrigin: '*', ...input });
    io = socketServer;
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    return { socketServer, url: `http://127.0.0.1:${(http.address() as AddressInfo).port}` };
  }

  function connect(url: string, transport: 'websocket' | 'polling', headers: Record<string, string> = {}) {
    const client = ioc(url, {
      transports: [transport],
      reconnection: false,
      forceNew: true,
      extraHeaders: headers,
    });
    clients.push(client);
    const connected = new Promise<boolean>((resolve) => {
      client.once('connect', () => resolve(true));
      client.once('connect_error', () => resolve(false));
    });
    return { client, connected };
  }

  it('reports current sockets and process counters in the health response', async () => {
    const { socketServer, url } = await start();
    const before = getMetrics();
    const { client, connected } = connect(url, 'websocket');
    expect(await connected).toBe(true);

    const health = await fetch(`${url}/healthz`);
    expect(health.status).toBe(200);
    expect(health.headers.get('content-type')).toBe('application/json');
    expect(await health.json()).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      metrics: { ...before, sockets: before.sockets + 1 },
    });

    client.disconnect();
    await vi.waitFor(() => expect(socketServer.engine.clientsCount).toBe(0));
    const after = await fetch(`${url}/healthz`);
    expect(await after.json()).toMatchObject({ metrics: before });
  });

  it('counts raw polling sessions toward the total cap before namespace connect', async () => {
    const { socketServer, url } = await start({ maxConnections: 1, maxConnectionsPerIp: 5 });
    const attempt = () => fetch(`${url}/socket.io/?EIO=4&transport=polling`);
    const first = await attempt();
    expect(first.status).toBe(200);
    await first.text();
    expect(socketServer.sockets.sockets.size).toBe(0);
    expect(socketServer.engine.clientsCount).toBe(1);

    const rejected = await attempt();
    expect(rejected.status).toBe(403);
    await rejected.text();
    expect(socketServer.engine.clientsCount).toBe(1);
  });

  it.each(['websocket', 'polling'] as const)(
    'caps sessions per peer, ignores forwarding headers and admits a new session after close (%s)',
    async (transport) => {
      const { socketServer, url } = await start({ maxConnections: 5, maxConnectionsPerIp: 1 });
      const first = connect(url, transport);
      expect(await first.connected).toBe(true);
      const extra = connect(url, transport, { 'X-Forwarded-For': '192.0.2.12' });
      expect(await extra.connected).toBe(false);
      expect(socketServer.sockets.sockets.size).toBe(1);
      first.client.disconnect();
      await vi.waitFor(() => expect(socketServer.engine.clientsCount).toBe(0));

      const next = connect(url, transport);
      expect(await next.connected).toBe(true);
    },
  );

  it.each(['websocket', 'polling'] as const)(
    'drops an oversized message before dispatch and continues handling small messages (%s)',
    async (transport) => {
      const { socketServer, url } = await start();
      const createRoom = vi.fn();
      socketServer.on('connection', (socket) => {
        socket.on('lobby:create', (name, ack) => {
          createRoom(name);
          ack({ roomCode: 'ABCDEF', playerId: 'host', reconnectToken: 'token' });
        });
      });
      const first = connect(url, transport);
      expect(await first.connected).toBe(true);

      const disconnected = new Promise<void>((resolve) => first.client.once('disconnect', () => resolve()));
      first.client.emit('lobby:create', 'x'.repeat(MAX_SOCKET_MESSAGE_BYTES), () => undefined);
      await disconnected;
      expect(createRoom).not.toHaveBeenCalled();

      const next = connect(url, transport);
      expect(await next.connected).toBe(true);
      expect(await next.client.timeout(1_000).emitWithAck('lobby:create', 'Host'))
        .toMatchObject({ roomCode: 'ABCDEF' });
      expect(createRoom).toHaveBeenCalledExactlyOnceWith('Host');
    },
  );
});
