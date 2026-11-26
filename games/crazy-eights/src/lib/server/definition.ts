import {
  defineGame,
  scheduleAbsentTurn,
  type GameContext,
  type TypedGameDefinition,
} from '@parlor/multiplayer';
import { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import { DEFAULT_CONFIG, type CrazyEightsAction } from '../types/game.js';
import { validateCrazyEightsAction } from './validateAction.js';

/**
 * After any change of turn: if the turn has reached a disconnected player, take
 * their stand-in turn (plan 3.9). Removed seats are skipped by the engine.
 */
function coverAbsentTurn(game: GameContext<CrazyEightsEngine>): void {
  const engine = game.state;
  scheduleAbsentTurn(game, {
    activePlayer: () => (engine.isGameOver() ? null : engine.getActivePlayerId()),
    isAbsent: (playerId) => !engine.isConnected(playerId),
    anyonePresent: () => engine.hasConnectedPlayer(),
    takeTurn: (playerId) => engine.takeAbsentTurn(playerId),
  });
}

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
    'play-card': (game, action) => {
      game.state.playCard(game.playerId, action.card);
      coverAbsentTurn(game);
    },
    'draw-card': (game) => {
      game.state.drawCard(game.playerId);
      coverAbsentTurn(game);
    },
    pass: (game) => {
      game.state.pass(game.playerId);
      coverAbsentTurn(game);
    },
    'choose-suit': (game, action) => {
      game.state.chooseSuit(game.playerId, action.suit);
      coverAbsentTurn(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  // A disconnected player keeps their seat for the grace window: their turn
  // gets a stand-in move now and each time it comes round until they return.
  onPlayerDisconnect: (game) => {
    game.state.handleDisconnect(game.playerId);
    coverAbsentTurn(game);
  },
  onPlayerReconnect: (game) => {
    game.state.handleReconnect(game.playerId);
    // Stand-ins pause while nobody is connected; a return resumes them.
    coverAbsentTurn(game);
  },

  // The seat is gone for good: stand in for this turn if it is theirs, then
  // take it out of the turn order (the game ends if one seat is left).
  onPlayerRemoved: (game) => {
    game.state.removePlayer(game.playerId);
    coverAbsentTurn(game);
  },

  // Nothing to release: the engine holds no timers or outside resources, and the
  // core has already invalidated the game instance.
  onRoomDestroyed: () => undefined,
};

export const crazyEightsDefinition = defineGame(crazyEightsGame);
