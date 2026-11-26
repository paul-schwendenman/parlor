import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '@parlor/multiplayer';
import { createDispatchHarness, type DispatchHarness } from '@parlor/multiplayer/testing';
import { bootyDiceDefinition } from './definition.js';
import { validateBootyDiceAction } from './validateAction.js';
import type { GameEngine } from './game/GameEngine.js';

describe('validateBootyDiceAction: valid actions are rebuilt from validated fields', () => {
  it.each([
    [{ type: 'roll' }],
    [{ type: 'finishRolling' }],
    [{ type: 'endTurn' }],
    [{ type: 'lockDice', diceIndices: [0, 2] }],
    [{ type: 'lockDice', diceIndices: [] }],
    [{ type: 'lockDice', diceIndices: [5, 4, 3, 2, 1, 0] }],
    [{ type: 'selectTarget', dieIndex: 3, targetPlayerId: 'abc-123' }],
  ])('%j', (action) => {
    const result = validateBootyDiceAction(action);
    expect(result).toEqual({ ok: true, action });
    expect(result.ok && result.action).not.toBe(action);
  });
});

const INVALID: [string, Record<string, unknown>][] = [
  ['unknown type', { type: 'plunder' }],
  ['missing diceIndices', { type: 'lockDice' }],
  ['diceIndices not an array', { type: 'lockDice', diceIndices: 3 }],
  ['string index', { type: 'lockDice', diceIndices: ['0'] }],
  ['non-integer index', { type: 'lockDice', diceIndices: [0.5] }],
  ['index out of range', { type: 'lockDice', diceIndices: [6] }],
  ['duplicate indices', { type: 'lockDice', diceIndices: [1, 1] }],
  ['too many indices', { type: 'lockDice', diceIndices: [0, 1, 2, 3, 4, 5, 0] }],
  ['missing targetPlayerId', { type: 'selectTarget', dieIndex: 0 }],
  ['target not a string', { type: 'selectTarget', dieIndex: 0, targetPlayerId: [[1]] }],
  ['empty target', { type: 'selectTarget', dieIndex: 0, targetPlayerId: '' }],
  ['dieIndex out of range', { type: 'selectTarget', dieIndex: 9, targetPlayerId: 'x' }],
  ['string dieIndex', { type: 'selectTarget', dieIndex: '1', targetPlayerId: 'x' }],
  ['extra key on lock', { type: 'lockDice', diceIndices: [0], all: true }],
  ['extra key on endTurn', { type: 'endTurn', score: 25 }],
];

function setup() {
  const h = createDispatchHarness(bootyDiceDefinition);
  const engine = h.roomManager.getGameData<GameEngine>(h.roomCode)!;
  const current = () => engine.getState().players[engine.getState().currentPlayerIndex];
  const doubloons = () => engine.getState().players.map((p) => p.doubloons);
  return { h, engine, current, doubloons };
}

/** A complete legal turn for the current player: roll once, finish, pick targets, end. */
async function playTurn(h: DispatchHarness, engine: GameEngine): Promise<void> {
  const me = engine.getState().players[engine.getState().currentPlayerIndex];
  const other = engine.getState().players.find((p) => p.id !== me.id)!;
  expect(await h.send(me.id, { type: 'roll' })).toEqual({ ok: true });
  expect(await h.send(me.id, { type: 'finishRolling' })).toEqual({ ok: true });
  for (const pending of engine.getState().pendingActions) {
    expect(
      await h.send(me.id, { type: 'selectTarget', dieIndex: pending.dieIndex, targetPlayerId: other.id }),
    ).toEqual({ ok: true });
  }
  expect(await h.send(me.id, { type: 'endTurn' })).toEqual({ ok: true });
}

