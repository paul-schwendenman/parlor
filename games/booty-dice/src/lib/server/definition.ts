import {
  defineGame,
  GameRuleError,
  scheduleAbsentTurn,
  type GameContext,
  type TypedGameDefinition,
} from '@parlor/multiplayer';
import { GameEngine } from './game/GameEngine.js';
import { createPlayer } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateBootyDiceAction } from './validateAction.js';
import { bootyDiceMeta } from '../../meta.js';

type Game = GameContext<GameEngine>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

/**
 * After any change of turn: a bot's turn is scheduled; a disconnected player's
 * turn gets its stand-in (plan 3.9). Eliminated (and removed) seats are skipped
 * by the engine.
 */
function driveTurn(game: Game): void {
  const engine = game.state;
  const state = engine.getState();
  const player = state.players[state.currentPlayerIndex];
  if (state.phase === 'ended' || player.isEliminated) return;
  if (player.isAI) {
    game.instance.schedule(() => handleAITurn(game), 0, 'bot-turn');
    return;
  }

  scheduleAbsentTurn(game, {
    activePlayer: () => (engine.getState().phase === 'ended' ? null : engine.getCurrentPlayer().id),
    isAbsent: (playerId) => {
      const seat = engine.getState().players.find((p) => p.id === playerId);
      return !!seat && !seat.isAI && !seat.isConnected;
    },
    anyonePresent: () => engine.hasPresentPlayer(),
    takeTurn: (playerId) => standInTurn(engine, playerId),
    afterTurn: () => {
      if (engine.getCurrentPlayer().isAI) driveTurn(game);
    },
  });
}

/** Resolve an existing roll and advance if the game is still running. */
function settleTurn(engine: GameEngine): void {
  if (engine.hasRolledThisTurn()) engine.resolveTurn();
  engine.endTurn();
}

/** Score the turn and pass it on. The caller broadcasts. */
function endTurn(game: Game): void {
  settleTurn(game.state);
  driveTurn(game);
}

async function handleAITurn(game: Game): Promise<void> {
  const { state: engine, instance } = game;
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
      game.broadcast();
    },
    onRoll: () => {
      if (signal.aborted || !canAct()) return Promise.resolve(state.dice);
      const result = engine.roll();
      game.broadcast();
      return Promise.resolve(result.dice);
    },
    onFinishRolling: () => {
      if (signal.aborted || !canAct()) return;
      engine.finishRolling();
      game.broadcast();
    },
    onSelectTarget: (dieIndex, targetId) => {
      if (signal.aborted || !canAct()) return;
      engine.selectTarget(dieIndex, targetId);
      game.broadcast();
    },
    onEndTurn: () => {
      if (signal.aborted || !canAct()) return;
      endTurn(game);
      game.broadcast();
    },
  }, signal, instance), AI_TURN_TIMEOUT);

  if (outcome === 'timed-out' && canAct()) {
    engine.finishRolling();
    endTurn(game);
    game.broadcast();
  }
}

/**
 * End the absent player's turn without making any more choices. A turn that
 * has already rolled resolves normally. Targeted dice only apply when the
 * player already chose a target. A turn that never rolled is simply passed.
 */
function standInTurn(engine: GameEngine, playerId: string): boolean {
  const state = engine.getState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId || state.phase !== 'playing') return false;
  settleTurn(engine);
  return true;
}

function requireRolled(engine: GameEngine, message: string): void {
  if (!engine.hasRolledThisTurn()) throw new GameRuleError(message);
}

function requireActivePlayer(engine: GameEngine, playerId: string): ReturnType<GameEngine['getState']> {
  const state = engine.getState();
  if (state.players[state.currentPlayerIndex].id !== playerId) {
    throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
  }
  return state;
}

function requireRolling(engine: GameEngine, playerId: string): void {
  const state = requireActivePlayer(engine, playerId);
  if (state.turnPhase !== 'rolling') throw new GameRuleError('You can only do that while rolling');
}

/** Booty Dice on the typed game contract (plan 3.1b). Servers use `bootyDiceDefinition`. */
export const bootyDiceGame: TypedGameDefinition<'booty-dice', GameEngine> = {
  meta: bootyDiceMeta,

  validateAction: validateBootyDiceAction,

  createState: (roomCode, players) =>
    new GameEngine(players.map((p) => createPlayer(p.id, p.name, p.isBot)), roomCode),

  onGameStart: driveTurn,

  actions: {
    roll: (game) => {
      requireRolling(game.state, game.playerId);
      game.state.roll();
    },
    lockDice: (game, action) => {
      requireRolling(game.state, game.playerId);
      // Locking before the first roll would keep the previous player's (or the
      // opening) dice through the roll (CORE-AUDIT A-06).
      requireRolled(game.state, 'Roll before locking dice');
      game.state.lockDice(action.diceIndices);
    },
    finishRolling: (game) => {
      requireRolling(game.state, game.playerId);
      requireRolled(game.state, 'Roll at least once first');
      game.state.finishRolling();
    },
    selectTarget: (game, action) => {
      const state = requireActivePlayer(game.state, game.playerId);
      if (state.turnPhase !== 'selecting_targets') throw new GameRuleError('Not selecting targets');
      game.state.selectTarget(action.dieIndex, action.targetPlayerId);
    },
    endTurn: (game) => {
      const state = requireActivePlayer(game.state, game.playerId);
      if (state.phase !== 'playing') throw new GameRuleError('The game is not in progress');
      // Without a roll this turn, resolveTurn would score the opening or the
      // previous player's dice (CORE-AUDIT A-06).
      requireRolled(game.state, 'You must roll before ending your turn');
      if (game.state.hasUnresolvedTargets()) {
        throw new GameRuleError('Select targets for all attacks and steals first');
      }
      endTurn(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.getState().phase === 'ended',

  // A disconnected player keeps their seat for the grace window: their turn
  // gets a stand-in now and each time it comes round until they return.
  onPlayerDisconnect: (game) => {
    game.state.setConnected(game.playerId, false);
    standInTurn(game.state, game.playerId);
    driveTurn(game);
  },
  onPlayerReconnect: (game) => {
    game.state.setConnected(game.playerId, true);
    // Stand-ins pause while nobody is connected; a return resumes them.
    driveTurn(game);
  },

  // The seat is gone for good: it is eliminated (its turn, if current, ends
  // unscored), and the last pirate standing wins.
  onPlayerRemoved: (game) => {
    game.state.forfeit(game.playerId);
    driveTurn(game);
  },

  // Bot turns live on the game instance, which the core has already invalidated.
  onRoomDestroyed: () => undefined,
};

export const bootyDiceDefinition = defineGame(bootyDiceGame);
