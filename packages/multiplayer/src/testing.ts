/**
 * Test-only helper: a started room with real RoomManager + a game definition,
 * and a `send` that goes through the real `dispatchGameAction` boundary.
 * Exported as `@parlor/multiplayer/testing`; not used by app code.
 */
import type { ActionResult } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { dispatchGameAction } from './actionBoundary.js';
import type { LobbyCallbacks } from './lobbyHandlers.js';
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
