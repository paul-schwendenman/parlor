import { describe, expect, it } from 'vitest';
import { PresidentEngine } from '../../../../../games/president/src/engine.js';
import { THREE_OF_CLUBS, legalPlays, rankValue } from '../../../../../games/president/src/rules.js';
import type { PresidentOptions } from '../../../../../games/president/src/types.js';
type Card = Parameters<typeof legalPlays>[0][number];

function makeGame(count: number, options: Partial<PresidentOptions> = {}, bot = false, seed = 618) {
  return new PresidentEngine(Array.from({ length: count }, (_, index) => ({
    id: String(index), name: `Player ${index}`, bot,
  })), (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * max);
  }, options);
}

function advance(game: PresidentEngine) {
  if (game.currentPhase === 'hand-scoring' || game.currentPhase === 'trick-cleared') game.advanceReveal();
  else game.automaticMove()!();
}

describe('President', () => {
  it('requires matching set sizes and compares ranks in either direction', () => {
    const cards: Card[] = [
      { rank: '3', suit: 'clubs' }, { rank: '3', suit: 'hearts' },
      { rank: '2', suit: 'clubs' }, { rank: '2', suit: 'hearts' },
      { rank: 'K', suit: 'clubs' },
    ];
    const standing: Card[] = [{ rank: 'K', suit: 'hearts' }, { rank: 'K', suit: 'spades' }];
    expect(legalPlays(cards, standing, false)).toEqual([{ rank: '2', counts: [2] }]);
    expect(legalPlays(cards, standing, true)).toEqual([{ rank: '3', counts: [2] }]);
  });

  it('rejects invalid leads without changing state and keeps hands private', () => {
    const game = makeGame(7, { firstLead: 'three-of-clubs' });
    const active = game.view().activePlayerId!;
    const before = game.view(active);
    expect(before.myHand).toContainEqual(THREE_OF_CLUBS);
    expect(game.view().myHand).toEqual([]);
    expect(game.view().requiredCard).toBeNull();
    expect(game.view().players.reduce((sum, player) => sum + player.cardCount, 0)).toBe(52);
    expect(() => game.act(active, { type: 'pass' })).toThrow();
    expect(() => game.act(active, { type: 'play', cards: [THREE_OF_CLUBS, THREE_OF_CLUBS] })).toThrow();
    expect(() => game.act(active, { type: 'play', cards: [before.myHand.find(({ rank }) => rank !== '3')!] })).toThrow();
    expect(game.view(active)).toEqual(before);
    game.act(active, { type: 'play', cards: [THREE_OF_CLUBS] });
    expect(game.view().trick).toEqual([{ playerId: active, cards: [THREE_OF_CLUBS] }]);
  });

  it('clears after the other seats pass and gives the standing player the lead', () => {
    const game = makeGame(4);
    const first = game.view().activePlayerId!;
    game.act(first, { type: 'play', cards: [game.view(first).myHand[0]] });
    for (let pass = 0; pass < 3; pass++) game.act(game.view().activePlayerId!, { type: 'pass' });
    expect(game.view().phase).toBe('trick-cleared');
    game.advanceReveal();
    expect(game.view()).toMatchObject({ phase: 'playing', activePlayerId: first, trick: [] });
  });

  it.each(['one', 'two'] as const)('keeps a %s-card exchange private and hands the lead to the President', (exchange) => {
    const game = makeGame(4, { exchange }, true);
    for (let step = 0; step < 1000 && game.currentPhase !== 'hand-scoring'; step++) advance(game);
    const order = [...game.view().players].sort((a, b) => a.finishedAt! - b.finishedAt!);
    const president = order[0].id;
    const peasant = order.at(-1)!.id;
    game.advanceReveal();
    expect(game.view().phase).toBe('exchange');
    expect(game.view()).toMatchObject({ received: [], myHand: [], mustReturn: 0 });
    const received = game.view(president).received;
    expect(received.length).toBe(exchange === 'two' ? 2 : 1);
    expect(Math.min(...received.map(({ rank }) => rankValue(rank)))).toBeGreaterThanOrEqual(
      Math.max(...game.view(peasant).myHand.map(({ rank }) => rankValue(rank))),
    );
    expect(game.view(peasant).received).toEqual([]);
    game.act(president, { type: 'return-cards', cards: received });
    if (exchange === 'two') advance(game);
    expect(game.view()).toMatchObject({ phase: 'playing', activePlayerId: president });
    expect(game.view(peasant).received).toEqual(received);
  });

  it.each([4, 7])('finishes a full game with %i bots and variant rules', (count) => {
    const game = makeGame(count, { passIsOut: true, twoClears: true, revolution: true }, true);
    for (let step = 0; step < 10000 && game.currentPhase !== 'game-over'; step++) advance(game);
    const final = game.view();
    expect(final.phase).toBe('game-over');
    const [winner] = [...final.players].sort((a, b) => b.score - a.score || a.finishedAt! - b.finishedAt!);
    expect(winner.score).toBeGreaterThanOrEqual(11);
    expect(final.winnerIds).toEqual([winner.id]);
  });
});
