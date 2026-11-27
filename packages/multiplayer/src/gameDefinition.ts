import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  GameMeta,
} from '@parlor/game-types';
import type { RoomManager } from './RoomManager.js';
import type { LobbyCallbacks } from './lobbyHandlers.js';
import type { ActionValidation } from './actionValidation.js';

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/*
 * The parts of the Socket.io server and socket the core actually uses (plan 3.5).
 * The core takes these instead of `AppServer` / `AppSocket`: the real ones
 * satisfy them structurally, and tests can pass a small typed fake (see
 * `@parlor/multiplayer/testing`) instead of casting a stub to a Socket.io class.
 */

/** Emits typed `ServerToClientEvents` to a room or socket. */
export interface ServerEventEmitter {
  emit<Ev extends keyof ServerToClientEvents>(event: Ev, ...args: Parameters<ServerToClientEvents[Ev]>): boolean;
}

/** The server as games and the action boundary use it: only `io.to(room).emit(...)`. */
export interface GameIo {
  to(room: string): ServerEventEmitter;
}

/** The server as the lobby handlers use it. */
export interface LobbyIo extends GameIo {
  in(room: string): { socketsLeave(room: string): void };
  readonly sockets: {
    readonly sockets: { get(socketId: string): { disconnect(close?: boolean): unknown } | undefined };
  };
}

/** A connected socket as the action boundary and `handleGameAction` use it. */
export interface ActionSocket extends ServerEventEmitter {
  readonly id: string;
  data: SocketData;
}

/** Every event a server socket listens to: the client events plus Socket.io's `disconnect`. */
type ServerListenEvents = ClientToServerEvents & { disconnect: (reason: string) => void };
type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;
/**
 * `socket.on` as one overload per event. Socket.io declares it as a single
 * generic method over a conditional listener type, which a generic signature
 * cannot match, but each concrete event instantiates it cleanly.
 */
type ServerSocketOn = UnionToIntersection<
  { [Ev in keyof ServerListenEvents]: (event: Ev, listener: ServerListenEvents[Ev]) => unknown }[keyof ServerListenEvents]
>;

/** A connected socket as the lobby handlers use it. */
export interface LobbySocket extends ActionSocket {
  on: ServerSocketOn;
  join(room: string): unknown;
  leave(room: string): unknown;
}

/** The loose action every pre-3.1b definition validates into. */
export type LooseGameAction = Record<string, unknown>;

/**
 * Typed access a definition built by `defineGame` exposes (plan 3.1b). Absent on
 * hand-written definitions (only test doubles are written by hand now).
 */
export interface TypedGameAccess<State, View> {
  /** The current game instance's state for a room, or null if no game of this definition is running. */
  getState(roomManager: RoomManager, roomCode: string): State | null;
  getPlayerView(state: State, playerId: string): View;
  getSpectatorView(state: State): View;
}

/**
 * The game definition the core runs: the registry, both socket routers, the
 * action boundary and the test harness all take this.
 *
 * - Typed games build it with `defineGame(...)`, which fills every parameter and
 *   generates `createLobbyCallbacks` / `handleGameAction`.
 * - Hand-written definitions (test doubles) keep the loose defaults
 *   (`Record<string, unknown>` actions, no `typed` access).
 *
 * `handleGameAction` and the `TypedGameAccess` members are methods on purpose:
 * method parameters are bivariant, so `ServerGameDefinition<S, A, V>` is
 * assignable to the default `ServerGameDefinition` without a cast. That is sound
 * here because `dispatchGameAction` is the only caller, and it only passes the
 * value the same definition's `validateAction` returned.
 */
export interface ServerGameDefinition<State = unknown, Action = LooseGameAction, View = unknown> {
  meta: GameMeta;
  createLobbyCallbacks: (roomManager: RoomManager, io: GameIo) => LobbyCallbacks;
  /**
   * Required structural check of an action, run by the core action boundary
   * after the envelope / membership checks and before `handleGameAction`.
   * Must reject unknown types, missing / mistyped / out-of-range fields and
   * extra keys, and return a freshly built action from the validated fields
   * only; that sanitized action is what `handleGameAction` receives.
   * A rejection is sent to the client as `INVALID_ACTION` with `message`.
   */
  validateAction: (action: Record<string, unknown>) => ActionValidation<Action>;
  /**
   * Apply one action. Called only through `dispatchGameAction`, which has
   * already checked that the sender is a seated player in a room playing this
   * game, and with the output of `validateAction`. Throw `GameRuleError` (before mutating) for a user-facing rejection;
   * an unexpected error sends the current game back to the lobby. Async handlers
   * must capture the room's GameInstance before awaiting, then check it before
   * mutating the engine or emitting any views.
   */
  handleGameAction(
    io: GameIo,
    socket: ActionSocket,
    roomManager: RoomManager,
    action: Action,
  ): void | Promise<void>;
  /** Present on definitions built with `defineGame`. */
  readonly typed?: TypedGameAccess<State, View>;
}

/** What `defineGame` returns: a `ServerGameDefinition` whose typed access is always present. */
export type TypedServerGameDefinition<State, Action, View> = ServerGameDefinition<State, Action, View> & {
  readonly typed: TypedGameAccess<State, View>;
};
