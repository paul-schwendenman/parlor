import { expect, it } from 'vitest';
import { SignalRelayEngine } from '../../../../../games/signal-relay/src/engine.js';
import { antennas, fits, roundMs } from '../../../../../games/signal-relay/src/rules.js';

const players = ['a', 'b'].map((id) => ({ id, name: id, bot: false }));
const unshuffled = (max: number) => max - 1;

it('redacts hands and rejects a stale antenna version without spending a signal', () => {
  const game = new SignalRelayEngine(players, unshuffled, () => 0);
  const [signal] = game.view('a').hand;
  const [other] = game.view('b').hand;
  expect(signal).not.toEqual(other);
  expect(game.view()).toMatchObject({ deadline: roundMs, hand: [], players: [{ remaining: 2 }, { remaining: 2 }] });
  game.act('a', { type: 'send', level: 1, signal: signal.id, antenna: 0, version: 0 });
  const before = game.view('b');
  expect(() => game.act('b', { type: 'send', level: 1, signal: other.id, antenna: 0, version: 0 })).toThrow(/changed/);
  expect(game.view('b')).toEqual(before);
  game.act('b', { type: 'send', level: 1, signal: other.id, antenna: 0, version: 1 });
  expect(game.view().players.map(({ remaining }) => remaining)).toEqual([1, 1]);
});

it('shares one reroute and enforces the deadline', () => {
  let now = 5000;
  const game = new SignalRelayEngine(players, unshuffled, () => now);
  const [first, second] = game.view('a').hand;
  game.act('a', { type: 'reroute', level: 1, signal: first.id, antenna: 0, version: 0 });
  expect(game.view().rerouteAvailable).toBe(false);
  expect(() => game.act('a', { type: 'reroute', level: 1, signal: second.id, antenna: 1, version: 0 })).toThrow(/already used/);
  expect(game.expire()).toBe(false);
  now += roundMs;
  expect(() => game.act('a', { type: 'send', level: 1, signal: second.id, antenna: 1, version: 0 })).toThrow(/ended/);
  expect(game.expire()).toBe(true);
  expect(game.view()).toMatchObject({ phase: 'game-over', won: false, deadline: null });
});

it('clears four relays and refuses actions from the previous level', () => {
  const game = new SignalRelayEngine(players, unshuffled, () => 0);
  for (let level = 1; level <= 4; level++) {
    if (level > 1) {
      const signal = game.view('a').hand[0];
      expect(() => game.act('a', { type: 'send', level: level - 1, signal: signal.id, antenna: 0, version: 0 })).toThrow();
    }
    const remaining = 2 * (level + 1);
    for (let sent = 0; sent < remaining; sent++) {
      const views = players.map(({ id }) => game.view(id));
      const next = players.flatMap(({ id }, i) => views[i].hand.flatMap((signal) => antennas.map((antenna) =>
        ({ id, signal, antenna, current: views[i].antennas[antenna] }))));
      const match = next.find(({ signal, current }) => fits(signal, current.signal));
      const { id, signal, antenna, current } = match ?? next[0];
      game.act(id, { type: match ? 'send' : 'reroute', level, signal: signal.id, antenna, version: current.version });
    }
    expect(game.view().phase).toBe('clear');
    game.advanceReveal();
  }
  expect(game.view()).toMatchObject({ phase: 'game-over', level: 4, won: true });
});
