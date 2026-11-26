import type { Server as HttpServer } from 'node:http';
import type { Http2SecureServer, Http2Server } from 'node:http2';
import type { Server as HttpsServer } from 'node:https';
import { Server, type ServerOptions } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';

/** Heartbeat: how often the server pings the client. */
export const DEFAULT_PING_INTERVAL = 25_000;
/** Heartbeat: how long the server waits for a pong before dropping the socket. */
export const DEFAULT_PING_TIMEOUT = 20_000;
export const MAX_SOCKET_MESSAGE_BYTES = 16 * 1024;
export const MAX_CONNECTIONS = 256;
export const MAX_CONNECTIONS_PER_IP = 32;
/**
 * Parse a comma-separated CORS allowlist (typically from `process.env.CORS_ORIGIN`).
 * Falls back to `'*'` (permissive) when unset/empty — convenient for dev, but a real
 * allowlist should be provided in production.
 */
export function parseCorsOrigin(value?: string): string | string[] {
  if (!value) return '*';
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) return '*';
  if (origins.length === 1) return origins[0];
  return origins;
}

/** Origins compare as scheme://host[:port]; ignore case and a stray trailing slash. */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Whether a handshake's `Origin` header is allowed by the CORS allowlist.
 *
 * - `'*'` allows everything (the dev fallback when `CORS_ORIGIN` is unset).
 * - A request with **no** `Origin` header is allowed. Browsers always send `Origin`
 *   on WebSocket upgrades and cross-origin requests, so a missing header means a
 *   non-browser client (curl, a bot, a test harness) or a same-origin polling GET.
 *   An origin check can't stop non-browser clients anyway, since they can forge the
 *   header; its job is stopping third-party *pages* from driving visitors' browsers.
 * - Anything else, including the literal `'null'` origin (sandboxed iframes,
 *   `file://`), must match an allowlist entry.
 */
export function isOriginAllowed(origin: string | undefined, allowlist: string | string[]): boolean {
  if (allowsAnyOrigin(allowlist)) return true;
  if (origin === undefined || origin === '') return true;
  const allowed = (Array.isArray(allowlist) ? allowlist : [allowlist]).map(normalizeOrigin);
  return allowed.includes(normalizeOrigin(origin));
}

/** True for the permissive `'*'` allowlist (alone or as one of several entries). */
function allowsAnyOrigin(allowlist: string | string[]): boolean {
  return Array.isArray(allowlist) ? allowlist.some((o) => o.trim() === '*') : allowlist.trim() === '*';
}

/** Engine.io `allowRequest` hook: only the request headers are needed. */
type AllowRequest = (
  req: { headers: { origin?: string | string[] } },
  fn: (err: string | null | undefined, success: boolean) => void,
) => void;

/**
 * Build an engine.io `allowRequest` that rejects handshakes (polling *and* WebSocket)
 * whose `Origin` isn't in the allowlist. Socket.io's `cors` option only adds CORS
 * headers to long-polling responses; it never blocks a WebSocket upgrade, so this is
 * what actually enforces the allowlist (CORE-AUDIT D-06). Rejected polling handshakes
 * get a 403; rejected WebSocket upgrades are aborted with a 400 (engine.io's behaviour).
 */
export function createOriginCheck(allowlist: string | string[]): AllowRequest {
  return (req, fn) => {
    const header = req.headers.origin;
    const origin = Array.isArray(header) ? header[0] : header;
    if (isOriginAllowed(origin, allowlist)) fn(null, true);
    else fn('Origin not allowed', false);
  };
}

export interface SocketServerOptionsInput {
  /** Explicit CORS origin(s). When omitted, read from `CORS_ORIGIN` env (comma-separated). */
  corsOrigin?: string | string[];
  pingInterval?: number;
  pingTimeout?: number;
  maxHttpBufferSize?: number;
}

/**
 * Build the Socket.io server options shared by every Parlor server (the 6 prod
 * `server/index.ts` files and the 6 `vite.config.ts` dev servers). Centralizing
 * this keeps CORS and heartbeats identical everywhere.
 *
 * Reconnects restore seats through the application token handshake. Socket.IO
 * recovery would replay packets for a seat before the current token is validated.
 *
 * When an allowlist is configured, an `allowRequest` origin check is installed too
 * (see `createOriginCheck`). With no allowlist (`'*'`), every origin is accepted, so
 * production must set `CORS_ORIGIN`; a warning is logged if it doesn't.
 */
export function buildSocketServerOptions(input: SocketServerOptionsInput = {}): Partial<ServerOptions> {
  const corsOrigin = input.corsOrigin ?? parseCorsOrigin(process.env.CORS_ORIGIN);
  const permissive = allowsAnyOrigin(corsOrigin);
  if (permissive && process.env.NODE_ENV === 'production') {
    console.warn('[socket] CORS_ORIGIN is not set: accepting socket connections from any origin');
  }
  return {
    cors: { origin: corsOrigin },
    ...(permissive ? {} : { allowRequest: createOriginCheck(corsOrigin) }),
    pingInterval: input.pingInterval ?? DEFAULT_PING_INTERVAL,
    pingTimeout: input.pingTimeout ?? DEFAULT_PING_TIMEOUT,
    maxHttpBufferSize: input.maxHttpBufferSize ?? MAX_SOCKET_MESSAGE_BYTES,
  };
}

