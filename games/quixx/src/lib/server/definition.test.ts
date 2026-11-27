/**
 * CORE-AUDIT A-12: the phase-2 handler used to clear the room's turn timer
 * *before* `submitPhase2` checked the sender, so any non-active player (or a
 * spectator) could cancel the timer and stall the table. Validation now runs
 * first; only a successful submit cancels the timer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuleError, RoomManager } from '@parlor/multiplayer';
import { createActionSocket, createFakeIo } from '@parlor/multiplayer/testing';
import { quixxDefinition, quixxGame } from './definition.js';
import type { QuixxAction } from '../types/game.js';
import { QuixxEngine } from './game/QuixxEngine.js';

vi.mock(import('@parlor/multiplayer/random'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, secureRandomInt: (max: number) => Math.floor(Math.random() * max) };
});

const io = createFakeIo();

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  const rm = new RoomManager();
  const created = rm.createRoom('sa', 'A');
  const roomCode = created.roomCode;
  const b = rm.joinRoom(roomCode, 'sb', 'B').playerId!;
  const a = created.playerId;
  rm.selectGame(roomCode, quixxDefinition.meta);
  rm.setPlayerReady(a, true);
  rm.setPlayerReady(b, true);
  const players = rm.startGame(roomCode)!;
  const engine = new QuixxEngine(
    [
      { id: a, name: 'A', isBot: false },
      { id: b, name: 'B', isBot: false },
    ],
    roomCode,
    { diceRolling: 'player', turnTimer: 5, phase1Timer: null },
  );
  // Start through the definition so the game owns this engine and its instance.
  vi.spyOn(quixxGame, 'createState').mockReturnValueOnce(engine);
  quixxDefinition.createLobbyCallbacks(rm, io).onGameStart?.(roomCode, players, io);
  // Sync handler: a rule error throws straight out of `act`.
  const act = (playerId: string, action: QuixxAction): void => {
    void quixxDefinition.handleGameAction(io, createActionSocket(`socket-${playerId}`, { roomCode, playerId }), rm, action);
  };
  return { engine, act, a, b };
}

/** Roll, everyone passes phase 1 → phase 2 with the turn timer running. */
function toPhase2(t: ReturnType<typeof setup>) {
  const active = t.engine.getPlayers()[t.engine.getActivePlayerIndex()].id;
  const other = active === t.a ? t.b : t.a;
  t.act(active, { type: 'roll-dice' });
  t.act(active, { type: 'phase1-pass' });
  t.act(other, { type: 'phase1-pass' });
  expect(t.engine.getPhase()).toBe('phase2');
  return { active, other };
}

describe('Quixx phase-2 timer ordering', () => {
  it('a non-active phase2-pass is rejected and does not cancel the turn timer', () => {
    const t = setup();
    const { other } = toPhase2(t);
    const activeIndex = t.engine.getActivePlayerIndex();

    expect(() => t.act(other, { type: 'phase2-pass' })).toThrow(GameRuleError);
    expect(() => t.act('spectator', { type: 'phase2-pass' })).toThrow('Only the active player can act in phase2');
    expect(t.engine.getPhase()).toBe('phase2');

    // The timer still fires and auto-passes the active player.
    vi.advanceTimersByTime(5000);
    expect(t.engine.getPhase()).toBe('rolling');
    expect(t.engine.getActivePlayerIndex()).not.toBe(activeIndex);
  });

  it('a valid phase2-pass from the active player cancels the timer', () => {
    const t = setup();
    const { active } = toPhase2(t);
    t.act(active, { type: 'phase2-pass' });
    const afterTurn = t.engine.getActivePlayerIndex();
    expect(t.engine.getPhase()).toBe('rolling');
    vi.advanceTimersByTime(10_000);
    expect(t.engine.getActivePlayerIndex()).toBe(afterTurn);
    expect(t.engine.getPhase()).toBe('rolling');
  });

  it('roll-dice from a non-active player is NOT_YOUR_TURN', () => {
    const t = setup();
    const active = t.engine.getPlayers()[t.engine.getActivePlayerIndex()].id;
    const other = active === t.a ? t.b : t.a;
    try {
      t.act(other, { type: 'roll-dice' });
      expect.unreachable();
    } catch (err) {
      expect((err as GameRuleError).code).toBe('NOT_YOUR_TURN');
    }
    expect(t.engine.getPhase()).toBe('rolling');
  });
});

it('keeps the restarted game bot timer when the previous bot recheck becomes due', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.2);
  const rm = new RoomManager();
  const { roomCode, playerId } = rm.createRoom('host', 'Host');
  rm.selectGame(roomCode, quixxDefinition.meta);
  expect(rm.addBot(roomCode, 'Bot').success).toBe(true);
  rm.setPlayerReady(playerId, true);

  const gameIo = createFakeIo();
  const callbacks = quixxDefinition.createLobbyCallbacks(rm, gameIo);
  const players = rm.startGame(roomCode);
  expect(players).not.toBeNull();
  callbacks.onGameStart?.(roomCode, players!, gameIo);
  const originalEngine = quixxDefinition.typed.getState(rm, roomCode)!;
  const originalInstance = rm.getGameInstance(roomCode)!;
  const act = (type: 'phase1-pass' | 'phase2-pass') => {
    void quixxDefinition.handleGameAction(
      gameIo, createActionSocket('host', { roomCode, playerId }), rm, { type },
    );
  };

  vi.advanceTimersByTime(500);
  act('phase1-pass');
  vi.advanceTimersByTime(800);
  expect(originalEngine.getPhase()).toBe('phase2');
  act('phase2-pass');

  vi.advanceTimersByTime(500);
  act('phase1-pass');
  vi.advanceTimersByTime(1_600);
  expect(originalEngine.getActivePlayerIndex()).toBe(0);
  expect(originalEngine.getPhase()).toBe('rolling');
  expect(originalEngine.getRound()).toBe(2);

  const restartedPlayers = rm.restartGame(roomCode, () => callbacks.onGameReset?.(roomCode, gameIo));
  expect(restartedPlayers).not.toBeNull();
  expect(originalInstance.signal.aborted).toBe(true);
  callbacks.onGameStart?.(roomCode, restartedPlayers!, gameIo);
  const restartedEngine = quixxDefinition.typed.getState(rm, roomCode)!;
  const originalView = originalEngine.getPlayerView(playerId);
  vi.advanceTimersByTime(500);
  act('phase1-pass');
  expect(restartedEngine.getPhase()).toBe('phase1');

  gameIo.emitted.length = 0;
  vi.advanceTimersByTime(800);
  expect(restartedEngine.getPhase()).toBe('phase2');
  expect(originalEngine.getPlayerView(playerId)).toEqual(originalView);
  const last = gameIo.emitted.at(-1);
  expect([last?.to, last?.event, last?.args]).toEqual([
    playerId, 'game:state', [{ gameId: 'quixx', view: expect.objectContaining({ phase: 'phase2', round: 1 }) }],
  ]);
});
