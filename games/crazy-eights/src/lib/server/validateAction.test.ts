import { describe, expect, it } from 'vitest';
import { createDispatchHarness } from '@parlor/multiplayer/testing';
import { crazyEightsDefinition } from './definition.js';
import { validateCrazyEightsAction } from './validateAction.js';
import { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import type { Card } from '../types/game.js';

describe('validateCrazyEightsAction: valid actions are rebuilt from validated fields', () => {
  it.each([
    [{ type: 'play-card', card: { suit: 'hearts', rank: '10' } }],
    [{ type: 'play-card', card: { suit: 'spades', rank: 'A' } }],
    [{ type: 'draw-card' }],
    [{ type: 'pass' }],
    [{ type: 'choose-suit', suit: 'clubs' }],
  ])('%j', (action) => {
    const result = validateCrazyEightsAction(action);
    expect(result).toEqual({ ok: true, action });
    expect(result.ok && result.action).not.toBe(action);
    if (result.ok && result.action.type === 'play-card') {
      expect(result.action.card).not.toBe((action as { card: unknown }).card);
    }
  });
});

const INVALID: [string, Record<string, unknown>][] = [
  ['unknown type', { type: 'discard-hand' }],
  ['missing card', { type: 'play-card' }],
  ['null card', { type: 'play-card', card: null }],
  ['card as string', { type: 'play-card', card: 'KH' }],
  ['card missing rank', { type: 'play-card', card: { suit: 'hearts' } }],
  ['unknown suit', { type: 'play-card', card: { suit: 'stars', rank: 'K' } }],
  ['unknown rank', { type: 'play-card', card: { suit: 'hearts', rank: '11' } }],
  ['numeric rank', { type: 'play-card', card: { suit: 'hearts', rank: 10 } }],
  ['extra key on card (A-05)', { type: 'play-card', card: { suit: 'hearts', rank: 'K', pad: 'x' } }],
  ['extra key on action', { type: 'draw-card', count: 5 }],
  ['missing suit', { type: 'choose-suit' }],
  ['unknown chosen suit', { type: 'choose-suit', suit: 'wild' }],
];

describe('Crazy Eights actions through the boundary', () => {
  it.each(INVALID)('%s → INVALID_ACTION, state unchanged, valid draw afterward works', async (_label, action) => {
    const h = createDispatchHarness(crazyEightsDefinition);
    const engine = h.roomManager.getGameData<CrazyEightsEngine>(h.roomCode)!;
    const active = h.playerIds.find((id) => engine.getPlayerView(id).isActivePlayer)!;
    const snapshot = () => h.playerIds.map((id) => JSON.stringify(engine.getPlayerView(id))).join();
    const before = snapshot();
    const drawPileBefore = engine.getPlayerView(active).drawPileCount;

    expect(await h.send(active, action)).toMatchObject({ ok: false, code: 'INVALID_ACTION' });
    expect(snapshot()).toBe(before);
    expect(h.roomFailures).toEqual([]);

    expect(await h.send(active, { type: 'draw-card' })).toEqual({ ok: true });
    expect(engine.getPlayerView(active).drawPileCount).toBe(drawPileBefore - 1);
  });
});

describe('Crazy Eights stores the server card, not the client object (A-05)', () => {
  it('playCard pushes the hand card even if the caller passes extra fields', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const engine = new CrazyEightsEngine(
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
        'T',
      );
      const active = ['a', 'b'].find((id) => engine.getPlayerView(id).isActivePlayer)!;
      const playable = engine.getPlayerView(active).playableCards.find((c) => c.rank !== '8');
      if (!playable) continue;
      const clientCard = { ...playable, pad: 'x'.repeat(100) } as Card;
      engine.playCard(active, clientCard);
      const top = engine.getPlayerView('a').topDiscard;
      expect(top).toEqual({ suit: playable.suit, rank: playable.rank });
      expect(top).not.toHaveProperty('pad');
      return;
    }
    throw new Error('no playable card found');
  });
});
