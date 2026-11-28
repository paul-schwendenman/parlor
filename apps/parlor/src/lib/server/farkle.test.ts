import { describe, expect, it } from 'vitest';
import { FarkleEngine } from '../../../../../games/farkle/src/engine.js';
import { scoreDice } from '../../../../../games/farkle/src/rules.js';

const seats = [
  { id: 'a', name: 'Alex', bot: false },
  { id: 'b', name: 'Blair', bot: false },
];

describe('Farkle', () => {
  it.each([
    [[1, 1, 5], 250],
    [[1, 1, 1], 1000],
    [[5, 5, 5], 500],
    [[2, 2, 2, 2], 1000],
    [[1, 1, 1, 1], 1100],
    [[3, 3, 3, 3, 3], 2000],
    [[6, 6, 6, 6, 6, 6], 3000],
    [[2, 2, 3, 3, 4, 4], 1500],
    [[1, 2, 3, 4, 5, 6], 1500],
    [[3, 3, 3, 3, 6, 6], 1500],
    [[1, 1, 1, 6, 6, 6], 2500],
    [[1, 2], 0],
  ])('scores %j as %i', (dice, points) => expect(scoreDice(dice)).toBe(points));

  it('rejects invalid moves without changing the roll and loses unbanked points on a bust', () => {
    const rolls = [1, 2, 2, 3, 3, 4, 2, 3, 4, 6, 6];
    const engine = new FarkleEngine(seats, (max) => max === 6 ? rolls.shift()! - 1 : 0);
    expect(() => engine.act('b', { type: 'roll' })).toThrow();
    engine.act('a', { type: 'roll' });
    const before = engine.view();
    expect(() => engine.act('a', { type: 'keep', indices: [0, 0] })).toThrow();
    expect(() => engine.act('a', { type: 'keep', indices: [0, 1] })).toThrow();
    expect(() => engine.act('a', { type: 'roll' })).toThrow();
    expect(engine.view()).toEqual(before);
    engine.act('a', { type: 'keep', indices: [0] });
    expect(() => engine.act('a', { type: 'bank' })).toThrow(/500/);
    engine.act('a', { type: 'roll' });
    expect(engine.view()).toMatchObject({ phase: 'bust', turnScore: 100 });
    engine.advanceTurn();
    expect(engine.view()).toMatchObject({ phase: 'ready', turnScore: 0, activePlayerId: 'b' });
    expect(engine.view().players.map(({ score }) => score)).toEqual([0, 0]);
  });

  it('resets hot dice and lets every other seat take one final turn', () => {
    const engine = new FarkleEngine(seats, () => 0);
    const keepSix = (id: string) => {
      engine.act(id, { type: 'roll' });
      engine.act(id, { type: 'keep', indices: [0, 1, 2, 3, 4, 5] });
      expect(engine.view().diceToRoll).toBe(6);
    };
    for (let roll = 0; roll < 4; roll++) keepSix('a');
    engine.act('a', { type: 'bank' });
    expect(engine.view()).toMatchObject({ finalRound: true, nextPlayerId: 'b' });
    engine.advanceTurn();
    expect(engine.view()).toMatchObject({ activePlayerId: 'b', nextPlayerId: null });
    for (let roll = 0; roll < 5; roll++) keepSix('b');
    engine.act('b', { type: 'bank' });
    engine.advanceTurn();
    expect(engine.gameOver).toBe(true);
    expect(engine.view().players.map(({ score }) => score)).toEqual([12000, 15000]);
  });

  it('shows the next seat still in the game', () => {
    const engine = new FarkleEngine([...seats, { id: 'c', name: 'Casey', bot: false }], () => 0);
    expect(engine.view().nextPlayerId).toBe('b');
    engine.remove('b');
    expect(engine.view().nextPlayerId).toBe('c');
  });

  it('hands a disconnected player to a stand-in while another human is connected', () => {
    const engine = new FarkleEngine(seats, () => 0);
    engine.setConnected('a', false);
    expect(engine.automaticAction()).toEqual({ type: 'roll' });
    engine.setConnected('b', false);
    expect(engine.automaticAction()).toBeNull();
    engine.setConnected('a', true);
    expect(engine.automaticAction()).toBeNull();
  });
});
