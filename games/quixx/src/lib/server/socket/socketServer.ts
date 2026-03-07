import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { setupGameHandlers, cleanupRoomTimers } from './gameHandlers.js';
import { QuixxEngine } from '../game/QuixxEngine.js';
import { DEFAULT_CONFIG } from '../../types/game.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupQuixxSocketHandlers(io: AppServer): void {
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, {
      onGameStart: (roomCode, players, io) => {
        const engine = new QuixxEngine(
          players.map((p) => ({ id: p.id, name: p.name })),
          roomCode,
          DEFAULT_CONFIG,
        );
        roomManager.setGameData(roomCode, engine);

        // Send initial views to each player
        for (const player of players) {
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

        // Auto-roll if configured
        if (DEFAULT_CONFIG.diceRolling === 'auto') {
          setTimeout(() => {
            if (engine.getPhase() === 'rolling') {
              try {
                engine.rollDice();
                for (const player of players) {
                  const view = engine.getPlayerView(player.id);
                  io.to(player.id).emit('game:state', view as never);
                }
                const specs = roomManager.getSpectatorsInRoom(roomCode);
                if (specs.length > 0) {
                  const specView = engine.getSpectatorView();
                  for (const specId of specs) {
                    io.to(specId).emit('game:state', specView as never);
                  }
                }
              } catch {
                // Ignore
              }
            }
          }, 500);
        }
      },

      onGameReset: (roomCode) => {
        cleanupRoomTimers(roomCode);
        roomManager.setGameData(roomCode, null);
      },

      onPlayerDisconnect: (roomCode, playerId) => {
        const engine = roomManager.getGameData<QuixxEngine>(roomCode);
        if (!engine) return;

        // Auto-pass for disconnected player in phase1
        if (engine.getPhase() === 'phase1') {
          try {
            engine.submitPhase1(playerId, { type: 'phase1-pass' });
            if (engine.allPhase1Submitted()) {
              engine.resolvePhase1();
            }
          } catch {
            // Already submitted
          }
        }

        // If active player disconnected during phase2, auto-pass
        const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
        if (activePlayer.id === playerId && engine.getPhase() === 'phase2') {
          try {
            engine.submitPhase2(playerId, { type: 'phase2-pass' });
            if (!engine.isGameOver()) {
              engine.advanceTurn();
            }
          } catch {
            // Ignore
          }
        }

        // Broadcast updated state
        const players = roomManager.getPlayersInRoom(roomCode);
        for (const player of players) {
          const view = engine.getPlayerView(player.id);
          io.to(player.id).emit('game:state', view as never);
        }
      },

      onPlayerReconnect: (roomCode, playerId) => {
        const engine = roomManager.getGameData<QuixxEngine>(roomCode);
        if (!engine) return;

        const view = engine.getPlayerView(playerId);
        io.to(playerId).emit('game:state', view as never);
      },
    });

    setupGameHandlers(io, socket, roomManager);
  });
}
