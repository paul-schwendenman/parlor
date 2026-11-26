/**
 * Crazy Eights on the typed contract (plan 3.1b): what each recipient receives,
 * a full game through the action boundary, and the lifecycle hooks over the
 * real lobby handlers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import {
  createDispatchHarness,
  createLobbyHarness,
  type CapturedEmit,
  type FakeSocket,
  type LobbyHarness,
} from '@parlor/multiplayer/testing';
import type { CrazyEightsEngine } from './game/CrazyEightsEngine.js';
import { crazyEightsDefinition, crazyEightsGame } from './definition.js';
import type { CrazyEightsPlayerView } from '../types/game.js';

vi.mock(import('@parlor/multiplayer/random'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, secureRandomInt: (max: number) => Math.floor(Math.random() * max) };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** The `game:state` envelopes sent to `to`. */
function received(emitted: CapturedEmit[], to: string): GameStateEnvelope<'crazy-eights'>[] {
  return emitted
    .filter((e) => e.event === 'game:state' && e.to === to)
    .map((e) => e.payload as GameStateEnvelope<'crazy-eights'>);
}

/** Small deterministic PRNG so the shuffle (and so the playthrough) is reproducible. */
function seedRandom(seed: number) {
  let a = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/** The move a simple player would make from its own view. */
function nextMove(view: CrazyEightsPlayerView): Record<string, unknown> {
  if (view.phase === 'choosing-suit') return { type: 'choose-suit', suit: 'hearts' };
  if (view.playableCards.length > 0) return { type: 'play-card', card: view.playableCards[0] };
  if (view.canDraw) return { type: 'draw-card' };
  return { type: 'pass' };
}

describe('Crazy Eights game:state envelopes', () => {
  it('players get their own view and spectators only the spectator view, all tagged crazy-eights', async () => {
    const h = createDispatchHarness(crazyEightsDefinition, 3);
    h.spectate('spectator-socket');
    const engine = h.getState()!;
    const active = h.playerIds.find((id) => engine.getPlayerView(id).isActivePlayer)!;
    h.emitted.length = 0;

    expect(await h.send(active, { type: 'draw-card' })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      const envelopes = received(h.emitted, id);
      expect(envelopes).toHaveLength(1);
      expect(envelopes[0].gameId).toBe('crazy-eights');
      expect(envelopes[0].view).toEqual(engine.getPlayerView(id));
      expect(envelopes[0].view.myIndex).toBeGreaterThanOrEqual(0);
    }

    const spectator = received(h.emitted, 'spectator-socket');
    expect(spectator).toEqual([{ gameId: 'crazy-eights', view: engine.getSpectatorView() }]);
    expect(spectator[0].view).toMatchObject({ myHand: [], myIndex: -1, playableCards: [], drewCard: null });
    // No player's hand reaches the spectator.
    const hands = h.playerIds.flatMap((id) => engine.getPlayerView(id).myHand);
    const spectatorText = JSON.stringify(spectator);
    for (const id of h.playerIds) {
      expect(spectator[0].view).not.toEqual(engine.getPlayerView(id));
    }
    expect(hands.length).toBeGreaterThan(0);
    expect(spectatorText).not.toContain('"myHand":[{');
  });

  it('the start broadcast is an envelope per player', () => {
    const h = createDispatchHarness(crazyEightsDefinition);
    for (const id of h.playerIds) {
      expect(received(h.emitted, id).map((e) => e.gameId)).toEqual(['crazy-eights']);
    }
  });
});

describe('Crazy Eights plays through the boundary', () => {
  it.each([1, 2, 3])('a seeded 3-player game (seed %i) runs to game over with every move accepted', async (seed) => {
    seedRandom(seed);
    const h = createDispatchHarness(crazyEightsDefinition, 3);
    const engine = h.getState()!;

    let moves = 0;
    while (!engine.isGameOver()) {
      expect(moves++).toBeLessThan(2_000);
      const active = h.playerIds.find((id) => {
        const view = engine.getPlayerView(id);
        return view.isActivePlayer;
      })!;
      expect(await h.send(active, nextMove(engine.getPlayerView(active)))).toEqual({ ok: true });
    }

    expect(h.roomFailures).toEqual([]);
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
    // Every player's last envelope is the final, game-over view.
    for (const id of h.playerIds) {
      const last = received(h.emitted, id).at(-1)!;
      expect(last.view.gameOver).toBe(true);
      expect(last.view.winner).not.toBeNull();
    }
    // The game is over: no more moves.
    expect(await h.send(h.playerIds[0], { type: 'draw-card' })).toMatchObject({ ok: false });
  });
});

// --- Lifecycle over the real lobby handlers -------------------------------------

describe('Crazy Eights lifecycle hooks', () => {
  it('onRoomDestroyed is called with the running engine when the room goes away, and nothing is emitted', () => {
    const destroyed = vi.spyOn(crazyEightsGame, 'onRoomDestroyed');
    const { roomManager, emitted, humans: [host, guest], roomCode, getState } = createLobbyHarness(crazyEightsDefinition);
    const engine = getState();
    expect(engine).not.toBeNull();
    guest.fire('room:leave');
    emitted.length = 0;
    host.fire('room:leave');

    expect(roomManager.getRoom(roomCode)).toBeUndefined();
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode, state: engine });
    expect(emitted.filter((e) => e.event === 'game:state')).toEqual([]);
  });
});

