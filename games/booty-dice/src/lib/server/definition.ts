import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition, AppServer } from '@parlor/multiplayer';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import { GameEngine } from './game/GameEngine.js';
import { createPlayer } from '../types/game.js';
import type { BootyDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateDiceIndices } from './validation.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
): void {
  // Send new log entries first
  const newEntries = engine.getNewLogEntries();
  for (const entry of newEntries) {
    // Send to all humans in the room
    const players = roomManager.getPlayersInRoom(roomCode);
    for (const player of players) {
      if (RoomManager.isBotPlayer(player.id)) continue;
      io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
    }
  }

  // If no new log entries, just broadcast state
  if (newEntries.length === 0) {
    const players = roomManager.getPlayersInRoom(roomCode);
    for (const player of players) {
      if (RoomManager.isBotPlayer(player.id)) continue;
      io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
    }
  }

  const spectators = roomManager.getSpectatorsInRoom(roomCode);
  if (spectators.length > 0) {
    const spectatorView = engine.getSpectatorView();
    for (const spectatorId of spectators) {
      io.to(spectatorId).emit('game:state', spectatorView as never);
    }
  }
}

function handleEndTurn(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
): void {
  const resolution = engine.resolveTurn();

  if (resolution.winner) {
    broadcastViews(io, roomCode, engine, roomManager);
    return;
  }

  engine.endTurn();
  broadcastViews(io, roomCode, engine, roomManager);

  // Don't continue if game ended during endTurn
  const newState = engine.getState();
  if (newState.phase === 'ended') return;

  // Check if next player is AI
  const nextPlayer = newState.players[newState.currentPlayerIndex];
  if (nextPlayer.isAI && !nextPlayer.isEliminated) {
    setImmediate(() => {
      handleAITurn(io, roomCode, engine, roomManager).catch((err) => {
        console.error('[AI Turn] Error:', err);
      });
    });
  }
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
): Promise<void> {
  const state = engine.getState();

  if (state.phase === 'ended') return;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer.isAI || currentPlayer.isEliminated) return;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI turn timed out')), AI_TURN_TIMEOUT),
  );

  try {
    await Promise.race([
      aiPlayer.takeTurn(state, {
        onLockDice: (indices) => {
          if (engine.getState().phase === 'ended') return;
          engine.lockDice(indices);
          broadcastViews(io, roomCode, engine, roomManager);
        },
        onRoll: () => {
          if (engine.getState().phase === 'ended') return Promise.resolve(state.dice);
          const result = engine.roll();
          broadcastViews(io, roomCode, engine, roomManager);
          return Promise.resolve(result.dice);
        },
        onFinishRolling: () => {
          if (engine.getState().phase === 'ended') return;
          engine.finishRolling();
          broadcastViews(io, roomCode, engine, roomManager);
        },
        onSelectTarget: (dieIndex, targetId) => {
          if (engine.getState().phase === 'ended') return;
          engine.selectTarget(dieIndex, targetId);
          broadcastViews(io, roomCode, engine, roomManager);
        },
        onEndTurn: () => {
          if (engine.getState().phase === 'ended') return;
          handleEndTurn(io, roomCode, engine, roomManager);
        },
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    console.error('[AI Turn] Error/timeout:', err);
    if (engine.getState().phase !== 'ended') {
      engine.finishRolling();
      handleEndTurn(io, roomCode, engine, roomManager);
    }
  }
}

function requireActivePlayer(state: ReturnType<GameEngine['getState']>, playerId: string): void {
  if (state.players[state.currentPlayerIndex].id !== playerId) {
    throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
  }
}

export const bootyDiceDefinition: ServerGameDefinition = {
  meta: {
    id: 'booty-dice',
    name: 'Booty Dice',
    description: 'A pirate dice game of treasure, attacks, and survival',
    minPlayers: 2,
    maxPlayers: 6,
    estimatedMinutes: '15-30',
    tags: ['dice', 'pirates', 'competitive'],
    displayModes: ['peer'],
    supportsBots: true,
  },

  createLobbyCallbacks: (roomManager: RoomManager, io: AppServer) => ({
    onGameStart: (roomCode, players) => {
      const gamePlayers = players.map((p) => createPlayer(p.id, p.name, p.isBot));
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
  }),

  handleGameAction: (
    io: AppServer,
    socket: AppSocket,
    roomManager: RoomManager,
    rawAction: Record<string, unknown>,
  ) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const engine = roomManager.getGameData<GameEngine>(roomCode);
    if (!engine) return;

    const action = rawAction as unknown as BootyDiceAction;

    switch (action.type) {
      case 'roll': {
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');

        engine.roll();
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'lockDice': {
        const diceResult = validateDiceIndices(action.diceIndices);
        if (!diceResult.valid) throw new GameRuleError(diceResult.error, 'INVALID_ACTION');

        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');

        engine.lockDice(diceResult.indices);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'finishRolling': {
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');

        engine.finishRolling();
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'selectTarget': {
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'selecting_targets') throw new GameRuleError('Not selecting targets');

        engine.selectTarget(action.dieIndex, action.targetPlayerId);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'endTurn': {
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.phase !== 'playing') throw new GameRuleError('The game is not in progress');

        if (engine.hasUnresolvedTargets()) {
          throw new GameRuleError('Select targets for all attacks and steals first');
        }

        handleEndTurn(io, roomCode, engine, roomManager);
        break;
      }

      default:
        throw new GameRuleError('Unknown action', 'INVALID_ACTION');
    }
  },
};
