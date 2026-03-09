import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition } from '@parlor/multiplayer';
import { RoomManager } from '@parlor/multiplayer';
import { KingsCornerEngine } from './game/KingsCornerEngine.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { DEFAULT_CONFIG } from '../types/game.js';
import type { KingsCornerAction } from '../types/game.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
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

function scheduleAITurnIfNeeded(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
  roomManager: RoomManager,
): void {
  if (engine.isGameOver()) return;

  const activeIndex = engine.getActivePlayerIndex();
  const players = roomManager.getPlayersInRoom(roomCode);
  const activePlayer = players[activeIndex];
  if (!activePlayer || !RoomManager.isBotPlayer(activePlayer.id)) return;

  setImmediate(() => {
    handleAITurn(io, roomCode, engine, roomManager, activePlayer.id).catch((err) => {
      console.error('[Kings Corner AI] Error:', err);
    });
  });
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
  roomManager: RoomManager,
  botId: string,
): Promise<void> {
  if (engine.isGameOver()) return;

  const aiPlayer = new AIPlayer();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI turn timed out')), AI_TURN_TIMEOUT),
  );

  try {
    await Promise.race([
      aiPlayer.takeTurn({
        onDrawCard: () => {
          if (engine.isGameOver()) return;
          try {
            engine.drawCard(botId);
            broadcastViews(io, roomCode, engine, roomManager);
          } catch {
            // Phase changed
          }
        },
        onPlayCard: (card, target) => {
          if (engine.isGameOver()) return;
          try {
            engine.playCard(botId, card, target);
            broadcastViews(io, roomCode, engine, roomManager);
          } catch {
            // Invalid move
          }
        },
        onMovePile: (from, to) => {
          if (engine.isGameOver()) return;
          try {
            engine.movePile(botId, from, to);
            broadcastViews(io, roomCode, engine, roomManager);
          } catch {
            // Invalid move
          }
        },
        onEndTurn: () => {
          if (engine.isGameOver()) return;
          try {
            engine.endTurn(botId);
            broadcastViews(io, roomCode, engine, roomManager);
            scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
          } catch {
            // Turn already ended
          }
        },
        getView: () => engine.getPlayerView(botId),
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    console.error('[Kings Corner AI] Error/timeout:', err);
    // Force end turn on timeout
    if (!engine.isGameOver()) {
      try {
        // Auto-play mandatory kings then end turn
        engine.handleDisconnect(botId);
        engine.handleReconnect(botId);
        broadcastViews(io, roomCode, engine, roomManager);
        scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
      } catch {
        // Already handled
      }
    }
  }
}

export const kingsCornerDefinition: ServerGameDefinition = {
  meta: {
    id: 'kings-corner',
    name: 'Kings Corner',
    description: 'Build descending sequences of alternating colors — be first to empty your hand',
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '15-25',
    tags: ['cards', 'classic', 'strategy'],
    displayModes: ['peer'],
    supportsBots: true,
  },

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players, io) => {
      const engine = new KingsCornerEngine(
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

      // If first player is a bot, start AI turn
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
    },

    onGameReset: (roomCode) => {
      roomManager.setGameData(roomCode, null);
    },

    onPlayerDisconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<KingsCornerEngine>(roomCode);
      if (!engine) return;

      engine.handleDisconnect(playerId);
      broadcastViews(io, roomCode, engine, roomManager);
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<KingsCornerEngine>(roomCode);
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

    const engine = roomManager.getGameData<KingsCornerEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as KingsCornerAction;

    try {
      switch (action.type) {
        case 'play-card': {
          engine.playCard(socket.id, action.card, action.target);
          broadcastViews(io, roomCode, engine, roomManager);
          scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
          break;
        }

        case 'move-pile': {
          engine.movePile(socket.id, action.from, action.to);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'end-turn': {
          engine.endTurn(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      socket.emit('error', message);
    }
  },
};
