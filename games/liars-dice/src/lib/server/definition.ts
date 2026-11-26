import { defineGame, UNCHANGED, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import { createPlayer, type LiarsDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateLiarsDiceAction } from './validateAction.js';

type Game = GameContext<LiarsDiceEngine>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;
const REVEAL_DELAY_MS = 3000;

function scheduleAITurnIfNeeded(game: Game): void {
  const state = game.state.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (state.gameOver || state.phase !== 'bidding' || !activePlayer.isAI || activePlayer.eliminated) return;
  game.instance.schedule(() => handleAITurn(game), 0, 'bot-turn');
}

/** Bind the reveal timer to its round because a player can advance it early. */
function scheduleNextRound(game: Game): void {
  const engine = game.state;
  if (engine.getState().gameOver) return;
  const round = engine.getState().round;
  game.instance.schedule(() => {
    const state = engine.getState();
    if (state.round !== round || state.gameOver) return;
    engine.startNextRound();
    game.broadcast();
    scheduleAITurnIfNeeded(game);
  }, REVEAL_DELAY_MS, 'round-reveal');
}

async function handleAITurn(game: Game): Promise<void> {
  const { state: engine, instance } = game;
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
      game.broadcast();
      scheduleAITurnIfNeeded(game);
    },
    onChallenge: () => {
      if (signal.aborted || !canAct()) return;
      engine.challenge(activePlayer.id);
      game.broadcast();
      scheduleNextRound(game);
    },
    onSpotOn: () => {
      if (signal.aborted || !canAct()) return;
      engine.spotOn(activePlayer.id);
      game.broadcast();
      scheduleNextRound(game);
    },
  }, signal, instance), AI_TURN_TIMEOUT);

  if (outcome !== 'timed-out' || !canAct()) return;
  if (engine.getState().currentBid) {
    engine.challenge(activePlayer.id);
    game.broadcast();
    scheduleNextRound(game);
  } else {
    engine.placeBid(activePlayer.id, 1, 2);
    game.broadcast();
    scheduleAITurnIfNeeded(game);
  }
}

/** The active bidder dropped: call the standing bid so the table is not left waiting. */
function challengeForAbsentBidder(game: Game, playerId: string): boolean {
  const state = game.state.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId || state.phase !== 'bidding' || !state.currentBid) return false;
  try {
    game.state.challenge(playerId);
  } catch {
    return false;
  }
  scheduleNextRound(game);
  return true;
}

/** Liar's Dice on the typed game contract (plan 3.1b). Servers use `liarsDiceDefinition`. */
export const liarsDiceGame: TypedGameDefinition<'liars-dice', LiarsDiceEngine, LiarsDiceAction> = {
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

  validateAction: validateLiarsDiceAction,

  createState: (roomCode, players) =>
    new LiarsDiceEngine(players.map((p) => createPlayer(p.id, p.name, p.isBot)), roomCode),

  // If the first player is a bot, start its turn.
  onGameStart: scheduleAITurnIfNeeded,

  actions: {
    bid: (game, action) => {
      game.state.placeBid(game.playerId, action.quantity, action.faceValue);
      scheduleAITurnIfNeeded(game);
    },
    challenge: (game) => game.state.challenge(game.playerId),
    'spot-on': (game) => game.state.spotOn(game.playerId),
    nextRound: (game) => {
      // Any player at the table (eliminated players included, they still see
      // the reveal) may advance, but only from a reveal phase; the engine checks both.
      game.state.requestNextRound(game.playerId);
      game.instance.cancel('round-reveal');
      scheduleAITurnIfNeeded(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.getState().gameOver,

  // If the disconnected player is the active bidder, auto-challenge.
  onPlayerDisconnect: (game) => (challengeForAbsentBidder(game, game.playerId) ? undefined : UNCHANGED),

  // A removed seat must not stall the table. Same stand-in as a disconnect; if
  // they were due to open the round (no bid to call), make the opening bid the
  // bot timeout fallback makes. Skipping their later turns is plan 3.9.
  onPlayerRemoved: (game) => {
    if (challengeForAbsentBidder(game, game.playerId)) return;
    const state = game.state.getState();
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer.id !== game.playerId || state.phase !== 'bidding' || state.gameOver) return UNCHANGED;
    game.state.placeBid(game.playerId, 1, 2);
    scheduleAITurnIfNeeded(game);
  },

  // Bot turns and the reveal timer live on the game instance, which the core
  // has already invalidated. Nothing else to release.
  onRoomDestroyed: () => undefined,
};

export const liarsDiceDefinition = defineGame(liarsDiceGame);
