import {
  defineGame,
  RoomManager,
  scheduleAbsentTurn,
  type GameContext,
  type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import { DEFAULT_CONFIG } from '../types/game.js';
import { takeBotStep } from './game/takeBotStep.js';
import { validateCrazyEightsAction } from './validateAction.js';

function driveTurn(game: GameContext<CrazyEightsEngine>): void {
  const { state: engine, instance } = game;
  if (!instance.isCurrent() || engine.isGameOver()) return;

  const activeId = engine.getActivePlayerId();
  if (RoomManager.isBotPlayer(activeId)) {
    instance.schedule(() => {
      if (engine.isGameOver() || engine.getActivePlayerId() !== activeId) return;
      takeBotStep(engine, activeId);
      game.broadcast();
      driveTurn(game);
    }, 450, 'bot-turn');
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

/** Crazy Eights on the typed game contract (plan 3.1b). Exported for tests; servers use `crazyEightsDefinition`. */
export const crazyEightsGame: TypedGameDefinition<'crazy-eights', CrazyEightsEngine> = {
  meta: {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    description: 'Classic card game - match suits or ranks, play eights to change the suit',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: '10-15',
    tags: ['cards', 'classic', 'quick'],
    displayModes: ['peer'],
    supportsBots: true,
  },

  validateAction: validateCrazyEightsAction,

  createState: (roomCode, players) =>
    new CrazyEightsEngine(
      players.map((p) => ({ id: p.id, name: p.name })),
      roomCode,
      DEFAULT_CONFIG,
    ),

  onGameStart: driveTurn,

  actions: {
    'play-card': (game, action) => {
      game.state.playCard(game.playerId, action.card);
      driveTurn(game);
    },
    'draw-card': (game) => {
      game.state.drawCard(game.playerId);
      driveTurn(game);
    },
    pass: (game) => {
      game.state.pass(game.playerId);
      driveTurn(game);
    },
    'choose-suit': (game, action) => {
      game.state.chooseSuit(game.playerId, action.suit);
      driveTurn(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  // A disconnected player keeps their seat for the grace window: their turn
  // gets a stand-in move now and each time it comes round until they return.
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

  // The game instance cancels pending bot and stand-in turns on destruction.
  onRoomDestroyed: () => undefined,
};

export const crazyEightsDefinition = defineGame(crazyEightsGame);
