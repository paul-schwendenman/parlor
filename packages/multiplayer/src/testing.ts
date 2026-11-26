/**
 * Test-only helper: a started room with real RoomManager + a game definition,
 * and a `send` that goes through the real `dispatchGameAction` boundary.
 * Exported as `@parlor/multiplayer/testing`; not used by app code.
 */
import type { ActionResult } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { dispatchGameAction } from './actionBoundary.js';
import { returnRoomToLobby, setupLobbyHandlers, type LobbyCallbacks } from './lobbyHandlers.js';
import type { AppServer, AppSocket, LooseGameAction, ServerGameDefinition } from './gameDefinition.js';

/** One `io.to(target).emit(event, payload)` call. */
export interface CapturedEmit {
  to: string;
  event: string;
  payload: unknown;
}

export interface DispatchHarness<State = unknown> {
  roomManager: RoomManager;
  roomCode: string;
  /** Seated player ids, in join order (the engine may shuffle seats). */
  playerIds: string[];
  /** `error` events emitted to each player's fake socket. */
  errors: Map<string, string[]>;
  roomFailures: string[];
  /** Every `io.to(...).emit(...)` the game made, in order (includes the start broadcast). */
  emitted: CapturedEmit[];
  /** The fake `io` the game was given. */
  io: AppServer;
  /** The lobby callbacks the game was started with (call them to drive lifecycle events). */
  callbacks: LobbyCallbacks;
  /** The current state, for definitions built with `defineGame`. */
  getState(): State | null;
  /** Add a spectator socket to the room (it receives views from the next broadcast on). */
  spectate(socketId: string): void;
  send(playerId: string, action: unknown): Promise<ActionResult>;
}

export function createDispatchHarness<State = unknown, Action extends LooseGameAction = LooseGameAction, View = unknown>(
  definition: ServerGameDefinition<State, Action, View>,
  playerCount = 2,
): DispatchHarness<State> {
  const emitted: CapturedEmit[] = [];
  const io = {
    to: (to: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ to, event, payload });
        return true;
      },
    }),
    in: () => ({ socketsLeave: () => undefined }),
  } as never as AppServer;
  const roomManager = new RoomManager();
  const host = roomManager.createRoom('sock-0', 'P0');
  roomManager.selectGame(host.roomCode, definition.meta);
  const playerIds = [host.playerId];
  for (let i = 1; i < playerCount; i++) {
    playerIds.push(roomManager.joinRoom(host.roomCode, `sock-${i}`, `P${i}`).playerId!);
  }
  for (const id of playerIds) roomManager.setPlayerReady(id, true);
  const players = roomManager.startGame(host.roomCode)!;
  const callbacks = definition.createLobbyCallbacks(roomManager, io);
  callbacks.onGameStart?.(host.roomCode, players, io);

  const errors = new Map<string, string[]>(playerIds.map((id) => [id, []]));
  const roomFailures: string[] = [];

  return {
    roomManager,
    roomCode: host.roomCode,
    playerIds,
    errors,
    roomFailures,
    emitted,
    io,
    callbacks,
    getState: () => definition.typed?.getState(roomManager, host.roomCode) ?? null,
    spectate(socketId) {
      const result = roomManager.addSpectator(host.roomCode, socketId);
      if (!result.success) throw new Error(result.error ?? 'Could not spectate');
    },
    send(playerId, action) {
      const socket = {
        id: `sock-${playerIds.indexOf(playerId)}`,
        data: { roomCode: host.roomCode, playerId },
        emit: (_event: string, message: string) => errors.get(playerId)?.push(message),
      } as never as AppSocket;
      return dispatchGameAction({
        io,
        socket,
        roomManager,
        definition,
        action,
        ack: undefined,
        onRoomFailure: (code) => roomFailures.push(code),
      });
    },
  };
}

type Handler = (...args: unknown[]) => void;

/** A fake server-side socket wired through the real `setupLobbyHandlers`. */
export interface FakeSocket {
  id: string;
  data: { roomCode: string; playerId: string; playerName: string };
  /** `socket.emit(...)` calls the server made to this socket (e.g. `error`). */
  received: { event: string; args: unknown[] }[];
  /** Deliver a client event to the server handlers. */
  fire(event: string, ...args: unknown[]): void;
}

