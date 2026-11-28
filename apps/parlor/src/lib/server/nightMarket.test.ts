import { expect, it } from 'vitest';
import { NightMarketEngine } from '../../../../../games/night-market/src/engine.js';
import { displayScore, goods, type Good } from '../../../../../games/night-market/src/rules.js';
import type { MarketAction } from '../../../../../games/night-market/src/types.js';

const players = ['a', 'b', 'c'].map((id) => ({ id, name: id, bot: false }));

it('scores pairs and spice variety, counting each good once', () => {
  const stall: Good[] = ['lantern', 'silk', 'tea', 'pottery', 'tea', 'spice', 'spice'];
  expect(displayScore(stall.map((good, id) => ({ good, id })))).toBe(25);
});

it('keeps simultaneous picks private, reveals them together, and rotates remaining goods', () => {
  const game = new NightMarketEngine(players, (max) => max - 1);
  const hands = players.map(({ id }) => game.view(id).hand);
  const action = (index: number): MarketAction => ({
    type: 'pick', tileId: hands[index][0].id, use: index ? 'display' : 'sell', season: 1, pickNumber: 1,
  });
  expect(() => game.act('b', action(0))).toThrow();
  expect(() => game.act('a', { ...action(0), pickNumber: 2 })).toThrow();
  game.act('a', action(0));
  expect(game.view('a').selection).toEqual({ tileId: hands[0][0].id, use: 'sell' });
  expect(game.view('b').selection).toBeNull();
  expect(game.view()).toMatchObject({ phase: 'draft', hand: [], selection: null, revealed: [] });
  expect(game.view().players[0]).toMatchObject({ locked: true, coins: 0, stall: [] });
  expect(() => game.act('a', action(0))).toThrow();
  game.act('b', action(1));
  game.act('c', action(2));
  expect(game.view().revealed).toHaveLength(3);
  expect(game.view().players[0].coins).toBe(goods[hands[0][0].good].sale);
  game.advanceReveal();
  expect(game.view('b').hand).toEqual(hands[0].slice(1));
  expect(game.view('c').hand).toEqual(hands[1].slice(1));
  expect(game.view('a').hand).toEqual(hands[2].slice(1));
});

it('scores twelve picks across three seasons with five bots', () => {
  const game = new NightMarketEngine(Array.from({ length: 5 }, (_, index) =>
    ({ id: String(index), name: String(index), bot: true })), () => 0);
  for (let step = 0; step < 80 && !game.gameOver; step++) {
    if (game.revealing) game.advanceReveal();
    else game.automaticMove()!();
  }
  const view = game.view();
  expect(view.phase).toBe('game-over');
  expect(view.season).toBe(3);
  expect(view.winnerIds.length).toBeGreaterThan(0);
  for (const player of view.players) {
    expect(player.seasonScores).toHaveLength(3);
    expect(player.total).toBe(player.seasonScores.reduce((sum, points) => sum + points, 0));
  }
});