// --- Absent and removed seats (plan 3.9, CORE-AUDIT C-04) -------------------------

/** The active player's whole turn: play a card if they can, else draw (and pass if still theirs). */
async function playTurn(h: LobbyHarness<CrazyEightsEngine>): Promise<string> {
  const engine = h.getState()!;
  const id = engine.getActivePlayerId();
  const socket = h.humans.find((s) => s.data.playerId === id)!;
  for (let moves = 0; !engine.isGameOver() && engine.getActivePlayerId() === id; moves++) {
    // A draw can be followed by playing an eight and choosing its suit.
    expect(moves).toBeLessThan(3);
    expect(await h.send(socket, nextMove(engine.getPlayerView(id)))).toEqual({ ok: true });
  }
  return id;
}

const seat = (h: LobbyHarness<CrazyEightsEngine>, i: number): FakeSocket => h.humans[i];

describe('Crazy Eights absent and removed seats', () => {
  beforeEach(() => vi.useFakeTimers());

  it('C-04: a disconnected seat gets a stand-in turn whenever the turn reaches it, and is skipped once removed', async () => {
    seedRandom(7);
    const removed = vi.spyOn(crazyEightsGame, 'onPlayerRemoved');
    const h = createLobbyHarness(crazyEightsDefinition, { humans: 3, graceMs: 60_000 });
    const engine = h.getState()!;
    const absent = h.humans.find((s) => s.data.playerId !== engine.getActivePlayerId())!;
    const absentHand = engine.getPlayerView(absent.data.playerId).myHand;
    absent.fire('disconnect');

    // Two full rounds while they are away: the table never waits on them.
    const actors: string[] = [];
    for (let turn = 0; turn < 6 && !engine.isGameOver(); turn++) {
      await vi.advanceTimersByTimeAsync(0);
      expect(engine.getActivePlayerId()).not.toBe(absent.data.playerId);
      actors.push(await playTurn(h));
    }
    expect(actors).not.toContain(absent.data.playerId);
    // Grace-window stand-ins pass without drawing: the absent hand is not penalised.
    expect(engine.getPlayerView(absent.data.playerId).myHand).toEqual(absentHand);

    // Grace expires: the seat leaves the turn order for good.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(removed).toHaveBeenCalledOnce();
    const drawnBefore = engine.getPlayerView(absent.data.playerId).myHand.length;
    for (let turn = 0; turn < 4 && !engine.isGameOver(); turn++) {
      await vi.advanceTimersByTimeAsync(0);
      expect(engine.getActivePlayerId()).not.toBe(absent.data.playerId);
      await playTurn(h);
    }
    // Skipped outright after removal: the removed hand never changes.
    expect(engine.getPlayerView(absent.data.playerId).myHand.length).toBe(drawnBefore);
  });

  it('a player who comes back is waited for again', async () => {
    const h = createLobbyHarness(crazyEightsDefinition, { humans: 2, graceMs: 60_000 });
    const engine = h.getState()!;
    const [first, second] = engine.getActivePlayerId() === seat(h, 0).data.playerId
      ? [seat(h, 0), seat(h, 1)] : [seat(h, 1), seat(h, 0)];
    second.fire('disconnect');
    await playTurn(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getActivePlayerId()).toBe(first.data.playerId);

    const returned = h.connect('returned-socket');
    returned.fire('player:reconnect', h.roomCode, second.data.playerId, h.tokens.get(second.data.playerId), () => undefined);
    await playTurn(h);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(engine.getActivePlayerId()).toBe(second.data.playerId);
  });

  it('stand-ins pause while nobody is connected and resume when someone returns', async () => {
    const h = createLobbyHarness(crazyEightsDefinition, { humans: 2, graceMs: 60_000 });
    const engine = h.getState()!;
    const active = h.humans.find((s) => s.data.playerId === engine.getActivePlayerId())!;
    const other = h.humans.find((s) => s !== active)!;
    other.fire('disconnect');
    active.fire('disconnect'); // their own turn: stand-in, then the turn reaches `other`
    const before = engine.getActivePlayerId();
    await vi.advanceTimersByTimeAsync(1_000);
    // Nobody is here: the turn is not played out for an empty table.
    expect(engine.getActivePlayerId()).toBe(before);

    const returned = h.connect('returned-socket');
    returned.fire('player:reconnect', h.roomCode, active.data.playerId, h.tokens.get(active.data.playerId), () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getActivePlayerId()).toBe(active.data.playerId);
  });

  it('removing a seat from a two-player game ends it, and the last seat wins', async () => {
    const h = createLobbyHarness(crazyEightsDefinition, { humans: 2, graceMs: 1_000 });
    const engine = h.getState()!;
    const [stays, leaves] = h.humans;
    leaves.fire('disconnect');
    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(engine.isGameOver()).toBe(true);
    expect(engine.getPlayerView(stays.data.playerId).winner).toEqual({ id: stays.data.playerId, name: 'Host' });
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
    expect(received(h.emitted, stays.data.playerId).at(-1)?.view.gameOver).toBe(true);
  });
});