describe('Booty Dice actions through the boundary', () => {
  it.each(INVALID)('%s → INVALID_ACTION, state unchanged, valid roll afterward works', async (_label, action) => {
    const { h, engine, current } = setup();
    const before = engine.getState();

    expect(await h.send(current().id, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(engine.getState()).toEqual(before);
    expect(h.roomFailures).toEqual([]);

    expect(await h.send(current().id, { type: 'roll' })).toEqual({ ok: true });
    expect(engine.getState().rollsRemaining).toBe(2);
  });

  it('selectTarget must name a living opponent', async () => {
    // Re-deal until a roll produces a targeted die (cutlass / jolly roger).
    let t = setup();
    for (let i = 0; i < 100; i++) {
      t = setup();
      await t.h.send(t.current().id, { type: 'roll' });
      await t.h.send(t.current().id, { type: 'finishRolling' });
      if (t.engine.getState().pendingActions.length > 0) break;
    }
    const { h, engine, current } = t;
    const me = current().id;
    const pending = engine.getState().pendingActions[0];
    expect(pending).toBeDefined();
    for (const target of [me, 'nobody']) {
      expect(await h.send(me, { type: 'selectTarget', dieIndex: pending.dieIndex, targetPlayerId: target })).toEqual({
        ok: false,
        code: 'INVALID_ACTION',
        message: 'Invalid target',
      });
    }
    expect(engine.getState().pendingActions[0].resolved).toBe(false);
  });
});

describe('Booty Dice must roll before scoring (CORE-AUDIT A-06 / F-06)', () => {
  it('first player cannot endTurn on the opening dice; roll + endTurn then works', async () => {
    const { h, engine, current, doubloons } = setup();
    const first = current().id;
    const before = engine.getState();

    expect(await h.send(first, { type: 'endTurn' })).toEqual({
      ok: false,
      code: 'RULE_VIOLATION',
      message: 'You must roll before ending your turn',
    });
    expect(h.errors.get(first)).toEqual(['You must roll before ending your turn']);
    expect(engine.getState()).toEqual(before);
    expect(doubloons()).toEqual([5, 5]);

    await playTurn(h, engine);
    expect(current().id).not.toBe(first);
  });

  it('cannot lock all dice before the first roll, or finish rolling without rolling', async () => {
    const { h, engine, current } = setup();
    const first = current().id;
    const before = engine.getState();
    expect(await h.send(first, { type: 'lockDice', diceIndices: [0, 1, 2, 3, 4, 5] })).toMatchObject({
      ok: false,
      code: 'RULE_VIOLATION',
    });
    expect(await h.send(first, { type: 'finishRolling' })).toMatchObject({ ok: false, code: 'RULE_VIOLATION' });
    expect(engine.getState()).toEqual(before);
  });

  it("the second player cannot score the previous player's dice", async () => {
    const { h, engine, current, doubloons } = setup();
    await playTurn(h, engine);
    const second = current().id;
    const before = engine.getState();
    const coins = doubloons();

    expect(await h.send(second, { type: 'endTurn' })).toMatchObject({ ok: false, code: 'RULE_VIOLATION' });
    expect(await h.send(second, { type: 'lockDice', diceIndices: [0, 1, 2, 3, 4, 5] })).toMatchObject({
      ok: false,
      code: 'RULE_VIOLATION',
    });
    expect(engine.getState()).toEqual(before);
    expect(doubloons()).toEqual(coins);

    await playTurn(h, engine);
    expect(current().id).not.toBe(second);
  });

  it('a player who disconnects before rolling forfeits the turn instead of scoring', () => {
    const { h, engine, current, doubloons } = setup();
    const first = current().id;
    const io = { to: () => ({ emit: () => {} }) } as never;
    bootyDiceDefinition.createLobbyCallbacks(h.roomManager, io).onPlayerDisconnect!(h.roomCode, first, io);
    expect(current().id).not.toBe(first);
    expect(doubloons()).toEqual([5, 5]);
    expect(engine.getState().players.map((p) => p.lives)).toEqual([10, 10]);
  });
});

describe('Booty Dice bots still take turns', () => {
  it('a bot rolls and scores normally (server path unaffected by the must-roll rule)', async () => {
    vi.useFakeTimers();
    try {
      const rm = new RoomManager();
      const { roomCode, playerId } = rm.createRoom('s0', 'Human');
      rm.selectGame(roomCode, bootyDiceDefinition.meta);
      rm.addBot(roomCode, 'Bot Alice');
      rm.setPlayerReady(playerId, true);
      const players = rm.startGame(roomCode)!;
      const io = { to: () => ({ emit: () => {} }) } as never;
      bootyDiceDefinition.createLobbyCallbacks(rm, io).onGameStart!(roomCode, players, io);
      const engine = rm.getGameData<GameEngine>(roomCode)!;

      const turn = () => engine.getState().turnNumber;
      if (!engine.getState().players[engine.getState().currentPlayerIndex].isAI) {
        // Human goes first: play a legal turn by hand, then the bot is up.
        const me = engine.getState().players[engine.getState().currentPlayerIndex];
        const bot = engine.getState().players.find((p) => p.isAI)!;
        engine.roll();
        engine.finishRolling();
        for (const pending of engine.getState().pendingActions) engine.selectTarget(pending.dieIndex, bot.id);
        void bootyDiceDefinition.handleGameAction(
          io,
          { data: { roomCode, playerId: me.id }, emit: () => {} } as never,
          rm,
          { type: 'endTurn' },
        );
      }
      const botTurn = turn();
      expect(engine.getState().players[engine.getState().currentPlayerIndex].isAI).toBe(true);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(turn()).toBeGreaterThan(botTurn);
      expect(engine.getState().gameLog.some((e) => e.message.startsWith('Bot Alice rolled'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
