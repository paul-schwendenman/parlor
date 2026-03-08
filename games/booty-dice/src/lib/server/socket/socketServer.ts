import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import { setupGameHandlers } from './gameHandlers.js';
import { GameEngine } from '../game/GameEngine.js';
import { createPlayer } from '../../types/game.js';
import { handleAITurn } from './gameHandlers.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

export function setupBootyDiceSocketHandlers(io: AppServer): void {
  io.on('connection', (socket) => {
    setupLobbyHandlers(io, socket, roomManager, {
      onGameStart: (roomCode, players) => {
        const gamePlayers = players.map((p) =>
          createPlayer(p.id, p.name, p.isBot),
        );
        const engine = new GameEngine(gamePlayers, roomCode);
        roomManager.setGameData(roomCode, engine);

        // Send initial views to each player (skip bots)
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

        // If first player is AI, schedule their turn
        const state = engine.getState();
        const firstPlayer = state.players[state.currentPlayerIndex];
        if (firstPlayer.isAI) {
          setImmediate(() => {
            handleAITurn(io, roomCode, engine, roomManager).catch((err) => {
              console.error('[AI Turn] Error:', err);
            });
          });
        }
      },

      onGameReset: (roomCode) => {
        roomManager.setGameData(roomCode, null);
      },

      onPlayerDisconnect: (roomCode, playerId) => {
        const engine = roomManager.getGameData<GameEngine>(roomCode);
        if (!engine) return;

        const state = engine.getState();
        const currentPlayer = state.players[state.currentPlayerIndex];

        // If it's the disconnected player's turn, auto-resolve and end their turn
        if (currentPlayer.id === playerId && state.phase === 'playing') {
          engine.finishRolling();

          // Auto-resolve any pending actions
          const updatedState = engine.getState();
          if (updatedState.turnPhase === 'selecting_targets') {
            const otherAlive = updatedState.players.filter(
              (p) => p.id !== playerId && !p.isEliminated,
            );
            for (const action of updatedState.pendingActions) {
              if (!action.resolved && otherAlive.length > 0) {
                engine.selectTarget(action.dieIndex, otherAlive[0].id);
              }
            }
          }

          // Resolve and end turn
          const resolution = engine.resolveTurn();
          if (!resolution.winner) {
            engine.endTurn();
          }

          broadcastViews(io, roomCode, engine, roomManager);

          // Check if next player is AI
          if (!resolution.winner) {
            const newState = engine.getState();
            const nextPlayer = newState.players[newState.currentPlayerIndex];
            if (nextPlayer.isAI && !nextPlayer.isEliminated) {
              setImmediate(() => {
                handleAITurn(io, roomCode, engine, roomManager).catch((err) => {
                  console.error('[AI Turn] Error:', err);
                });
              });
            }
          }
        }
      },

      onPlayerReconnect: (roomCode, playerId) => {
        const engine = roomManager.getGameData<GameEngine>(roomCode);
        if (!engine) return;

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
  engine: GameEngine,
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
