import { defineGame, GameRuleError, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { DEFAULT_CONFIG, type QuixxAction } from '../types/game.js';
import { QuixxEngine } from './game/QuixxEngine.js';
import { scheduleBotActions } from './game/botController.js';
import { validateQuixxAction } from './validateAction.js';

type Game = GameContext<QuixxEngine>;

const PHASE_TIMER = 'phase';
const AUTO_ROLL = 'auto-roll';
const ABSENT = 'absent-turn';

/*
 * Every state change ends in one of three follow-ups, whoever made it (a
 * player, a bot, a timer or a stand-in):
 *   afterRoll     -> phase 1 timer, then drive
 *   afterResolve  -> phase 2 timer, then drive
 *   drive         -> auto-roll, stand-ins for absent seats, the next bot move
 * (CORE-AUDIT C-03 / B-04: before, only the human paths auto-rolled.)
 */

function afterRoll(game: Game): void {
  startPhase1Timer(game);
  drive(game);
}

function afterResolve(game: Game): void {
  startPhase2Timer(game);
  drive(game);
}

function drive(game: Game): void {
  const engine = game.state;
  if (!game.instance.isCurrent() || engine.isGameOver()) return;
  if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) autoRollIfNeeded(game);
  scheduleBotActions(game.instance, engine, {
    broadcast: () => game.broadcast(),
    rolled: () => afterRoll(game),
    resolved: () => afterResolve(game),
    advanced: () => drive(game),
  });
  scheduleStandIn(game);
}

function startPhase1Timer(game: Game): void {
  const engine = game.state;
  const { phase1Timer } = engine.getConfig();
  if (!phase1Timer) return;

  game.instance.schedule(() => {
    if (engine.getPhase() !== 'phase1' || engine.isGameOver()) return;

    for (const player of engine.getPlayers()) {
      if (player.phase1Decision === null) {
        engine.submitPhase1(player.id, { type: 'phase1-pass' });
      }
    }

    if (engine.allPhase1Submitted()) {
      engine.resolvePhase1();
      game.broadcast();
      if (!engine.isGameOver()) afterResolve(game);
    }
  }, phase1Timer * 1000, PHASE_TIMER);
}

function startPhase2Timer(game: Game): void {
  const engine = game.state;
  const { turnTimer } = engine.getConfig();
  if (!turnTimer) return;

  game.instance.schedule(() => {
    if (engine.getPhase() !== 'phase2' || engine.isGameOver()) return;

    const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
    engine.submitPhase2(activePlayer.id, { type: 'phase2-pass' });
    if (engine.isGameOver()) {
      game.broadcast();
      return;
    }

    engine.advanceTurn();
    game.broadcast();
    drive(game);
  }, turnTimer * 1000, PHASE_TIMER);
}

function autoRollIfNeeded(game: Game): void {
  const engine = game.state;
  game.instance.schedule(() => {
    if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;

    engine.rollDice();
    game.broadcast();
    afterRoll(game);
  }, 500, AUTO_ROLL);
}

/**
 * Does an absent seat (disconnected in grace, or removed) hold up the game right
 * now? Phase 1: an absent seat has not decided. Rolling: the active seat is
 * removed, or is disconnected in player-roll mode (auto-roll rolls for it
 * otherwise). Phase 2: the active seat is absent.
 */
function standInNeeded(engine: QuixxEngine): boolean {
  if (engine.isGameOver()) return false;
  const activeId = engine.getActivePlayerId();
  switch (engine.getPhase()) {
    case 'phase1':
      return engine.getPlayers().some((p) => p.phase1Decision === null && engine.isAbsent(p.id));
    case 'rolling':
      return engine.isAbsent(activeId) && (engine.isRemoved(activeId) || !engine.shouldAutoRoll());
    case 'phase2':
      return engine.isAbsent(activeId);
    default:
      return false;
  }
}

/**
 * The stand-in moves for absent seats. None of them penalises the seat: phase 1
 * is passed (no cost on its own); an absent active seat's phase 2 is skipped
 * with no penalty, although a present player passing both phases takes one; in
 * player-roll mode the roll is made for them (it costs nothing, and the table
 * needs it); a removed active seat is skipped without a roll. Runs the
 * follow-up for whatever transition it caused.
 */
