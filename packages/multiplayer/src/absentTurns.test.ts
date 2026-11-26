import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from './gameInstance.js';
import { RoomManager } from './RoomManager.js';
import { scheduleAbsentTurn, type AbsentTurnPolicy } from './absentTurns.js';
import type { GameContext } from './defineGame.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A table of seats taking turns in order; `away` seats are absent. */
function table(seats: string[], away: Set<string>) {
  let turn = 0;
  const instance = new GameInstance(() => undefined);
  const broadcast = vi.fn();
  const game: GameContext<null> = { roomCode: 'R', state: null, instance, roomManager: new RoomManager(), broadcast };
  const takeTurn = vi.fn((_playerId: string) => { turn++; });
  const policy: AbsentTurnPolicy = {
    activePlayer: () => seats[turn % seats.length],
    isAbsent: (id) => away.has(id),
    anyonePresent: () => seats.some((id) => !away.has(id)),
    takeTurn,
  };
  return { game, policy, takeTurn, broadcast, instance, active: () => policy.activePlayer() };
}

describe('scheduleAbsentTurn', () => {
  it('stands in for consecutive absent seats and stops at the first present one, broadcasting each', async () => {
    const t = table(['a', 'b', 'c', 'd'], new Set(['a', 'b', 'c']));
    scheduleAbsentTurn(t.game, t.policy);
    expect(t.takeTurn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.takeTurn.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c']);
    expect(t.broadcast).toHaveBeenCalledTimes(3);
    expect(t.active()).toBe('d');
  });

  it('does nothing for a present seat, or when nobody at all is present', async () => {
    const present = table(['a', 'b'], new Set(['b']));
    scheduleAbsentTurn(present.game, present.policy);
    const empty = table(['a', 'b'], new Set(['a', 'b']));
    scheduleAbsentTurn(empty.game, empty.policy);
    await vi.advanceTimersByTimeAsync(10);
    expect(present.takeTurn).not.toHaveBeenCalled();
    expect(empty.takeTurn).not.toHaveBeenCalled();
  });

  it('re-checks when it runs: a player who came back, or a stale game, is left alone', async () => {
    const away = new Set(['a']);
    const back = table(['a', 'b'], away);
    scheduleAbsentTurn(back.game, back.policy);
    away.delete('a');
    const stale = table(['a', 'b'], new Set(['a']));
    scheduleAbsentTurn(stale.game, stale.policy);
    stale.instance.invalidate();
    await vi.advanceTimersByTimeAsync(10);
    expect(back.takeTurn).not.toHaveBeenCalled();
    expect(stale.takeTurn).not.toHaveBeenCalled();
  });
});
