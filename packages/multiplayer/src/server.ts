import type { Server as HttpServer } from 'node:http';
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
/** connectionStateRecovery window: how long a briefly-dropped socket can recover. */
export const DEFAULT_RECOVERY_DURATION = 2 * 60_000;

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

export interface SocketServerOptionsInput {
  /** Explicit CORS origin(s). When omitted, read from `CORS_ORIGIN` env (comma-separated). */
  corsOrigin?: string | string[];
  pingInterval?: number;
  pingTimeout?: number;
  /** connectionStateRecovery max disconnection duration (ms). */
  recoveryDurationMs?: number;
}

/**
 * Build the Socket.io server options shared by every Parlor server (the 6 prod
 * `server/index.ts` files and the 6 `vite.config.ts` dev servers). Centralizing
 * this keeps CORS, heartbeats, and connection-state recovery identical everywhere.
 *
 * `connectionStateRecovery` is an optimization for short blips only — the app-level
 * `player:reconnect` + token flow remains the source of truth for identity. Recovered
 * sockets are re-bound in the RoomManager by `setupLobbyHandlers` (see `socket.recovered`).
 */
export function buildSocketServerOptions(input: SocketServerOptionsInput = {}): Partial<ServerOptions> {
  const corsOrigin = input.corsOrigin ?? parseCorsOrigin(process.env.CORS_ORIGIN);
  return {
    cors: { origin: corsOrigin },
    pingInterval: input.pingInterval ?? DEFAULT_PING_INTERVAL,
    pingTimeout: input.pingTimeout ?? DEFAULT_PING_TIMEOUT,
    connectionStateRecovery: {
      maxDisconnectionDuration: input.recoveryDurationMs ?? DEFAULT_RECOVERY_DURATION,
      // Identity is re-validated via player:reconnect, so recovery can skip middlewares.
      skipMiddlewares: true,
    },
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

export function createGameServer(options: GameServerOptions) {
  const { httpServer, corsOrigin, callbacks } = options;

  const io: AppServer = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    buildSocketServerOptions({ corsOrigin }),
  );

  const roomManager = new RoomManager();

  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, callbacks);
  });

  return { io, roomManager };
}
