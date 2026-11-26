import { defineGame, isGameRuleError, RoomManager, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { KingsCornerEngine } from './game/KingsCornerEngine.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { DEFAULT_CONFIG, type KingsCornerAction } from '../types/game.js';
import { validateKingsCornerAction } from './validateAction.js';

type Game = GameContext<KingsCornerEngine>;

const AI_TURN_TIMEOUT = 30_000;

function scheduleAITurnIfNeeded(game: Game): void {
  const { state: engine, instance, roomManager, roomCode } = game;
  if (!instance.isCurrent() || engine.isGameOver()) return;

  // Known issue (CORE-AUDIT E-10, plan 3.9): this indexes the lobby's seat list
  // with the engine's active index. Kept as is until 3.9.
  const activeIndex = engine.getActivePlayerIndex();
  const players = roomManager.getGamePlayers(roomCode);
  const activePlayer = players[activeIndex];
  if (!activePlayer || !RoomManager.isBotPlayer(activePlayer.id)) return;

  instance.schedule(() => handleAITurn(game, activePlayer.id), 0, 'bot-turn');
}

async function handleAITurn(game: Game, botId: string): Promise<void> {
  const { state: engine, instance } = game;
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
      game.broadcast();
      return true;
    }

    return aiPlayer.takeTurn({
      onDrawCard: () => applyMove(() => engine.drawCard(botId)),
      onPlayCard: (card, target) => applyMove(() => engine.playCard(botId, card, target)),
      onMovePile: (from, to) => applyMove(() => engine.movePile(botId, from, to)),
      onEndTurn: () => {
        if (applyMove(() => engine.endTurn(botId))) scheduleAITurnIfNeeded(game);
      },
      getView: () => engine.getPlayerView(botId),
    }, signal, instance);
  }, AI_TURN_TIMEOUT);

  if (result !== 'timed-out' || !instance.isCurrent() || engine.isGameOver()) return;

  // Auto-play mandatory kings, then advance the turn.
  engine.handleDisconnect(botId);
  engine.handleReconnect(botId);
  game.broadcast();
  scheduleAITurnIfNeeded(game);
}

/** Kings Corner on the typed game contract (plan 3.1b). Servers use `kingsCornerDefinition`. */
export const kingsCornerGame: TypedGameDefinition<'kings-corner', KingsCornerEngine, KingsCornerAction> = {
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

  validateAction: validateKingsCornerAction,

  createState: (roomCode, players) =>
    new KingsCornerEngine(
      players.map((p) => ({ id: p.id, name: p.name })),
      roomCode,
      DEFAULT_CONFIG,
    ),

  onGameStart: scheduleAITurnIfNeeded,

  actions: {
    'draw-card': (game) => game.state.drawCard(game.playerId),
    'play-card': (game, action) => {
      game.state.playCard(game.playerId, action.card, action.target);
      scheduleAITurnIfNeeded(game);
    },
    'move-pile': (game, action) => game.state.movePile(game.playerId, action.from, action.to),
    'end-turn': (game) => {
      game.state.endTurn(game.playerId);
      scheduleAITurnIfNeeded(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  onPlayerDisconnect: (game) => {
    game.state.handleDisconnect(game.playerId);
    scheduleAITurnIfNeeded(game);
  },
  onPlayerReconnect: (game) => game.state.handleReconnect(game.playerId),

  // Same stand-in as a disconnect: mark the seat gone and, if it is their turn,
  // play their mandatory kings and pass. Skipping their later turns is plan 3.9.
  onPlayerRemoved: (game) => {
    game.state.handleDisconnect(game.playerId);
    scheduleAITurnIfNeeded(game);
  },

  // Bot turns live on the game instance, which the core has already invalidated.
  onRoomDestroyed: () => undefined,
};

export const kingsCornerDefinition = defineGame(kingsCornerGame);
