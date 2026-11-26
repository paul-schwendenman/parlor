import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { ServerGameDefinition, AppServer, GameInstance } from '@parlor/multiplayer';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import { createPlayer } from '../types/game.js';
import type { LiarsDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateLiarsDiceAction } from './validateAction.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
  advanceLog = true,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine) return;
  instance.emitIfCurrent(() => {
    if (engine.getState().gameOver) roomManager.finishGame(roomCode, engine);
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
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine) return;

  const state = engine.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (state.gameOver || state.phase !== 'bidding' || !activePlayer.isAI || activePlayer.eliminated) return;

  instance.schedule(() => handleAITurn(io, roomCode, engine, roomManager, instance), 0, 'bot-turn');
}

const REVEAL_DELAY_MS = 3000;

/** Bind the reveal timer to its round because a player can advance it early. */
function scheduleNextRound(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance || roomManager.getGameData(roomCode) !== engine || engine.getState().gameOver) return;
  const round = engine.getState().round;
  instance.schedule(() => {
    const state = engine.getState();
    if (state.round !== round || state.gameOver) return;
    engine.startNextRound();
    broadcastViews(io, roomCode, engine, roomManager);
    scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
  }, REVEAL_DELAY_MS, 'round-reveal');
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: LiarsDiceEngine,
  roomManager: RoomManager,
  instance: GameInstance,
): Promise<void> {
  const state = engine.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (state.gameOver || state.phase !== 'bidding' || !activePlayer.isAI || activePlayer.eliminated) return;

  function canAct(): boolean {
    if (!instance.isCurrent()) return false;
    const current = engine.getState();
    return !current.gameOver && current.phase === 'bidding' && current.round === state.round
      && current.currentBid === state.currentBid
      && current.players[current.activePlayerIndex].id === activePlayer.id;
  }

  const outcome = await instance.runWithTimeout((signal) => aiPlayer.takeTurn(state, {
    onBid: (quantity, faceValue) => {
      if (signal.aborted || !canAct()) return;
      engine.placeBid(activePlayer.id, quantity, faceValue);
      broadcastViews(io, roomCode, engine, roomManager);
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
    },
    onChallenge: () => {
      if (signal.aborted || !canAct()) return;
      engine.challenge(activePlayer.id);
      broadcastViews(io, roomCode, engine, roomManager);
      scheduleNextRound(io, roomCode, engine, roomManager);
    },
    onSpotOn: () => {
      if (signal.aborted || !canAct()) return;
      engine.spotOn(activePlayer.id);
      broadcastViews(io, roomCode, engine, roomManager);
      scheduleNextRound(io, roomCode, engine, roomManager);
    },
  }, signal, instance), AI_TURN_TIMEOUT);

  if (outcome !== 'timed-out' || !canAct()) return;
  if (engine.getState().currentBid) {
    engine.challenge(activePlayer.id);
    broadcastViews(io, roomCode, engine, roomManager);
    scheduleNextRound(io, roomCode, engine, roomManager);
  } else {
    engine.placeBid(activePlayer.id, 1, 2);
    broadcastViews(io, roomCode, engine, roomManager);
    scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
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

      broadcastViews(io, roomCode, engine, roomManager, false);

      // If first player is AI, schedule their turn
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
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

          scheduleNextRound(io, roomCode, engine, roomManager);
        } catch {
          // ignore errors
        }
      }
    },

    onPlayerReconnect: (roomCode, playerId) => {
      const engine = roomManager.getGameData<LiarsDiceEngine>(roomCode);
      if (!engine) return;
      roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
        const view = roomManager.isGameParticipant(roomCode, playerId)
          ? engine.getPlayerView(playerId)
          : engine.getSpectatorView();
        io.to(playerId).emit('game:state', view as never);
      });
    },
  }),

  validateAction: validateLiarsDiceAction,

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

    switch (action.type) {
      case 'bid': {
        if (typeof action.quantity !== 'number' || typeof action.faceValue !== 'number') {
          throw new GameRuleError('Invalid bid', 'INVALID_ACTION');
        }
        engine.placeBid(socket.data.playerId, action.quantity, action.faceValue);
        broadcastViews(io, roomCode, engine, roomManager);
        scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
        break;
      }

      case 'challenge': {
        engine.challenge(socket.data.playerId);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'spot-on': {
        engine.spotOn(socket.data.playerId);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'nextRound': {
        // Any player at the table (eliminated players included, they still see
        // the reveal) may advance, but only from a reveal phase; the engine checks both.
        engine.requestNextRound(socket.data.playerId);
        roomManager.getGameInstance(roomCode)?.cancel('round-reveal');
        broadcastViews(io, roomCode, engine, roomManager);
        scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
        break;
      }

      default:
        throw new GameRuleError('Unknown action', 'INVALID_ACTION');
    }
  },
};
