import { defineGame, GameRuleError, UNCHANGED, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { GameEngine } from './game/GameEngine.js';
import { createPlayer, type BootyDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateBootyDiceAction } from './validateAction.js';

type Game = GameContext<GameEngine>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;

function scheduleAITurnIfNeeded(game: Game): void {
  const state = game.state.getState();
  const player = state.players[state.currentPlayerIndex];
  if (state.phase === 'ended' || !player.isAI || player.isEliminated) return;
  game.instance.schedule(() => handleAITurn(game), 0, 'bot-turn');
}

/** Score the turn and pass it on. The caller broadcasts. */
function endTurn(game: Game): void {
  const engine = game.state;
  // A turn with no roll (only reachable from server-driven paths such as the AI
  // timeout fallback; players are rejected earlier) scores nothing.
  if (engine.hasRolledThisTurn()) {
    const resolution = engine.resolveTurn();
    if (resolution.winner) return;
  }
  engine.endTurn();
  scheduleAITurnIfNeeded(game);
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
 * The absent-player stand-in: if it is their turn, finish rolling, aim any
 * pending attacks at the first other live player, score (only if they rolled)
 * and pass the turn. Returns false when it was not their turn.
 */
function playTurnForAbsentPlayer(game: Game, playerId: string): boolean {
  const engine = game.state;
  const state = engine.getState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId || state.phase !== 'playing') return false;

  engine.finishRolling();

  // Auto-resolve any pending actions
  const updatedState = engine.getState();
  if (updatedState.turnPhase === 'selecting_targets') {
    const otherAlive = updatedState.players.filter((p) => p.id !== playerId && !p.isEliminated);
    for (const action of updatedState.pendingActions) {
      if (!action.resolved && otherAlive.length > 0) {
        engine.selectTarget(action.dieIndex, otherAlive[0].id);
      }
    }
  }

  // A player who drops before rolling forfeits the turn rather than scoring
  // the previous dice (CORE-AUDIT A-06).
  const resolution = engine.hasRolledThisTurn() ? engine.resolveTurn() : { winner: null };
  if (!resolution.winner) {
    engine.endTurn();
    scheduleAITurnIfNeeded(game);
  }
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
export const bootyDiceGame: TypedGameDefinition<'booty-dice', GameEngine, BootyDiceAction> = {
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

  validateAction: validateBootyDiceAction,

  createState: (roomCode, players) =>
    new GameEngine(players.map((p) => createPlayer(p.id, p.name, p.isBot)), roomCode),

  onGameStart: scheduleAITurnIfNeeded,

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

  // If it's the disconnected player's turn, auto-resolve and end it.
  onPlayerDisconnect: (game) => (playTurnForAbsentPlayer(game, game.playerId) ? undefined : UNCHANGED),

  // Same stand-in as a disconnect, for a seat whose turn came round while it
  // was in grace. Skipping the seat on later turns is plan 3.9.
  onPlayerRemoved: (game) => (playTurnForAbsentPlayer(game, game.playerId) ? undefined : UNCHANGED),

  // Bot turns live on the game instance, which the core has already invalidated.
  onRoomDestroyed: () => undefined,
};

export const bootyDiceDefinition = defineGame(bootyDiceGame);
