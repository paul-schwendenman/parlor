import { describe, expect, it } from 'vitest';
import { createDispatchHarness } from '@parlor/multiplayer/testing';
import { kingsCornerDefinition } from './definition.js';
import { validateKingsCornerAction } from './validateAction.js';
import { KingsCornerEngine } from './game/KingsCornerEngine.js';
import type { Card } from '../types/game.js';

describe('validateKingsCornerAction: valid actions are rebuilt from validated fields', () => {
  it.each([
    [{ type: 'play-card', card: { suit: 'hearts', rank: 'K' }, target: 'northeast' }],
    [{ type: 'play-card', card: { suit: 'clubs', rank: '7' }, target: 'south' }],
    [{ type: 'move-pile', from: 'north', to: 'west' }],
    [{ type: 'draw-card' }],
    [{ type: 'end-turn' }],
  ])('%j', (action) => {
    const result = validateKingsCornerAction(action);
    expect(result).toEqual({ ok: true, action });
    expect(result.ok && result.action).not.toBe(action);
  });
});

const card = { suit: 'hearts', rank: 'K' };
const INVALID: [string, Record<string, unknown>][] = [
  ['unknown type', { type: 'shuffle' }],
  ['missing target', { type: 'play-card', card }],
  ['bogus target', { type: 'play-card', card, target: 'nowhere' }],
  ['numeric target', { type: 'play-card', card, target: 3 }],
  ['missing card', { type: 'play-card', target: 'north' }],
  ['bad card', { type: 'play-card', card: { suit: 'hearts', rank: 'Z' }, target: 'north' }],
  ['extra key on card (A-05)', { type: 'play-card', card: { ...card, pad: 'x' }, target: 'north' }],
  ['missing to', { type: 'move-pile', from: 'north' }],
  ['bogus from', { type: 'move-pile', from: 'up', to: 'north' }],
  ['extra key on move', { type: 'move-pile', from: 'north', to: 'west', all: true }],
  ['extra key on end-turn', { type: 'end-turn', skip: 1 }],
];

describe('Kings Corner actions through the boundary', () => {
  it.each(INVALID)('%s → INVALID_ACTION, state unchanged, valid draw afterward works', async (_label, action) => {
    const h = createDispatchHarness(kingsCornerDefinition);
    const engine = h.getState()!;
    const active = h.playerIds.find((id) => engine.getPlayerView(id).isActivePlayer)!;
    const snapshot = () => h.playerIds.map((id) => JSON.stringify(engine.getPlayerView(id))).join();
    const before = snapshot();

    expect(await h.send(active, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(snapshot()).toBe(before);
    expect(h.roomFailures).toEqual([]);

    expect(await h.send(active, { type: 'draw-card' })).toEqual({ ok: true });
    expect(engine.getPlayerView(active).phase).toBe('playing');
  });
});

describe('Kings Corner engine hardening', () => {
  function drawnEngine() {
    const engine = new KingsCornerEngine(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      'T',
    );
    const active = ['a', 'b'].find((id) => engine.getPlayerView(id).isActivePlayer)!;
    engine.drawCard(active);
    return { engine, active };
  }

  it('stores the hand card on the pile, not the client object (A-05)', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const { engine, active } = drawnEngine();
      const playable = engine.getPlayerView(active).playableCards[0];
      if (!playable) continue;
      const target = playable.validTargets[0];
      engine.playCard(active, { ...playable.card, pad: 'x' } as Card, target);
      const pile = engine.getPlayerView('a').piles.find((p) => p.position === target)!;
      const top = pile.cards[pile.cards.length - 1];
      expect(top).toEqual(playable.card);
      expect(top).not.toHaveProperty('pad');
      return;
    }
    throw new Error('no playable card found');
  });

  it('an unknown pile is a rule error, not a TypeError', () => {
    const { engine, active } = drawnEngine();
    const handCard = engine.getPlayerView(active).myHand[0];
    // @ts-expect-error -- deliberately not a PilePosition: the engine must still reject it
    expect(() => engine.playCard(active, handCard, 'nowhere')).toThrow('Invalid pile');
    // @ts-expect-error -- deliberately not a PilePosition: the engine must still reject it
    expect(() => engine.movePile(active, 'north', 'nowhere')).toThrow('Invalid pile');
  });
});
