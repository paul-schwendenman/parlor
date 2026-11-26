import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRuleError } from '@parlor/multiplayer';
import { createDispatchHarness } from '@parlor/multiplayer/testing';
import { quixxDefinition } from './definition.js';
import { validateQuixxAction } from './validateAction.js';
import { QuixxEngine } from './game/QuixxEngine.js';
import { ROW_NUMBERS } from '../types/game.js';

describe('validateQuixxAction: valid actions are rebuilt from validated fields', () => {
  it.each([
    [{ type: 'roll-dice' }],
    [{ type: 'phase1-pass' }],
    [{ type: 'phase2-pass' }],
    [{ type: 'phase1-mark', row: 'red', cellIndex: 0 }],
    [{ type: 'phase1-mark', row: 'blue', cellIndex: 10 }],
    [{ type: 'phase2-mark', row: 'green', cellIndex: 5 }],
    [{ type: 'phase2-mark', row: 'yellow', cellIndex: 3 }],
  ])('%j', (action) => {
    const result = validateQuixxAction(action);
    expect(result).toEqual({ ok: true, action });
    expect(result.ok && result.action).not.toBe(action);
  });
});

const INVALID: [string, Record<string, unknown>][] = [
  ['unknown type', { type: 'lock-row' }],
  ['missing row', { type: 'phase1-mark', cellIndex: 0 }],
  ['missing cellIndex', { type: 'phase1-mark', row: 'red' }],
  ['unknown row', { type: 'phase1-mark', row: 'purple', cellIndex: 0 }],
  ['row not a string', { type: 'phase2-mark', row: 0, cellIndex: 0 }],
  ['string cellIndex (A-08 coerce)', { type: 'phase1-mark', row: 'red', cellIndex: '10' }],
  ['array cellIndex', { type: 'phase1-mark', row: 'red', cellIndex: [10] }],
  ['non-integer cellIndex', { type: 'phase1-mark', row: 'red', cellIndex: 1.5 }],
  ['cellIndex out of range', { type: 'phase2-mark', row: 'red', cellIndex: 11 }],
  ['negative cellIndex', { type: 'phase1-mark', row: 'red', cellIndex: -1 }],
  ['extra key on mark', { type: 'phase1-mark', row: 'red', cellIndex: 0, sheet: {} }],
  ['extra key on pass', { type: 'phase1-pass', playerId: 'x' }],
];

describe('Quixx actions through the boundary', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(INVALID)('%s → INVALID_ACTION, state unchanged, valid pass afterward works', async (_label, action) => {
    const h = createDispatchHarness(quixxDefinition);
    vi.advanceTimersByTime(600); // DEFAULT_CONFIG auto-rolls after 500 ms
    const engine = h.roomManager.getGameData<QuixxEngine>(h.roomCode)!;
    expect(engine.getPhase()).toBe('phase1');
    const [a] = h.playerIds;
    const before = JSON.stringify(engine.getPlayerView(a));

    expect(await h.send(a, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(JSON.stringify(engine.getPlayerView(a))).toBe(before);
    expect(h.roomFailures).toEqual([]);

    expect(await h.send(a, { type: 'phase1-pass' })).toEqual({ ok: true });
    expect(engine.getPlayers().find((p) => p.id === a)!.phase1Decision).toEqual({ type: 'pass' });
  });
});

/** Port of docs/audit-repros/crash/quixx-coerce.mts (CORE-AUDIT A-08). */
describe('Quixx string cellIndex bypass', () => {
  function engineWithWhiteSum(target: number): QuixxEngine {
    for (let i = 0; i < 5000; i++) {
      const e = new QuixxEngine(
        [
          { id: 'a', name: 'A', isBot: false },
          { id: 'b', name: 'B', isBot: false },
        ],
        'X',
      );
      const d = e.rollDice();
      if (d.white1 + d.white2 === target) return e;
    }
    throw new Error('could not roll the target sum');
  }

  it("the engine rejects cellIndex '10' (was: locks red with 0 prior marks)", () => {
    const e = engineWithWhiteSum(ROW_NUMBERS.red[10]);
    expect(() =>
      e.submitPhase1('a', { type: 'phase1-mark', row: 'red', cellIndex: '10' as unknown as number }),
    ).toThrow(GameRuleError);
    expect(e.getPlayers()[0].phase1Decision).toBeNull();
    e.submitPhase1('a', { type: 'phase1-pass' });
    e.submitPhase1('b', { type: 'phase1-pass' });
    e.resolvePhase1();
    expect(e.getPlayers()[0].sheet.red.every((cell) => !cell)).toBe(true);
    expect(e.getLockedRows()).toEqual([]);
  });

  it('the validator rejects it before the engine is reached', () => {
    expect(validateQuixxAction({ type: 'phase1-mark', row: 'red', cellIndex: '10' })).toMatchObject({ ok: false });
  });
});
