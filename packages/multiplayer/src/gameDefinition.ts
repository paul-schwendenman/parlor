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

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface ServerGameDefinition {
  meta: GameMeta;
  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => LobbyCallbacks;
  /**
   * Optional structural check of an action, run by the core action boundary
   * after the envelope / membership checks and before `handleGameAction`.
   * A rejection is sent to the client as `INVALID_ACTION` with `message`.
   */
  validateAction?: (action: Record<string, unknown>) => { ok: true } | { ok: false; message: string };
  /**
   * Apply one action. Called only through `dispatchGameAction`, which has
   * already checked that the sender is a seated player in a room playing this
   * game. Throw `GameRuleError` (before mutating) for a user-facing rejection;
   * anything else thrown or rejected sends the room back to the lobby.
   */
  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    action: Record<string, unknown>,
  ) => void | Promise<void>;
}
