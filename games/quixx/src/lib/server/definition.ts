import { defineGame, GameRuleError, type GameContext, type TypedGameDefinition } from '@parlor/multiplayer';
import { DEFAULT_CONFIG, type QuixxAction } from '../types/game.js';
import { QuixxEngine } from './game/QuixxEngine.js';
import { scheduleBotActions } from './game/botController.js';
import { validateQuixxAction } from './validateAction.js';

type Game = GameContext<QuixxEngine>;

const PHASE_TIMER = 'phase';
const AUTO_ROLL = 'auto-roll';

function scheduleBots(game: Game): void {
  scheduleBotActions(game.instance, game.state, () => game.broadcast());
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
      if (!engine.isGameOver()) {
        startPhase2Timer(game);
        scheduleBots(game);
      }
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
    if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) autoRollIfNeeded(game);
    scheduleBots(game);
  }, turnTimer * 1000, PHASE_TIMER);
}

function autoRollIfNeeded(game: Game): void {
  const engine = game.state;
  game.instance.schedule(() => {
    if (engine.getPhase() !== 'rolling' || engine.isGameOver()) return;

    engine.rollDice();
    game.broadcast();
    startPhase1Timer(game);
    scheduleBots(game);
  }, 500, AUTO_ROLL);
}

/**
 * The disconnect stand-in: pass for the player in phase 1, and pass their
 * phase 2 turn if it is theirs. Returns which transition it caused.
 */
function passForAbsentPlayer(engine: QuixxEngine, playerId: string): 'resolved-phase1' | 'advanced' | null {
  let transition: 'resolved-phase1' | 'advanced' | null = null;
  if (engine.getPhase() === 'phase1') {
    try {
      engine.submitPhase1(playerId, { type: 'phase1-pass' });
      if (engine.allPhase1Submitted()) {
        engine.resolvePhase1();
        transition = 'resolved-phase1';
      }
    } catch {
      // Already submitted
    }
  }

  const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
  if (activePlayer.id === playerId && engine.getPhase() === 'phase2') {
    try {
      engine.submitPhase2(playerId, { type: 'phase2-pass' });
      if (!engine.isGameOver()) {
        engine.advanceTurn();
        transition = 'advanced';
      }
    } catch {
      // Ignore
    }
  }
  return transition;
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

  onGameStart: (game) => {
    if (game.state.shouldAutoRoll()) autoRollIfNeeded(game);
    else scheduleBots(game);
  },

  actions: {
    'roll-dice': (game) => {
      const engine = game.state;
      const activePlayer = engine.getPlayers()[engine.getActivePlayerIndex()];
      if (activePlayer.id !== game.playerId) {
        throw new GameRuleError('Not your turn', 'NOT_YOUR_TURN');
      }
      engine.rollDice();
      startPhase1Timer(game);
      scheduleBots(game);
    },
    'phase1-mark': (game, action) => submitPhase1(game, action),
    'phase1-pass': (game, action) => submitPhase1(game, action),
    'phase2-mark': (game, action) => submitPhase2(game, action),
    'phase2-pass': (game, action) => submitPhase2(game, action),
  },

  getPlayerView: (engine, playerId) => engine.getPlayerView(playerId),
  getSpectatorView: (engine) => engine.getSpectatorView(),
  isGameOver: (engine) => engine.isGameOver(),

  onPlayerDisconnect: (game) => {
    passForAbsentPlayer(game.state, game.playerId);
  },

  // Same stand-in as a disconnect, then carry the game on the way an action
  // would (phase 2 timer, auto-roll, bots) so the table cannot stall on this
  // seat right now. Skipping the seat in later rounds is plan 3.9.
  onPlayerRemoved: (game) => {
    const engine = game.state;
    const transition = passForAbsentPlayer(engine, game.playerId);
    if (engine.isGameOver()) return;
    if (transition === 'resolved-phase1') startPhase2Timer(game);
    if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) autoRollIfNeeded(game);
    scheduleBots(game);
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
    scheduleBots(game);
    return;
  }
  // Show everyone's submission before resolving, as before.
  game.broadcast();
  game.instance.cancel(PHASE_TIMER);
  engine.resolvePhase1();
  if (!engine.isGameOver()) {
    startPhase2Timer(game);
    scheduleBots(game);
  }
}

function submitPhase2(game: Game & { playerId: string }, action: Phase2Action): void {
  const engine = game.state;
  // submitPhase2 validates phase + active player before mutating; only a
  // successful submit may cancel the turn timer (CORE-AUDIT A-12).
  engine.submitPhase2(game.playerId, action);
  game.instance.cancel(PHASE_TIMER);
  if (engine.isGameOver()) return;

  engine.advanceTurn();
  if (engine.getPhase() === 'rolling' && engine.shouldAutoRoll()) autoRollIfNeeded(game);
  scheduleBots(game);
}

export const quixxDefinition = defineGame(quixxGame);