export interface LobbyHarness<State = unknown> {
  roomManager: RoomManager;
  roomCode: string;
  io: AppServer;
  callbacks: LobbyCallbacks;
  /** Every `io.to(...).emit(...)`, in order. */
  emitted: CapturedEmit[];
  /** Human seats in join order (the host first). */
  humans: FakeSocket[];
  botIds: string[];
  /** Reconnect tokens per human player id. */
  tokens: Map<string, string>;
  getState(): State | null;
  /** A new socket wired to the same server (for reconnects and spectators). */
  connect(id: string): FakeSocket;
  /** Send a `game:action` from a socket through the real boundary. */
  send(socket: FakeSocket, action: unknown): Promise<ActionResult>;
}

export interface LobbyHarnessOptions {
  humans?: number;
  bots?: number;
  /** Disconnect grace window. */
  graceMs?: number;
  /** Start the game (default true). */
  start?: boolean;
}

/**
 * A room driven through the real lobby handlers: create, join, add bots, ready
 * and start, with grace timers, removal, reconnect, restart and room deletion
 * all going through the same code paths as production.
 */
export function createLobbyHarness<State = unknown, Action extends LooseGameAction = LooseGameAction, View = unknown>(
  definition: ServerGameDefinition<State, Action, View>,
  options: LobbyHarnessOptions = {},
): LobbyHarness<State> {
  const { humans: humanCount = 2, bots = 0, graceMs = 1_000, start = true } = options;
  const emitted: CapturedEmit[] = [];
  const sockets = new Map<string, FakeSocket>();
  const io = {
    to: (to: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ to, event, payload });
        return true;
      },
    }),
    in: () => ({ socketsLeave: () => undefined }),
    sockets: { sockets: new Map<string, { disconnect: () => void }>() },
  } as never as AppServer;
  const roomManager = new RoomManager(graceMs);
  const callbacks = definition.createLobbyCallbacks(roomManager, io);

  function connect(id: string): FakeSocket {
    const handlers: Record<string, Handler> = {};
    const socket: FakeSocket = {
      id,
      data: { roomCode: '', playerId: '', playerName: '' },
      received: [],
      fire: (event, ...args) => handlers[event]?.(...args),
    };
    const serverSocket = {
      id,
      data: socket.data,
      on: (event: string, cb: Handler) => {
        handlers[event] = cb;
      },
      join: () => undefined,
      leave: () => undefined,
      emit: (event: string, ...args: unknown[]) => {
        socket.received.push({ event, args });
        return true;
      },
    };
    sockets.set(id, socket);
    setupLobbyHandlers(io, serverSocket as never as AppSocket, roomManager, callbacks);
    return socket;
  }

  const tokens = new Map<string, string>();
  const host = connect('host-socket');
  host.fire('lobby:create', 'Host', (result: { playerId: string; reconnectToken: string } | null) => {
    if (result) tokens.set(result.playerId, result.reconnectToken);
  });
  const roomCode = host.data.roomCode;
  roomManager.selectGame(roomCode, definition.meta);
  const humans = [host];
  for (let i = 1; i < humanCount; i++) {
    const guest = connect(`guest-${i}-socket`);
    guest.fire('lobby:join', roomCode, `Guest ${i}`, (result: { playerId?: string; reconnectToken?: string }) => {
      if (result.playerId && result.reconnectToken) tokens.set(result.playerId, result.reconnectToken);
    });
    humans.push(guest);
  }
  for (let i = 0; i < bots; i++) host.fire('lobby:addBot', () => undefined);
  const botIds = roomManager.getPlayersInRoom(roomCode).filter((p) => p.isBot).map((p) => p.id);
  if (start) {
    for (const socket of humans) socket.fire('lobby:ready', true, () => undefined);
    let started = false;
    host.fire('lobby:startGame', (ok: boolean) => {
      started = ok;
    });
    if (!started) throw new Error('Could not start the game');
  }

  return {
    roomManager,
    roomCode,
    io,
    callbacks,
    emitted,
    humans,
    botIds,
    tokens,
    getState: () => definition.typed?.getState(roomManager, roomCode) ?? null,
    connect,
    send(socket, action) {
      return dispatchGameAction({
        io,
        socket: { id: socket.id, data: socket.data, emit: () => true } as never as AppSocket,
        roomManager,
        definition,
        action,
        ack: undefined,
        onRoomFailure: (code) => returnRoomToLobby(io, roomManager, code, callbacks),
      });
    },
  };
}
