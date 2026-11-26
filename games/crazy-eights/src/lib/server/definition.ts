import { defineGame, type TypedGameDefinition } from '@parlor/multiplayer';
import { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import { DEFAULT_CONFIG, type CrazyEightsAction } from '../types/game.js';
import { validateCrazyEightsAction } from './validateAction.js';

/** Crazy Eights on the typed game contract (plan 3.1b). Exported for tests; servers use `crazyEightsDefinition`. */
export const crazyEightsGame: TypedGameDefinition<'crazy-eights', CrazyEightsEngine, CrazyEightsAction> = {
  meta: {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    description: 'Classic card game - match suits or ranks, play eights to change the suit',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: '10-15',
    tags: ['cards', 'classic', 'quick'],
    displayModes: ['peer'],
  },

  validateAction: validateCrazyEightsAction,

  createState: (roomCode, players) =>
    new CrazyEightsEngine(
      players.map((p) => ({ id: p.id, name: p.name })),
      roomCode,
      DEFAULT_CONFIG,
    ),

  actions: {
    'play-card': ({ state, playerId }, action) => state.playCard(playerId, action.card),
    'draw-card': ({ state, playerId }) => state.drawCard(playerId),
    pass: ({ state, playerId }) => state.pass(playerId),
    'choose-suit': ({ state, playerId }, action) => state.chooseSuit(playerId, action.suit),
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  onPlayerDisconnect: ({ state, playerId }) => state.handleDisconnect(playerId),
  onPlayerReconnect: ({ state, playerId }) => state.handleReconnect(playerId),

  // The seat is gone for good. The engine has no seat removal yet (skipping
  // removed seats is plan 3.9), so apply the same stand-in the disconnect path
  // uses: mark them gone and, if it is their turn now, take their turn for them
  // so the table is not left waiting on someone who cannot come back.
  onPlayerRemoved: ({ state, playerId }) => state.handleDisconnect(playerId),

  // Nothing to release: the engine holds no timers or outside resources, and the
  // core has already invalidated the game instance.
  onRoomDestroyed: () => undefined,
};

export const crazyEightsDefinition = defineGame(crazyEightsGame);
