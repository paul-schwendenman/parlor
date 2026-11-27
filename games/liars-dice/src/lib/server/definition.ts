import { defineGame, scheduleAbsentTurn, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import { createPlayer } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';
import { validateLiarsDiceAction } from './validateAction.js';
import { liarsDiceMeta } from '../../meta.js';

type Game = GameContext<LiarsDiceEngine>;

const aiPlayer = new AIPlayer();
const AI_TURN_TIMEOUT = 30_000;
const REVEAL_DELAY_MS = 3000;

/**
 * After any change of turn: a bot's turn is scheduled; a disconnected player's
 * bidding turn gets its stand-in (plan 3.9). Eliminated (and removed) seats are
 * skipped by the engine.
 */
function driveTurn(game: Game): void {
  const engine = game.state;
  const state = engine.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (state.gameOver || state.phase !== 'bidding' || activePlayer.eliminated) return;
  if (activePlayer.isAI) {
    game.instance.schedule(() => handleAITurn(game), 0, 'bot-turn');
    return;
  }

  scheduleAbsentTurn(game, {
    activePlayer: () => {
      const current = engine.getState();
      return current.gameOver || current.phase !== 'bidding' ? null : engine.getActivePlayerId();
    },
    isAbsent: (playerId) => engine.isAbsent(playerId),
    anyonePresent: () => engine.hasPresentPlayer(),
    takeTurn: (playerId) => standInTurn(game, playerId),
    afterTurn: () => driveTurn(game),
  });
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
    driveTurn(game);
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

  // The bot sees its own dice and the public table only (CORE-AUDIT D-11 / F-30).
  const outcome = await instance.runWithTimeout((signal) => aiPlayer.takeTurn(engine.getBotView(activePlayer.id), {
    onBid: (quantity, faceValue) => {
      if (signal.aborted || !canAct()) return;
      engine.placeBid(activePlayer.id, quantity, faceValue);
      game.broadcast();
      driveTurn(game);
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
    driveTurn(game);
  }
}

/**
 * The stand-in bidding turn for an absent player. In the grace window it must
 * not cost them a die, so it never challenges or calls: it opens with the
 * minimum bid, or raises the standing bid by the smallest legal amount (see
 * `LiarsDiceEngine.getStandInBid`). Only if no raise were possible would it
 * call the bid. Returns false when it was not their bidding turn.
 */
function standInTurn(game: Game, playerId: string): boolean {
  const state = game.state.getState();
  const activePlayer = state.players[state.activePlayerIndex];
  if (activePlayer.id !== playerId || state.phase !== 'bidding' || state.gameOver) return false;
  const bid = game.state.getStandInBid();
  if (bid) {
    game.state.placeBid(playerId, bid.quantity, bid.faceValue);
  } else {
    game.state.challenge(playerId);
    scheduleNextRound(game);
  }
  return true;
}

/** Liar's Dice on the typed game contract (plan 3.1b). Servers use `liarsDiceDefinition`. */
export const liarsDiceGame: TypedGameDefinition<'liars-dice', LiarsDiceEngine> = {
  meta: liarsDiceMeta,

  validateAction: validateLiarsDiceAction,

  createState: (roomCode, players) =>
    new LiarsDiceEngine(players.map((p) => createPlayer(p.id, p.name, p.isBot)), roomCode),

  // If the first player is a bot, start its turn.
  onGameStart: driveTurn,

  actions: {
    bid: (game, action) => {
      game.state.placeBid(game.playerId, action.quantity, action.faceValue);
      driveTurn(game);
    },
    challenge: (game) => game.state.challenge(game.playerId),
    'spot-on': (game) => game.state.spotOn(game.playerId),
    nextRound: (game) => {
      // Any player at the table (eliminated players included, they still see
      // the reveal) may advance, but only from a reveal phase; the engine checks both.
      game.state.requestNextRound(game.playerId);
      game.instance.cancel('round-reveal');
      driveTurn(game);
    },
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.getState().gameOver,

  // A disconnected player keeps their seat for the grace window: their bidding
  // turn gets a stand-in now and each time it comes round until they return.
  onPlayerDisconnect: (game) => {
    game.state.setConnected(game.playerId, false);
    standInTurn(game, game.playerId);
    driveTurn(game);
  },
  onPlayerReconnect: (game) => {
    game.state.setConnected(game.playerId, true);
    // Stand-ins pause while nobody is connected; a return resumes them.
    driveTurn(game);
  },

  // The seat is gone for good: it is eliminated with its dice, and the last
  // player standing wins.
  onPlayerRemoved: (game) => {
    game.state.forfeit(game.playerId);
    driveTurn(game);
  },

  // Bot turns and the reveal timer live on the game instance, which the core
  // has already invalidated. Nothing else to release.
  onRoomDestroyed: () => undefined,
};

export const liarsDiceDefinition = defineGame(liarsDiceGame);
