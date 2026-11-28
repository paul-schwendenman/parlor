import { describe, expect, it } from 'vitest';
import { GinEngine } from '../../../../../games/gin-rummy/src/engine.js';
import { DEFAULT_OPTIONS, scoreHand } from '../../../../../games/gin-rummy/src/rules.js';
import { bestArrangement, bestDefense } from '../../../../../packages/cards/src/melds.js';

type Card = Parameters<typeof bestArrangement>[0][number];
const hearts = (...ranks: Card['rank'][]): Card[] => ranks.map((rank) => ({ rank, suit: 'hearts' }));
const players = [{ id: 'a', name: 'Alex', bot: false }, { id: 'b', name: 'Blair', bot: false }];

describe('Gin Rummy', () => {
  it('finds disjoint runs and sets and keeps aces low', () => {
    expect(bestArrangement([...hearts('A', '2', '3'), ...hearts('J', 'Q', 'K')]).deadwoodCount).toBe(0);
    expect(bestArrangement(hearts('Q', 'K', 'A')).deadwoodCount).toBe(21);
    const set = ['clubs', 'spades', 'diamonds'].map((suit) => ({ rank: '3', suit } as Card));
    expect(bestArrangement([...hearts('A', '2', '3'), ...set]).deadwoodCount).toBe(0);
  });

  it('extends runs through chained layoffs and finds an undercut', () => {
    const meld = { kind: 'run', cards: hearts('5', '6', '7') } as const;
    const defense = bestDefense(hearts('9', '8', 'A'), [meld]);
    expect(defense.deadwoodCount).toBe(1);
    expect(defense.layoffs.map(({ card }) => card.rank)).toEqual(['8', '9']);
    const result = scoreHand('a', 'b', [...meld.cards, { rank: '2', suit: 'spades' }], hearts('9', '8', 'A'), DEFAULT_OPTIONS, false);
    expect(result).toMatchObject({ outcome: 'undercut', winnerId: 'b', points: 11 });
    const gin = scoreHand('a', 'b', meld.cards, hearts('8', '9'), DEFAULT_OPTIONS, true);
    expect(gin).toMatchObject({ outcome: 'gin', winnerId: 'a', points: 74, defender: { layoffs: [] } });
  });

  it('offers the upcard to both players and then requires a stock draw', () => {
    const game = new GinEngine(players, () => 0);
    expect(game.view().myHand).toEqual([]);
    expect(game.view('a').myHand).toHaveLength(10);
    expect(game.view()).toMatchObject({ activePlayerId: 'b', stockCount: 31 });
    game.act('b', { type: 'pass-upcard' });
    game.act('a', { type: 'pass-upcard' });
    expect(game.view('b')).toMatchObject({ phase: 'draw', canDrawStock: true, canTakeDiscard: false });
    const before = game.view('b');
    expect(() => game.act('b', { type: 'take-discard' })).toThrow();
    expect(game.view('b')).toEqual(before);
  });

  it('prevents returning a drawn discard and keeps the extra card private', () => {
    const game = new GinEngine(players, () => 0);
    const upcard = game.view().discardTop!;
    game.act('b', { type: 'take-discard' });
    expect(game.view('a').opponentTook).toEqual([upcard]);
    expect(game.view('a').discardable).toEqual([]);
    expect(game.view('b').myHand).toHaveLength(11);
    const before = game.view('b');
    expect(() => game.act('b', { type: 'discard', card: upcard })).toThrow();
    expect(() => game.act('b', { type: 'knock', card: upcard })).toThrow();
    expect(game.view('b')).toEqual(before);
  });

  it('voids a hand when a regular discard leaves two stock cards and preserves the dealer', () => {
    const game = new GinEngine(players, () => 0);
    game.act('b', { type: 'pass-upcard' });
    game.act('a', { type: 'pass-upcard' });
    for (let draw = 0; draw < 29; draw++) {
      const id = game.view().activePlayerId!;
      game.act(id, { type: 'draw-stock' });
      game.act(id, { type: 'discard', card: game.view(id).discardable[0] });
    }
    expect(game.view()).toMatchObject({ phase: 'hand-scoring', stockCount: 2, lastResult: { outcome: 'void', points: 0 } });
    game.advanceReveal();
    expect(game.view()).toMatchObject({ phase: 'upcard', handNumber: 2, dealerId: 'a' });
  });

  it('completes a game and awards the box and game bonuses', () => {
    let seed = 42376;
    const game = new GinEngine(players.map((p) => ({ ...p, bot: true })), (max) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor(seed / 0x100000000 * max);
    });
    for (let step = 0; step < 4000 && !game.gameOver; step++) {
      if (game.revealing) game.advanceReveal();
      else game.automaticMove()!();
    }
    const view = game.view();
    expect(view.phase).toBe('game-over');
    const winner = view.players.find(({ id }) => id === view.winnerIds[0])!;
    const final = view.final!.find(({ id }) => id === winner.id)!;
    expect(winner.score).toBeGreaterThanOrEqual(100);
    expect(final.box).toBe(winner.handsWon * 20);
    expect(final.total).toBe(final.hand + final.box + final.game);
  });
});
