/**
 * Quixx on the typed contract (plan 3.1b): per-recipient envelopes, the
 * lifecycle hooks, and bot work scheduled before a restart, a removal and a
 * room deletion that comes due after it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { createDispatchHarness, createLobbyHarness, type CapturedEmit } from '@parlor/multiplayer/testing';
import { quixxDefinition, quixxGame } from './definition.js';

beforeEach(() => {
  vi.useFakeTimers();
  // Bot delays are 700–1200 ms; pin them to the slow end.
  vi.spyOn(Math, 'random').mockReturnValue(0.999);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function received(emitted: CapturedEmit[], to: string): GameStateEnvelope<'quixx'>[] {
  return emitted
    .filter((e) => e.event === 'game:state' && e.to === to)
    .map((e) => e.payload as GameStateEnvelope<'quixx'>);
}

describe('Quixx game:state envelopes', () => {
  it('each player gets its own view and spectators the spectator view, all tagged quixx', async () => {
    const h = createDispatchHarness(quixxDefinition, 3);
    h.spectate('spectator-socket');
    await vi.advanceTimersByTimeAsync(500); // auto-roll
    const engine = h.getState()!;
    expect(engine.getPhase()).toBe('phase1');
    h.emitted.length = 0;

    expect(await h.send(h.playerIds[0], { type: 'phase1-pass' })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      expect(received(h.emitted, id)).toEqual([{ gameId: 'quixx', view: engine.getPlayerView(id) }]);
    }
    expect(received(h.emitted, 'spectator-socket')).toEqual([{ gameId: 'quixx', view: engine.getSpectatorView() }]);
    expect(h.emitted).toHaveLength(4);
  });
});

describe('Quixx lifecycle hooks', () => {
  it('onPlayerRemoved: a removed seat passes phase 1 for itself, so the round resolves', async () => {
    const removed = vi.spyOn(quixxGame, 'onPlayerRemoved');
    const h = createLobbyHarness(quixxDefinition, { graceMs: 100 });
    const engine = h.getState()!;
    const [host, guest] = h.humans;
    await vi.advanceTimersByTimeAsync(500);
    expect(engine.getPhase()).toBe('phase1');

    // The guest's socket dropped before the roll was resolved, and never came back.
    expect(await h.send(host, { type: 'phase1-pass' })).toEqual({ ok: true });
    guest.fire('disconnect');
    // The disconnect stand-in already passes; the removal must not break anything after it.
    expect(engine.getPhase()).toBe('phase2');
    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(100);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: guest.data.playerId, state: engine }));
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
    expect(received(h.emitted, host.data.playerId).length).toBeGreaterThan(0);
  });

  it('onPlayerRemoved: removal after the disconnect stand-in already advanced still auto-rolls the next turn', async () => {
    const h = createLobbyHarness(quixxDefinition, { graceMs: 100 });
    const engine = h.getState()!;
    await vi.advanceTimersByTimeAsync(500);
    const activeId = engine.getPlayers()[engine.getActivePlayerIndex()].id;
    const active = h.humans.find((s) => s.data.playerId === activeId)!;
    const other = h.humans.find((s) => s !== active)!;
    expect(await h.send(other, { type: 'phase1-pass' })).toEqual({ ok: true });
    expect(await h.send(active, { type: 'phase1-pass' })).toEqual({ ok: true });
    expect(engine.getPhase()).toBe('phase2');

    // The active seat drops in phase 2: its turn is passed, leaving a 'rolling' phase
    // that the disconnect path does not auto-roll. Removal carries the game on.
    active.fire('disconnect');
    expect(engine.getPhase()).toBe('rolling');
    await vi.advanceTimersByTimeAsync(100 + 500);
    expect(engine.getPhase()).toBe('phase1');
  });

  it('onRoomDestroyed gets the running engine, and a pending bot move never lands', async () => {
    const destroyed = vi.spyOn(quixxGame, 'onRoomDestroyed');
    const h = createLobbyHarness(quixxDefinition, { humans: 1, bots: 1 });
    const engine = h.getState()!;
    await vi.advanceTimersByTimeAsync(500);
    expect(engine.getPhase()).toBe('phase1');
    const before = structuredClone(engine.getPlayerView(h.botIds[0]));

    h.humans[0].fire('room:leave');
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode: h.roomCode, state: engine });
    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(engine.getPlayerView(h.botIds[0])).toEqual(before);
    expect(h.emitted).toEqual([]);
  });
});

describe('Quixx bot work across a restart and a removal', () => {
  it('a bot move scheduled before a restart never touches the old game', async () => {
    const h = createLobbyHarness(quixxDefinition, { humans: 1, bots: 1 });
    const engine = h.getState()!;
    await vi.advanceTimersByTimeAsync(500);
    expect(engine.getPhase()).toBe('phase1');
    const bot = () => engine.getPlayers().find((p) => p.isBot)!;
    expect(bot().phase1Decision).toBeNull();
    const before = structuredClone(engine.getPlayerView(h.humans[0].data.playerId));

    h.humans[0].fire('lobby:restartGame');
    expect(h.getState()).not.toBe(engine);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot().phase1Decision).toBeNull();
    expect(engine.getPlayerView(h.humans[0].data.playerId)).toEqual(before);
    // Everything sent after the restart came from the new game.
    const restarted = h.getState()!;
    expect(received(h.emitted, h.humans[0].data.playerId).at(-1)?.view).toEqual(
      restarted.getPlayerView(h.humans[0].data.playerId),
    );
  });

  it('a bot move scheduled before another seat is removed still lands, and only remaining seats see it', async () => {
    const h = createLobbyHarness(quixxDefinition, { humans: 2, bots: 1, graceMs: 100 });
    const engine = h.getState()!;
    const [host, guest] = h.humans;
    await vi.advanceTimersByTimeAsync(500);
    expect(await h.send(host, { type: 'phase1-pass' })).toEqual({ ok: true });

    guest.fire('disconnect');
    await vi.advanceTimersByTimeAsync(100);
    const bot = engine.getPlayers().find((p) => p.isBot)!;
    expect(bot.phase1Decision).toBeNull();

    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(1_200);
    expect(engine.getPlayers().find((p) => p.isBot)!.phase1Decision).not.toBeNull();
    expect(received(h.emitted, host.data.playerId).length).toBeGreaterThan(0);
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
  });
});