/** Minimal shape of an HTTP response, satisfied by both `node:http` and Express. */
interface HealthResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/** Minimal shape of an app router with a `get` route, satisfied by Express. */
interface HealthAppLike {
  get(path: string, handler: (req: unknown, res: HealthResponseLike) => void): unknown;
}

/**
 * Register a lightweight `/healthz` route for k8s liveness/readiness probes. Returns
 * 200 with a small JSON body without invoking the SvelteKit renderer (probing `/`
 * triggers a full SSR render on every check).
 */
export function registerHealthCheck(app: HealthAppLike, path = '/healthz'): void {
  app.get(path, (_req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  });
}

export interface GracefulShutdownOptions {
  io: Pick<Server, 'close'>;
  httpServer: HttpServer;
  /** Force-exit if draining hasn't finished within this window. */
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  logger?: Pick<Console, 'log' | 'error'>;
}

/**
 * Install a SIGTERM/SIGINT handler that gracefully drains the server on deploy:
 * stop accepting new connections, close (disconnect) existing sockets, then exit.
 * Without this, every deploy hard-kills all in-progress games.
 *
 * Returns a disposer that removes the installed signal handlers.
 */
export function setupGracefulShutdown(options: GracefulShutdownOptions): () => void {
  const {
    io,
    httpServer,
    timeoutMs = 10_000,
    signals = ['SIGTERM', 'SIGINT'],
    logger = console,
  } = options;

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`[shutdown] received ${signal}, draining connections`);

    const force = setTimeout(() => {
      logger.error('[shutdown] drain timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);
    (force as { unref?: () => void }).unref?.();

    // io.close disconnects every socket and closes the underlying HTTP server.
    io.close(() => {
      clearTimeout(force);
      logger.log('[shutdown] drained, exiting');
      process.exit(0);
    });
    // Stop accepting new HTTP connections immediately (io.close covers this too,
    // but being explicit closes the listener even if a socket hangs the drain).
    httpServer.close();
  };

  const registered: Array<[NodeJS.Signals, () => void]> = [];
  for (const signal of signals) {
    const handler = () => shutdown(signal);
    process.once(signal, handler);
    registered.push([signal, handler]);
  }

  return () => {
    for (const [signal, handler] of registered) {
      process.off(signal, handler);
    }
  };
}

export interface GameServerOptions {
  httpServer: HttpServer;
  maxPlayersPerRoom?: number;
  corsOrigin?: string | string[];
  callbacks?: LobbyCallbacks;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface SocketServerInput extends SocketServerOptionsInput {
  maxConnections?: number;
  maxConnectionsPerIp?: number;
}

/** Count Engine.IO sessions so caps apply before clients open a Socket.IO namespace. */
export function createSocketServer(
  httpServer: HttpServer | HttpsServer | Http2Server | Http2SecureServer,
  input: SocketServerInput = {},
): AppServer {
  const maxConnections = input.maxConnections ?? MAX_CONNECTIONS;
  const maxConnectionsPerIp = input.maxConnectionsPerIp ?? MAX_CONNECTIONS_PER_IP;
  let active = 0;
  const byIp = new Map<string | undefined, number>();
  const options = buildSocketServerOptions(input);

  function atCapacity(ip: string | undefined): boolean {
    return active >= maxConnections || (byIp.get(ip) ?? 0) >= maxConnectionsPerIp;
  }

  const io: AppServer = new Server(httpServer, {
    ...options,
    allowRequest(req, callback) {
      // Only the direct transport peer is trusted. Forwarded headers are client-controlled.
      if (atCapacity(req.socket.remoteAddress)) {
        callback('Connection limit reached', false);
      } else if (options.allowRequest) {
        options.allowRequest(req, callback);
      } else {
        callback(null, true);
      }
    },
  });
  io.engine.on('connection', (connection) => {
    const ip = connection.remoteAddress;
    // Recheck after Engine.IO has completed its handshake.
    if (atCapacity(ip)) {
      connection.close(true);
      return;
    }
    active++;
    byIp.set(ip, (byIp.get(ip) ?? 0) + 1);
    connection.once('close', () => {
      active--;
      const remaining = (byIp.get(ip) ?? 1) - 1;
      if (remaining === 0) byIp.delete(ip);
      else byIp.set(ip, remaining);
    });
  });
  return io;
}

export function createGameServer(options: GameServerOptions) {
  const { httpServer, corsOrigin, callbacks } = options;
  const io = createSocketServer(httpServer, { corsOrigin });

  const roomManager = new RoomManager();

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);
  });

  return { io, roomManager };
}
