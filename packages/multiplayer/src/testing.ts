/**
 * Test-only helper: a started room with real RoomManager + a game definition,
 * and a `send` that goes through the real `dispatchGameAction` boundary.
 * Exported as `@parlor/multiplayer/testing`; not used by app code.
 */
import type { ActionResult } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { dispatchGameAction } from './actionBoundary.js';
import type { AppServer, AppSocket, ServerGameDefinition } from './gameDefinition.js';

export interface DispatchHarness {
  roomManager: RoomManager;
  roomCode: string;
  /** Seated player ids, in join order (the engine may shuffle seats). */
  playerIds: string[];
  /** `error` events emitted to each player's fake socket. */
  errors: Map<string, string[]>;
  roomFailures: string[];
  send(playerId: string, action: unknown): Promise<ActionResult>;
}

export function createDispatchHarness(definition: ServerGameDefinition, playerCount = 2): DispatchHarness {
  const io = { to: () => ({ emit: () => undefined }) } as never as AppServer;
  const roomManager = new RoomManager();
  const host = roomManager.createRoom('sock-0', 'P0');
  roomManager.selectGame(host.roomCode, definition.meta);
  const playerIds = [host.playerId];
  for (let i = 1; i < playerCount; i++) {
    playerIds.push(roomManager.joinRoom(host.roomCode, `sock-${i}`, `P${i}`).playerId!);
  }
  for (const id of playerIds) roomManager.setPlayerReady(id, true);
  const players = roomManager.startGame(host.roomCode)!;
  definition.createLobbyCallbacks(roomManager, io).onGameStart?.(host.roomCode, players, io);

  const errors = new Map<string, string[]>(playerIds.map((id) => [id, []]));
  const roomFailures: string[] = [];

  return {
    roomManager,
    roomCode: host.roomCode,
    playerIds,
    errors,
    roomFailures,
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
