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

/** The loose action every pre-3.1b definition validates into. */
export type LooseGameAction = Record<string, unknown>;

/**
 * Typed access a definition built by `defineGame` exposes (plan 3.1b). Absent on
 * definitions that have not been migrated yet.
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
 * - Games not migrated yet still write it by hand. The defaults keep their loose
 *   typing (`Record<string, unknown>` actions, no `typed` access).
 *
 * `handleGameAction` and the `TypedGameAccess` members are methods on purpose:
 * method parameters are bivariant, so `ServerGameDefinition<S, A, V>` is
 * assignable to the default `ServerGameDefinition` without a cast. That is sound
 * here because `dispatchGameAction` is the only caller, and it only passes the
 * value the same definition's `validateAction` returned.
 */
export interface ServerGameDefinition<State = unknown, Action = LooseGameAction, View = unknown> {
  meta: GameMeta;
  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => LobbyCallbacks;
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
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    action: Action,
  ): void | Promise<void>;
  /** Present on definitions built with `defineGame`. */
  readonly typed?: TypedGameAccess<State, View>;
}
