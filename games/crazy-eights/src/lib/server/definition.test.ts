/**
 * Crazy Eights on the typed contract (plan 3.1b): what each recipient receives,
 * a full game through the action boundary, and the lifecycle hooks over the
 * real lobby handlers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { RoomManager, dispatchGameAction, setupLobbyHandlers, type AppServer, type AppSocket } from '@parlor/multiplayer';
import { createDispatchHarness, type CapturedEmit } from '@parlor/multiplayer/testing';
import { crazyEightsDefinition, crazyEightsGame } from './definition.js';
import type { CrazyEightsPlayerView } from '../types/game.js';

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

type Handler = (...args: unknown[]) => void;

function makeSocket(id: string) {
  const handlers: Record<string, Handler> = {};
  return {
    id,
    data: {} as { roomCode: string; playerId: string; playerName: string },
    on: (event: string, cb: Handler) => {
      handlers[event] = cb;
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    fire: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
}

function startLobbyGame() {
  const rm = new RoomManager(1_000);
  const emitted: CapturedEmit[] = [];
  const io = {
    in: () => ({ socketsLeave: vi.fn() }),
    to: (to: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ to, event, payload }) }),
    sockets: { sockets: new Map() },
  } as never as AppServer;
  const callbacks = crazyEightsDefinition.createLobbyCallbacks(rm, io);
  const host = makeSocket('host-socket');
  const guest = makeSocket('guest-socket');
  for (const socket of [host, guest]) setupLobbyHandlers(io, socket as never as AppSocket, rm, callbacks);

  host.fire('lobby:create', 'Ann', vi.fn());
  const { roomCode } = host.data;
  guest.fire('lobby:join', roomCode, 'Bob', vi.fn());
  rm.selectGame(roomCode, crazyEightsDefinition.meta);
  host.fire('lobby:ready', true, vi.fn());
  guest.fire('lobby:ready', true, vi.fn());
  host.fire('lobby:startGame', vi.fn());
  const engine = crazyEightsDefinition.typed!.getState(rm, roomCode)!;
  expect(engine).not.toBeNull();

  const send = (socket: ReturnType<typeof makeSocket>, action: unknown) =>
    dispatchGameAction({
      io, socket: socket as never as AppSocket, roomManager: rm, definition: crazyEightsDefinition,
      action, ack: undefined, onRoomFailure: vi.fn(),
    });
  return { rm, emitted, host, guest, roomCode, engine, send };
}

describe('Crazy Eights lifecycle hooks', () => {
  it('onPlayerRemoved: a removed seat whose turn it is gets the disconnect stand-in turn, and the table moves on', async () => {
    vi.useFakeTimers();
    const removed = vi.spyOn(crazyEightsGame, 'onPlayerRemoved');
    const { emitted, host, guest, engine, send } = startLobbyGame();
    const sockets = [host, guest];
    const [active, waiting] = engine.getPlayerView(host.data.playerId).isActivePlayer ? sockets : [guest, host];

    // The waiting seat drops out of turn: nothing to do for it yet.
    waiting.fire('disconnect');
    expect(engine.getPlayerView(active.data.playerId).isActivePlayer).toBe(true);

    // The active player ends their turn, so the turn lands on the absent seat.
    expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
    if (engine.getPlayerView(active.data.playerId).isActivePlayer) {
      expect(await send(active, { type: 'pass' })).toEqual({ ok: true });
    }
    expect(engine.getPlayerView(waiting.data.playerId).isActivePlayer).toBe(true);

    emitted.length = 0;
    vi.advanceTimersByTime(1_000);

    expect(removed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ playerId: waiting.data.playerId, state: engine }),
    );
    expect(engine.getPlayerView(active.data.playerId).isActivePlayer).toBe(true);
    const views = received(emitted, active.data.playerId);
    expect(views).toHaveLength(1);
    expect(views[0].view.isActivePlayer).toBe(true);
    expect(views[0].view.players.find((p) => p.id === waiting.data.playerId)?.connected).toBe(false);
    expect(received(emitted, waiting.data.playerId)).toEqual([]);

    // The game keeps going for the remaining player.
    expect(await send(active, { type: 'draw-card' })).toEqual({ ok: true });
  });

  it('onRoomDestroyed is called with the running engine when the room goes away, and nothing is emitted', () => {
    const destroyed = vi.spyOn(crazyEightsGame, 'onRoomDestroyed');
    const { rm, emitted, host, guest, roomCode, engine } = startLobbyGame();
    guest.fire('room:leave');
    emitted.length = 0;
    host.fire('room:leave');

    expect(rm.getRoom(roomCode)).toBeUndefined();
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode, state: engine });
    expect(emitted.filter((e) => e.event === 'game:state')).toEqual([]);
  });
});
