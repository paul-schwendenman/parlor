import { expect, it } from 'vitest';
import { OhHellEngine } from '../../../../../games/oh-hell/src/engine.js';

const players = Array.from({ length: 6 }, (_, index) => ({
  id: String(index), name: `Player ${index}`, bot: false,
}));

it('enforces turn order and the dealer hook without revealing hands or legal bids', () => {
  const engine = new OhHellEngine(players.slice(0, 3), (max) => max - 1);
  expect(engine.view().myHand).toEqual([]);
  expect(engine.view('0').legalBids).toEqual([]);
  expect(engine.view('1').myHand).toEqual([{ rank: '2', suit: 'hearts' }]);
  expect(() => engine.act('0', { type: 'bid', tricks: 0 })).toThrow();
  engine.act('1', { type: 'bid', tricks: 0 });
  engine.act('2', { type: 'bid', tricks: 0 });
  expect(engine.view('0').legalBids).toEqual([0]);
  expect(() => engine.act('0', { type: 'bid', tricks: 1 })).toThrow();
  engine.act('0', { type: 'bid', tricks: 0 });
  expect(engine.view().activePlayerId).toBe('1');
  for (const id of ['1', '2', '0']) {
    engine.act(id, { type: 'play-card', card: engine.view(id).myHand[0] });
  }
  expect(engine.view().trickWinnerId).toBe('0');
  engine.advanceReveal();
  expect(engine.view().players.map((player) => player.roundPoints)).toEqual([0, 10, 10]);
});

it.each([3, 6])('plays all nine hands and scores the full game with %i bots', (count) => {
  const engine = new OhHellEngine(players.slice(0, count).map((player) => ({ ...player, bot: true })));
  const sizes: number[] = [];

  for (let step = 0; step < 250 && engine.currentPhase !== 'game-over'; step++) {
    const view = engine.view();
    const move = engine.automaticAction();
    if (move) {
      engine.act(move.id, move.action);
    } else {
      if (view.phase === 'round-scoring') {
        sizes.push(view.handSize);
        expect(view.players.reduce((total, player) => total + player.tricks, 0)).toBe(view.handSize);
        expect(view.players.reduce((total, player) => total + (player.bid ?? 0), 0)).not.toBe(view.handSize);
        for (const player of view.players) {
          expect(player.roundPoints).toBe(player.bid === player.tricks ? 10 + player.tricks : 0);
        }
      }
      engine.advanceReveal();
    }
  }

  const view = engine.view();
  expect(sizes).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
  expect(view.phase).toBe('game-over');
  const best = Math.max(...view.players.map((player) => player.score));
  expect(view.winnerIds).toEqual(view.players.filter((player) => player.score === best).map((player) => player.id));
});
