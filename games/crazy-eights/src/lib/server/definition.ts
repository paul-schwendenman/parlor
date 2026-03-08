import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition } from '@parlor/multiplayer';
import { RoomManager } from '@parlor/multiplayer';
import { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import { DEFAULT_CONFIG } from '../types/game.js';
import type { CrazyEightsAction } from '../types/game.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRoomTimer(roomCode: string): void {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomCode);
  }
}

export function cleanupRoomTimers(roomCode: string): void {
  clearRoomTimer(roomCode);
}

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: CrazyEightsEngine,
  roomManager: RoomManager,
): void {
  const players = roomManager.getPlayersInRoom(roomCode);
  for (const player of players) {
    if (RoomManager.isBotPlayer(player.id)) continue;
    const view = engine.getPlayerView(player.id);
    io.to(player.id).emit('game:state', view as never);
  }

  const spectators = roomManager.getSpectatorsInRoom(roomCode);
  if (spectators.length > 0) {
    const spectatorView = engine.getSpectatorView();
    for (const spectatorId of spectators) {
      io.to(spectatorId).emit('game:state', spectatorView as never);
    }
  }
}

export const crazyEightsDefinition: ServerGameDefinition = {
  meta: {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    description: 'Classic card game - match suits or ranks, play eights to change the suit',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: '10-15',
    tags: ['cards', 'classic', 'quick'],
    displayModes: ['peer'],
  },

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players, io) => {
      const engine = new CrazyEightsEngine(
        players.map((p) => ({ id: p.id, name: p.name })),
        roomCode,
        DEFAULT_CONFIG,
      );
      roomManager.setGameData(roomCode, engine);

      for (const player of players) {
        if (RoomManager.isBotPlayer(player.id)) continue;
        const view = engine.getPlayerView(player.id);
        io.to(player.id).emit('game:state', view as never);
      }

      const spectators = roomManager.getSpectatorsInRoom(roomCode);
      if (spectators.length > 0) {
        const spectatorView = engine.getSpectatorView();
        for (const spectatorId of spectators) {
          io.to(spectatorId).emit('game:state', spectatorView as never);
        }
      }
    },

    onGameReset: (roomCode) => {
      cleanupRoomTimers(roomCode);
      roomManager.setGameData(roomCode, null);
    },

    onPlayerDisconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<CrazyEightsEngine>(roomCode);
      if (!engine) return;

      engine.handleDisconnect(playerId);
      broadcastViews(io, roomCode, engine, roomManager);
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<CrazyEightsEngine>(roomCode);
      if (!engine) return;

      engine.handleReconnect(playerId);
      const view = engine.getPlayerView(playerId);
      io.to(playerId).emit('game:state', view as never);
    },
  }),

  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    rawAction: Record<string, unknown>,
  ) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const engine = roomManager.getGameData<CrazyEightsEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as CrazyEightsAction;

    try {
      switch (action.type) {
        case 'play-card': {
          engine.playCard(socket.id, action.card);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'draw-card': {
          engine.drawCard(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'pass': {
          engine.pass(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'choose-suit': {
          engine.chooseSuit(socket.id, action.suit);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', message);
    }
  },
};
