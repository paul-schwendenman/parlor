import { describe, expect, it } from 'vitest';
import { GolfEngine } from '../../../../../games/golf/src/engine.js';
import { columnScore, gridScore } from '../../../../../games/golf/src/rules.js';
import type { GolfOptions } from '../../../../../games/golf/src/types.js';

function makeGame(count = 2, options: Partial<GolfOptions> = {}, bot = false, seed = 32) {
  const players = Array.from({ length: count }, (_, i) => ({ id: String(i), name: `Player ${i}`, bot }));
  return new GolfEngine(players, (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  }, options);
}

function setup(game: GolfEngine) {
  for (const { id } of game.view().players) {
    game.act(id, { type: 'reveal', slot: 0 });
    game.act(id, { type: 'reveal', slot: 3 });
  }
}

describe('Golf', () => {
  it.each([[2, 39], [4, 27], [5, 73], [6, 67]])('deals %i players with %i cards left', (count, stockCount) => {
    const game = makeGame(count);
    expect(game.view().stockCount).toBe(stockCount);
    for (const viewer of [undefined, '0', '1']) {
      for (const { grid } of game.view(viewer).players) expect(grid).toEqual(Array(6).fill(null));
    }
  });

  it('rejects repeat flips and actions outside the active phase without mutating state', () => {
    const game = makeGame();
    game.act('0', { type: 'reveal', slot: 0 });
    const before = game.view('0');
    expect(() => game.act('0', { type: 'reveal', slot: 0 })).toThrow();
    expect(() => game.act('0', { type: 'reveal', slot: 6 })).toThrow();
    expect(() => game.act('0', { type: 'draw-stock' })).toThrow();
    expect(game.view('0')).toEqual(before);
    game.act('0', { type: 'reveal', slot: 3 });
    expect(() => game.act('0', { type: 'reveal', slot: 1 })).toThrow();
    game.act('1', { type: 'reveal', slot: 0 });
    game.act('1', { type: 'reveal', slot: 3 });
    const active = game.view().activePlayerId!;
    expect(game.view().canDrawStock).toBe(false);
    expect(game.view(active).canDrawStock).toBe(true);
    expect(() => game.act(active, { type: 'swap-drawn', slot: 1 })).toThrow();
    game.act(active, { type: 'draw-stock' });
    expect(game.view().drawn).toEqual(game.view(active).drawn);
    expect(() => game.act(active, { type: 'draw-stock' })).toThrow();
  });

  it('cancels matching ranks vertically, including twos', () => {
    const two = { rank: '2', suit: 'hearts' } as const;
    const ace = { rank: 'A', suit: 'clubs' } as const;
    const queen = { rank: 'Q', suit: 'spades' } as const;
    expect(columnScore(two, two)).toBe(0);
    expect(columnScore(two, ace)).toBe(-1);
    expect(columnScore(queen, null)).toBe(10);
    expect(gridScore([two, two, null, ace, queen, null])).toBe(7);
    expect(gridScore([two, two, two, two, two, two], true)).toBe(-10);
  });

  it.each([false, true])('scores the hole with final turns set to %s', (finalTurns) => {
    const game = makeGame(2, { holes: 1, finalTurns });
    setup(game);
    const first = game.view().activePlayerId!;
    const second = game.view().players.find(({ id }) => id !== first)!.id;
    for (const slot of [1, 2, 4, 5]) {
      game.act(first, { type: 'take-discard', slot });
      if (slot !== 5 || finalTurns) {
        expect(game.view()).toMatchObject({ phase: 'turn', activePlayerId: second });
        game.act(second, { type: 'take-discard', slot: 0 });
      }
    }
    expect(game.view()).toMatchObject({ phase: 'hole-scoring', wentOutId: first });
    expect(game.view().players.every(({ grid }) => grid.every(Boolean))).toBe(true);
    game.advanceReveal();
    expect(game.view().winnerIds.length).toBeGreaterThan(0);
  });

  it('recycles discards and preserves the upcard', () => {
    const game = makeGame();
    setup(game);
    while (game.view().stockCount) {
      const id = game.view().activePlayerId!;
      game.act(id, { type: 'draw-stock' });
      game.act(id, { type: 'discard-drawn' });
    }
    const prior = game.view();
    game.act(prior.activePlayerId!, { type: 'draw-stock' });
    expect(game.view().discardTop).toEqual(prior.discardTop);
    expect(game.view().stockCount).toBe(38);
  });

  it('pauses stand-ins when all humans disconnect', () => {
    const game = makeGame();
    game.setConnected('0', false);
    expect(game.automaticMove()).toBeDefined();
    game.setConnected('1', false);
    expect(game.automaticMove()).toBeUndefined();
  });

  it.each([2, 6])('runs nine holes with %i bots', (count) => {
    const game = makeGame(count, {}, true);
    for (let step = 0; step < 10000 && !game.gameOver; step++) {
      if (game.revealing) game.advanceReveal();
      else game.automaticMove()!();
    }
    const view = game.view();
    expect(view.phase).toBe('game-over');
    for (const player of view.players) {
      expect(player.holeScores).toHaveLength(9);
      expect(player.total).toBe(player.holeScores.reduce((sum, score) => sum + score, 0));
    }
    expect(view.winnerIds).toEqual(view.players.filter((p) => p.total === Math.min(...view.players.map((p) => p.total))).map((p) => p.id));
  });
});
