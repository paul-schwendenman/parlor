/**
 * CORE-AUDIT A-12: the phase-2 handler used to clear the room's turn timer
 * *before* `submitPhase2` checked the sender, so any non-active player (or a
 * spectator) could cancel the timer and stall the table. Validation now runs
 * first; only a successful submit cancels the timer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuleError, RoomManager, type AppServer } from '@parlor/multiplayer';
import { quixxDefinition, cleanupRoomTimers } from './definition.js';
import { QuixxEngine } from './game/QuixxEngine.js';

const io = { to: () => ({ emit: () => {} }) } as unknown as AppServer;

let roomCode: string;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanupRoomTimers(roomCode);
  vi.useRealTimers();
});

function setup() {
  const rm = new RoomManager();
  const created = rm.createRoom('sa', 'A');
  roomCode = created.roomCode;
  const b = rm.joinRoom(roomCode, 'sb', 'B').playerId!;
  const a = created.playerId;
  const engine = new QuixxEngine(
    [
      { id: a, name: 'A', isBot: false },
      { id: b, name: 'B', isBot: false },
    ],
    roomCode,
    { diceRolling: 'player', turnTimer: 5, phase1Timer: null },
  );
  rm.setGameData(roomCode, engine);
  // Sync handler: a rule error throws straight out of `act`.
  const act = (playerId: string, action: Record<string, unknown>): void => {
    void quixxDefinition.handleGameAction(io, { data: { roomCode, playerId }, emit: vi.fn() } as never, rm, action);
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
