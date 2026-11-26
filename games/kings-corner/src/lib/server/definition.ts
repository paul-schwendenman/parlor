import {
  defineGame,
  isGameRuleError,
  RoomManager,
  scheduleAbsentTurn,
  type GameContext,
  type TypedGameDefinition,
} from '@parlor/multiplayer';
import { KingsCornerEngine } from './game/KingsCornerEngine.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { DEFAULT_CONFIG, type KingsCornerAction } from '../types/game.js';
import { validateKingsCornerAction } from './validateAction.js';

type Game = GameContext<KingsCornerEngine>;

const AI_TURN_TIMEOUT = 30_000;

/**
 * After any change of turn: a bot's turn is scheduled; a disconnected player's
 * turn gets its stand-in (plan 3.9). Removed seats are skipped by the engine.
 */
function driveTurn(game: Game): void {
  const { state: engine, instance } = game;
  if (!instance.isCurrent() || engine.isGameOver()) return;

  // The active seat comes from the engine's own seat order (CORE-AUDIT E-10 / C-05):
  // the lobby list shrinks when someone leaves, the engine's does not.
  const activeId = engine.getActivePlayerId();
  if (RoomManager.isBotPlayer(activeId)) {
    instance.schedule(() => handleAITurn(game, activeId), 0, 'bot-turn');
    return;
  }

  scheduleAbsentTurn(game, {
    activePlayer: () => (engine.isGameOver() ? null : engine.getActivePlayerId()),
    isAbsent: (playerId) => !engine.isConnected(playerId),
    anyonePresent: () => engine.hasConnectedPlayer(),
    takeTurn: (playerId) => engine.takeAbsentTurn(playerId),
    afterTurn: () => {
      if (RoomManager.isBotPlayer(engine.getActivePlayerId())) driveTurn(game);
    },
  });
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
        if (applyMove(() => engine.endTurn(botId))) driveTurn(game);
      },
      getView: () => engine.getPlayerView(botId),
    }, signal, instance);
  }, AI_TURN_TIMEOUT);

  if (result !== 'timed-out' || !instance.isCurrent() || engine.isGameOver()) return;

  // Draw, auto-play mandatory kings, then advance the turn.
  engine.takeTimedOutTurn(botId);
  game.broadcast();
  driveTurn(game);
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

  onGameStart: driveTurn,

  actions: {
    'draw-card': (game) => game.state.drawCard(game.playerId),
    'play-card': (game, action) => {
      game.state.playCard(game.playerId, action.card, action.target);
      driveTurn(game);
    },
    'move-pile': (game, action) => game.state.movePile(game.playerId, action.from, action.to),
    'end-turn': (game) => {
      game.state.endTurn(game.playerId);
      driveTurn(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  onPlayerDisconnect: (game) => {
    game.state.handleDisconnect(game.playerId);
    driveTurn(game);
  },
  onPlayerReconnect: (game) => {
    game.state.handleReconnect(game.playerId);
    // Stand-ins pause while nobody is connected; a return resumes them.
    driveTurn(game);
  },

  // The seat is gone for good: stand in for this turn if it is theirs, then
  // take it out of the turn order (the game ends if one seat is left).
  onPlayerRemoved: (game) => {
    game.state.removePlayer(game.playerId);
    driveTurn(game);
  },

  // Bot turns live on the game instance, which the core has already invalidated.
  onRoomDestroyed: () => undefined,
};

export const kingsCornerDefinition = defineGame(kingsCornerGame);
