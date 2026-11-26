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

export interface ServerGameDefinition {
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
  validateAction: (action: Record<string, unknown>) => ActionValidation;
  /**
   * Apply one action. Called only through `dispatchGameAction`, which has
   * already checked that the sender is a seated player in a room playing this
   * game, and with the output of `validateAction`. Throw `GameRuleError` (before mutating) for a user-facing rejection;
   * an unexpected error sends the current game back to the lobby. Async handlers
   * must capture the room's GameInstance before awaiting, then check it before
   * mutating the engine or emitting any views.
   */
  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    action: Record<string, unknown>,
  ) => void | Promise<void>;
}
