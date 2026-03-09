import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition, AppServer } from '@parlor/multiplayer';
import { RoomManager } from '@parlor/multiplayer';
import { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import { createPlayer } from '../types/game.js';
import type { LiarsDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): void {
  engine.getNewLogEntries(); // advance log cursor

  const players = roomManager.getPlayersInRoom(roomCode);
  for (const player of players) {
    if (RoomManager.isBotPlayer(player.id)) continue;
    io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
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
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): void {
  const state = engine.getState();
  if (state.gameOver || state.phase !== 'bidding') return;

  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.isAI || activePlayer.eliminated) return;

  setImmediate(() => {
    handleAITurn(io, roomCode, engine, roomManager).catch((err) => {
      console.error('[AI Turn] Error:', err);
    });
  });
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): Promise<void> {
  const state = engine.getState();
  if (state.gameOver || state.phase !== 'bidding') return;

  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.isAI || activePlayer.eliminated) return;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI turn timed out')), AI_TURN_TIMEOUT),
  );

  try {
    await Promise.race([
      aiPlayer.takeTurn(state, {
        onBid: (quantity, faceValue) => {
          if (engine.getState().gameOver) return;
          try {
            engine.placeBid(activePlayer.id, quantity, faceValue);
            broadcastViews(io, roomCode, engine, roomManager);
            // Next player might also be AI
            scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
          } catch (err) {
            console.error('[AI Bid] Error:', err);
          }
        },
        onChallenge: () => {
          if (engine.getState().gameOver) return;
          try {
            engine.challenge(activePlayer.id);
            broadcastViews(io, roomCode, engine, roomManager);
            // Auto-advance to next round after reveal delay
            if (!engine.getState().gameOver) {
              setTimeout(() => {
                try {
                  engine.startNextRound();
                  broadcastViews(io, roomCode, engine, roomManager);
                  scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
                } catch {
                  // game may have ended
                }
              }, 3000);
            }
          } catch (err) {
            console.error('[AI Challenge] Error:', err);
          }
        },
        onSpotOn: () => {
          if (engine.getState().gameOver) return;
          try {
            engine.spotOn(activePlayer.id);
            broadcastViews(io, roomCode, engine, roomManager);
            if (!engine.getState().gameOver) {
              setTimeout(() => {
                try {
                  engine.startNextRound();
                  broadcastViews(io, roomCode, engine, roomManager);
                  scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
                } catch {
                  // game may have ended
                }
              }, 3000);
            }
          } catch (err) {
            console.error('[AI Spot On] Error:', err);
          }
        },
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    console.error('[AI Turn] Error/timeout:', err);
    // Fallback: if AI timed out during bidding, auto-challenge or bid minimally
    const currentState = engine.getState();
    if (currentState.phase === 'bidding' && !currentState.gameOver) {
      try {
        if (currentState.currentBid) {
          engine.challenge(activePlayer.id);
        } else {
          engine.placeBid(activePlayer.id, 1, 2);
        }
        broadcastViews(io, roomCode, engine, roomManager);
      } catch {
        // ignore
      }
    }
  }
}

export const liarsDiceDefinition: ServerGameDefinition = {
  meta: {
    id: 'liars-dice',
    name: "Liar's Dice",
    description: 'A bluffing dice game — bid on hidden dice or call the bluff!',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: '15-30',
    tags: ['dice', 'bluffing', 'competitive'],
    displayModes: ['peer'],
    supportsBots: true,
  },

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players) => {
      const gamePlayers = players.map((p) => createPlayer(p.id, p.name, p.isBot));
      const engine = new LiarsDiceEngine(gamePlayers, roomCode);
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

      // If first player is AI, schedule their turn
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
    },

    onGameReset: (roomCode) => {
      roomManager.setGameData(roomCode, null);
    },

    onPlayerDisconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
      if (!engine) return;

      const state = engine.getState();
      const activePlayer = state.players[state.activePlayerIndex];

      // If the disconnected player is the active bidder, auto-challenge
      if (activePlayer.id === playerId && state.phase === 'bidding' && state.currentBid) {
        try {
          engine.challenge(playerId);
          broadcastViews(io, roomCode, engine, roomManager);

          if (!engine.getState().gameOver) {
            setTimeout(() => {
              try {
                engine.startNextRound();
                broadcastViews(io, roomCode, engine, roomManager);
                scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
              } catch {
                // game may have ended
              }
            }, 3000);
          }
        } catch {
          // ignore errors
        }
      }
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
      if (!engine) return;
      io.to(playerId).emit('game:state', engine.getPlayerView(playerId) as never);
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

    const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as LiarsDiceAction;

    try {
      switch (action.type) {
        case 'bid': {
          if (typeof action.quantity !== 'number' || typeof action.faceValue !== 'number') {
            socket.emit('error', 'Invalid bid');
            return;
          }
          engine.placeBid(socket.id, action.quantity, action.faceValue);
          broadcastViews(io, roomCode, engine, roomManager);
          scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
          break;
        }

        case 'challenge': {
          engine.challenge(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'spot-on': {
          engine.spotOn(socket.id);
          broadcastViews(io, roomCode, engine, roomManager);
          break;
        }

        case 'nextRound': {
          engine.startNextRound();
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
