import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@parlor/game-types';
import type { GameInstance, ServerGameDefinition } from '@parlor/multiplayer';
import { GameRuleError, isGameRuleError, RoomManager } from '@parlor/multiplayer';
import { KingsCornerEngine } from './game/KingsCornerEngine.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { DEFAULT_CONFIG } from '../types/game.js';
import type { KingsCornerAction } from '../types/game.js';
import { validateKingsCornerAction } from './validateAction.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const AI_TURN_TIMEOUT = 30_000;

function broadcastViews(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
  roomManager: RoomManager,
): void {
  if (roomManager.getGameData(roomCode) !== engine) return;
  roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
    if (engine.isGameOver()) roomManager.finishGame(roomCode, engine);
    for (const player of roomManager.getGamePlayers(roomCode)) {
      if (RoomManager.isBotPlayer(player.id)) continue;
      io.to(player.id).emit('game:state', engine.getPlayerView(player.id) as never);
    }

    const spectators = roomManager.getGameSpectators(roomCode);
    if (spectators.length > 0) {
      const spectatorView = engine.getSpectatorView();
      for (const spectatorId of spectators) {
        io.to(spectatorId).emit('game:state', spectatorView as never);
      }
    }
  });
}

function scheduleAITurnIfNeeded(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
  roomManager: RoomManager,
): void {
  const instance = roomManager.getGameInstance(roomCode);
  if (!instance?.isCurrent() || engine.isGameOver()) return;

  const activeIndex = engine.getActivePlayerIndex();
  const players = roomManager.getGamePlayers(roomCode);
  const activePlayer = players[activeIndex];
  if (!activePlayer || !RoomManager.isBotPlayer(activePlayer.id)) return;

  instance.schedule(
    () => handleAITurn(io, roomCode, engine, roomManager, activePlayer.id, instance),
    0,
    'bot-turn',
  );
}

async function handleAITurn(
  io: AppServer,
  roomCode: string,
  engine: KingsCornerEngine,
  roomManager: RoomManager,
  botId: string,
  instance: GameInstance,
): Promise<void> {
  if (!instance.isCurrent() || engine.isGameOver()) return;

  const aiPlayer = new AIPlayer();
  const result = await instance.runWithTimeout((signal) => {
    function applyMove(move: () => void): boolean {
      if (signal.aborted || !instance.isCurrent() || engine.isGameOver()) return false;
      try {
        move();
      } catch (err) {
        if (!isGameRuleError(err)) throw err;
        return false;
      }
      broadcastViews(io, roomCode, engine, roomManager);
      return true;
    }

    return aiPlayer.takeTurn({
      onDrawCard: () => applyMove(() => engine.drawCard(botId)),
      onPlayCard: (card, target) => applyMove(() => engine.playCard(botId, card, target)),
      onMovePile: (from, to) => applyMove(() => engine.movePile(botId, from, to)),
      onEndTurn: () => {
        if (applyMove(() => engine.endTurn(botId))) {
          scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
        }
      },
      getView: () => engine.getPlayerView(botId),
    }, signal, instance);
  }, AI_TURN_TIMEOUT);

  if (result !== 'timed-out' || !instance.isCurrent() || engine.isGameOver()) return;

  // Auto-play mandatory kings, then advance the turn.
  engine.handleDisconnect(botId);
  engine.handleReconnect(botId);
  broadcastViews(io, roomCode, engine, roomManager);
  scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
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

      broadcastViews(io, roomCode, engine, roomManager);
      scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
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

      const isParticipant = roomManager.isGameParticipant(roomCode, playerId);
      if (isParticipant) engine.handleReconnect(playerId);
      const view = isParticipant ? engine.getPlayerView(playerId) : engine.getSpectatorView();
      roomManager.getGameInstance(roomCode)?.emitIfCurrent(() => {
        io.to(playerId).emit('game:state', view as never);
      });
    },
  }),

  validateAction: validateKingsCornerAction,

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

    switch (action.type) {
      case 'draw-card': {
        engine.drawCard(socket.data.playerId);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'play-card': {
        engine.playCard(socket.data.playerId, action.card, action.target);
        broadcastViews(io, roomCode, engine, roomManager);
        scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
        break;
      }

      case 'move-pile': {
        engine.movePile(socket.data.playerId, action.from, action.to);
        broadcastViews(io, roomCode, engine, roomManager);
        break;
      }

      case 'end-turn': {
        engine.endTurn(socket.data.playerId);
        broadcastViews(io, roomCode, engine, roomManager);
        scheduleAITurnIfNeeded(io, roomCode, engine, roomManager);
        break;
      }

      default:
        throw new GameRuleError('Unknown action', 'INVALID_ACTION');
    }
  },
};
