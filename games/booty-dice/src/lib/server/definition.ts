import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition, AppServer, GameInstance } from '@parlor/multiplayer';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import { GameEngine } from './game/GameEngine.js';
import { createPlayer } from '../types/game.js';
import type { BootyDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateBootyDiceAction } from './validateAction.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
  advanceLog = true,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine) return;
  instance.emitIfCurrent(() => {
    if (engine.getState().phase === 'ended') roomManager.finishGame(roomCode, engine);

    if (advanceLog) engine.getNewLogEntries();
    for (const player of roomManager.getGamePlayers(roomCode)) {
      if (RoomManager.isBotPlayer(player.id)) continue;
      io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
    }

    const spectators = roomManager.getGameSpectators(roomCode);
    if (spectators.length > 0) {
      const view = engine.getSpectatorView();
      for (const spectatorId of spectators) io.to(spectatorId).emit('game:state', view as never);
    }
  });
}

function scheduleAITurnIfNeeded(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine) return;

  const state = engine.getState();
  const player = state.players[state.currentPlayerIndex];
  if (state.phase === 'ended' || !player.isAI || player.isEliminated) return;

  instance.schedule(() => handleAITurn(io, roomCode, engine, roomManager, instance), 0, 'bot-turn');
}

function handleEndTurn(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
): void {
  // A turn with no roll (only reachable from server-driven paths such as the AI
  // timeout fallback; players are rejected earlier) scores nothing.
  if (engine.hasRolledThisTurn()) {
    const resolution = engine.resolveTurn();
    if (resolution.winner) {
      broadcastViews(io, roomCode, engine, roomManager);
      return;
    }
  }

  engine.endTurn();
  broadcastViews(io, roomCode, engine, roomManager);
  scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: GameEngine,
  roomManager: RoomManager,
  instance: GameInstance,
): Promise<void> {
  const state = engine.getState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (state.phase === 'ended' || !currentPlayer.isAI || currentPlayer.isEliminated) return;

  function canAct(): boolean {
    if (!instance.isCurrent()) return false;
    const current = engine.getState();
    return current.phase !== 'ended' && current.turnNumber === state.turnNumber
      && current.players[current.currentPlayerIndex].id === currentPlayer.id;
  }

  const outcome = await instance.runWithTimeout((signal) => aiPlayer.takeTurn(state, {
    onLockDice: (indices) => {
      if (signal.aborted || !canAct()) return;
      engine.lockDice(indices);
      broadcastViews(io, roomCode, engine, roomManager);
    },
    onRoll: () => {
      if (signal.aborted || !canAct()) return Promise.resolve(state.dice);
      const result = engine.roll();
      broadcastViews(io, roomCode, engine, roomManager);
      return Promise.resolve(result.dice);
    },
    onFinishRolling: () => {
      if (signal.aborted || !canAct()) return;
      engine.finishRolling();
      broadcastViews(io, roomCode, engine, roomManager);
    },
    onSelectTarget: (dieIndex, targetId) => {
      if (signal.aborted || !canAct()) return;
      engine.selectTarget(dieIndex, targetId);
      broadcastViews(io, roomCode, engine, roomManager);
    },
    onEndTurn: () => {
      if (signal.aborted || !canAct()) return;
      handleEndTurn(io, roomCode, engine, roomManager);
    },
  }, signal, instance), AI_TURN_TIMEOUT);

  if (outcome === 'timed-out' && canAct()) {
    engine.finishRolling();
    handleEndTurn(io, roomCode, engine, roomManager);
  }
}

function requireRolled(engine: GameEngine, message: string): void {
  if (!engine.hasRolledThisTurn()) throw new GameRuleError(message);
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

      broadcastViews(io, roomCode, engine, roomManager, false);
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
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

        // Resolve and end turn. A player who drops before rolling forfeits the
        // turn rather than scoring the previous dice (CORE-AUDIT A-06).
        const resolution = engine.hasRolledThisTurn() ? engine.resolveTurn() : { winner: null };
        if (!resolution.winner) {
          engine.endTurn();
        }

        broadcastViews(io, roomCode, engine, roomManager);

        if (!resolution.winner) scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
      }
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<GameEngine>(roomCode);
      if (!engine) return;

      roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
        const view = roomManager.isGameParticipant(roomCode, playerId)
          ? engine.getPlayerView(playerId)
          : engine.getSpectatorView();
        io.to(playerId).emit('game:state', view as never);
      });
    },
  }),

  validateAction: validateBootyDiceAction,

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
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');
        // Locking before the first roll would keep the previous player's (or the
        // opening) dice through the roll (CORE-AUDIT A-06).
        requireRolled(engine, 'Roll before locking dice');

        engine.lockDice(action.diceIndices);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'finishRolling': {
        const state = engine.getState();
        requireActivePlayer(state, socket.data.playerId);
        if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');

        requireRolled(engine, 'Roll at least once first');

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

        // Without a roll this turn, resolveTurn would score the opening or the
        // previous player's dice (CORE-AUDIT A-06).
        requireRolled(engine, 'You must roll before ending your turn');
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