function standIn(game: Game): void {
  const engine = game.state;
  const activeId = engine.getActivePlayerId();
  switch (engine.getPhase()) {
    case 'phase1': {
      for (const player of engine.getPlayers()) {
        if (player.phase1Decision === null && engine.isAbsent(player.id)) {
          engine.submitPhase1(player.id, { type: 'phase1-pass' });
        }
      }
      if (!engine.allPhase1Submitted()) return drive(game);
      game.instance.cancel(PHASE_TIMER);
      engine.resolvePhase1();
      if (!engine.isGameOver()) afterResolve(game);
      return;
    }
    case 'rolling':
      if (engine.isRemoved(activeId)) {
        engine.skipAbsentTurn();
        return drive(game);
      }
      engine.rollDice();
      return afterRoll(game);
    case 'phase2':
      game.instance.cancel(PHASE_TIMER);
      engine.skipAbsentTurn();
      return drive(game);
  }
}

/** Schedule the stand-in when an absent seat holds up the game, unless nobody is present. */
function scheduleStandIn(game: Game): void {
  const engine = game.state;
  if (!standInNeeded(engine) || !engine.hasPresentPlayer()) return;
  game.instance.schedule(() => {
    if (!standInNeeded(engine) || !engine.hasPresentPlayer()) return;
    standIn(game);
    game.broadcast();
  }, 0, ABSENT);
}

/** Quixx on the typed game contract (plan 3.1b). Servers use `quixxDefinition`. */
export const quixxGame: TypedGameDefinition<'quixx', QuixxEngine, QuixxAction> = {
  meta: {
    id: 'quixx',
    name: 'Quixx',
    description: 'A fast-paced dice game of marking numbers and strategic choices',
    minPlayers: 2,
    maxPlayers: 5,
    estimatedMinutes: '15-20',
    tags: ['dice', 'strategy', 'quick'],
    displayModes: ['peer'],
    supportsBots: true,
  },

  validateAction: validateQuixxAction,

  createState: (roomCode, players) =>
    new QuixxEngine(
      players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
      roomCode,
      DEFAULT_CONFIG,
    ),

  onGameStart: drive,

  actions: {
    'roll-dice': (game) => {
      const engine = game.state;
      const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
      if (activePlayer.id !== game.playerId) {
        throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
      }
      engine.rollDice();
      afterRoll(game);
    },
    'phase1-mark': (game, action) => submitPhase1(game, action),
    'phase1-pass': (game, action) => submitPhase1(game, action),
    'phase2-mark': (game, action) => submitPhase2(game, action),
    'phase2-pass': (game, action) => submitPhase2(game, action),
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  // A disconnected player keeps their seat for the grace window: they pass
  // phase 1, pass phase 2 when it is their turn, and (player-roll mode) have
  // their roll made for them, now and until they return.
  onPlayerDisconnect: (game) => {
    game.state.setConnected(game.playerId, false);
    if (standInNeeded(game.state)) standIn(game);
    else drive(game);
  },
  onPlayerReconnect: (game) => {
    game.state.setConnected(game.playerId, true);
    // Stand-ins pause while nobody is present; a return resumes them.
    drive(game);
  },

  // The seat is gone for good: it passes phase 1 from now on and its turns are
  // skipped. With one seat left, the game ends and is scored.
  onPlayerRemoved: (game) => {
    game.state.removePlayer(game.playerId);
    if (standInNeeded(game.state)) standIn(game);
    else drive(game);
  },

  // Timers and bots live on the game instance, which the core has already invalidated.
  onRoomDestroyed: () => undefined,
};

type Phase1Action = Extract<QuixxAction, { type: 'phase1-mark' | 'phase1-pass' }>;
type Phase2Action = Extract<QuixxAction, { type: 'phase2-mark' | 'phase2-pass' }>;

function submitPhase1(game: Game & { playerId: string }, action: Phase1Action): void {
  const engine = game.state;
  engine.submitPhase1(game.playerId, action);
  if (!engine.allPhase1Submitted()) {
    drive(game);
    return;
  }
  // Show everyone's submission before resolving, as before.
  game.broadcast();
  game.instance.cancel(PHASE_TIMER);
  engine.resolvePhase1();
  if (!engine.isGameOver()) afterResolve(game);
}

function submitPhase2(game: Game & { playerId: string }, action: Phase2Action): void {
  const engine = game.state;
  // submitPhase2 validates phase + active player before mutating; only a
  // successful submit may cancel the turn timer (CORE-AUDIT A-12).
  engine.submitPhase2(game.playerId, action);
  game.instance.cancel(PHASE_TIMER);
  if (engine.isGameOver()) return;

  engine.advanceTurn();
  drive(game);
}

export const quixxDefinition = defineGame(quixxGame);
