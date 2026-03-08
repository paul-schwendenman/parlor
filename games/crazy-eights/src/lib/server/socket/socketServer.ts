import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { setupGameHandlers, cleanupRoomTimers } from './gameHandlers.js';
import { CrazyEightsEngine } from '../game/CrazyEightsEngine.js';
import { DEFAULT_CONFIG } from '../../types/game.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupCrazyEightsSocketHandlers(io: AppServer): void {
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, {
      onGameStart: (roomCode, players, io) => {
        const engine = new CrazyEightsEngine(
          players.map((p) => ({ id: p.id, name: p.name })),
          roomCode,
          DEFAULT_CONFIG,
        );
        roomManager.setGameData(roomCode, engine);

        // Send initial views to each player
        for (const player of players) {
          if (RoomManager.isBotPlayer(player.id)) continue;
          const view = engine.getPlayerView(player.id);
          io.to(player.id).emit('game:state', view as never);
        }

        // Send initial view to spectators
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

        // Broadcast updated state
        broadcastViews(io, roomCode, engine, roomManager);
      },

      onPlayerReconnect: (roomCode, playerId) => {
        const engine = roomManager.getGameData<CrazyEightsEngine>(roomCode);
        if (!engine) return;

        engine.handleReconnect(playerId);
        const view = engine.getPlayerView(playerId);
        io.to(playerId).emit('game:state', view as never);
      },
    });

    setupGameHandlers(io, socket, roomManager);
  });
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

export { broadcastViews };
