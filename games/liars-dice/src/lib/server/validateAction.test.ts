import { describe, expect, it } from 'vitest';
import { createDispatchHarness } from '@parlor/multiplayer/testing';
import { liarsDiceDefinition } from './definition.js';
import { validateLiarsDiceAction } from './validateAction.js';
import type { LiarsDiceEngine } from './game/LiarsDiceEngine.js';

describe('validateLiarsDiceAction: valid actions are rebuilt from validated fields', () => {
  it.each([
    [{ type: 'bid', quantity: 3, faceValue: 4 }],
    [{ type: 'bid', quantity: 30, faceValue: 1 }],
    [{ type: 'challenge' }],
    [{ type: 'spot-on' }],
    [{ type: 'nextRound' }],
  ])('%j', (action) => {
    const result = validateLiarsDiceAction(action);
    expect(result).toEqual({ ok: true, action });
    expect(result.ok && result.action).not.toBe(action);
  });
});

const INVALID: [string, Record<string, unknown>][] = [
  ['unknown type', { type: 'win' }],
  ['missing quantity', { type: 'bid', faceValue: 3 }],
  ['missing faceValue', { type: 'bid', quantity: 2 }],
  ['string quantity', { type: 'bid', quantity: '2', faceValue: 3 }],
  ['non-integer quantity', { type: 'bid', quantity: 2.5, faceValue: 3 }],
  ['zero quantity', { type: 'bid', quantity: 0, faceValue: 3 }],
  ['negative quantity', { type: 'bid', quantity: -1, faceValue: 3 }],
  ['quantity beyond any table', { type: 'bid', quantity: 31, faceValue: 3 }],
  ['face 0', { type: 'bid', quantity: 2, faceValue: 0 }],
  ['face 7', { type: 'bid', quantity: 2, faceValue: 7 }],
  ['non-integer face', { type: 'bid', quantity: 2, faceValue: 3.5 }],
  ['extra key on bid', { type: 'bid', quantity: 2, faceValue: 3, playerId: 'x' }],
  ['extra key on challenge', { type: 'challenge', target: 'x' }],
  ['extra key on nextRound', { type: 'nextRound', force: true }],
];

describe("Liar's Dice actions through the boundary", () => {
  it.each(INVALID)('%s → INVALID_ACTION, state unchanged, valid bid afterward works', async (_label, action) => {
    const h = createDispatchHarness(liarsDiceDefinition);
    const engine = h.roomManager.getGameData<LiarsDiceEngine>(h.roomCode)!;
    const active = engine.getState().players[engine.getState().activePlayerIndex].id;
    const before = engine.getState();

    expect(await h.send(active, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(engine.getState()).toEqual(before);
    expect(h.roomFailures).toEqual([]);

    expect(await h.send(active, { type: 'bid', quantity: 2, faceValue: 3 })).toEqual({ ok: true });
    expect(engine.getState().currentBid).toEqual({ playerId: active, quantity: 2, faceValue: 3 });
  });
});
