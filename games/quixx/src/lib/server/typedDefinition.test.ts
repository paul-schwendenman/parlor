/**
 * Quixx on the typed contract (plan 3.1b): per-recipient envelopes, the
 * lifecycle hooks, and bot work scheduled before a restart, a removal and a
 * room deletion that comes due after it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { createDispatchHarness, createLobbyHarness, type CapturedEmit } from '@parlor/multiplayer/testing';
import { quixxDefinition, quixxGame } from './definition.js';
import { QuixxEngine } from './game/QuixxEngine.js';
import type { LobbyHarness } from '@parlor/multiplayer/testing';

vi.mock(import('@parlor/multiplayer/random'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, secureRandomInt: (max: number) => Math.floor(Math.random() * max) };
});

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

  it('onPlayerRemoved: removing a seat from a two-player game ends it and scores it', async () => {
    const h = createLobbyHarness(quixxDefinition, { graceMs: 100 });
    const engine = h.getState()!;
    h.humans[1].fire('disconnect');
    await vi.advanceTimersByTimeAsync(100);
    expect(engine.isGameOver()).toBe(true);
    expect(engine.getPhase()).toBe('game-over');
    expect(engine.getPlayerView(h.humans[0].data.playerId).scores).not.toBeNull();
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
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

/** The human move a passive player makes from where the game is. */
async function passIfDue(h: LobbyHarness<QuixxEngine>): Promise<void> {
  const engine = h.getState()!;
  for (const socket of h.humans) {
    const id = socket.data.playerId;
    if (engine.isGameOver() || engine.isAbsent(id)) continue;
    const me = engine.getPlayers().find((p) => p.id === id)!;
    const active = engine.getActivePlayerId() === id;
    if (engine.getPhase() === 'rolling' && active && !engine.shouldAutoRoll()) await h.send(socket, { type: 'roll-dice' });
    else if (engine.getPhase() === 'phase1' && me.phase1Decision === null) await h.send(socket, { type: 'phase1-pass' });
    else if (engine.getPhase() === 'phase2' && active) await h.send(socket, { type: 'phase2-pass' });
  }
}

describe('Quixx: nobody is left waiting (plan 3.9)', () => {
  it('F-09 / C-03: host plus two bots keeps rolling when a bot follows a bot', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const h = createLobbyHarness(quixxDefinition, { humans: 1, bots: 2 });
    const engine = h.getState()!;
    const seen = new Set<string>();
    for (let i = 0; i < 200 && !engine.isGameOver(); i++) {
      await passIfDue(h);
      await vi.advanceTimersByTimeAsync(250);
      seen.add(`${engine.getRound()}:${engine.getActivePlayerId()}:${engine.getPhase()}`);
    }
    // Before the fix the game sat at round 1, phase 'rolling', on the second bot.
    expect(engine.getRound() >= 3 || engine.isGameOver()).toBe(true);
    for (const botId of h.botIds) {
      expect([...seen].some((key) => key.includes(`${botId}:phase2`))).toBe(true);
    }
  });

  it('an active player who disconnects in phase 2 is passed, and the next turn auto-rolls', async () => {
    const h = createLobbyHarness(quixxDefinition, { graceMs: 60_000 });
    const engine = h.getState()!;
    await vi.advanceTimersByTimeAsync(500);
    for (const socket of h.humans) expect(await h.send(socket, { type: 'phase1-pass' })).toEqual({ ok: true });
    expect(engine.getPhase()).toBe('phase2');
    const active = h.humans.find((s) => s.data.playerId === engine.getActivePlayerId())!;

    active.fire('disconnect');
    expect(engine.getPhase()).toBe('rolling');
    // They passed phase 1, so passing phase 2 would cost a present player a
    // penalty; a seat in its grace window is not penalised.
    expect(engine.getPlayers().find((p) => p.id === active.data.playerId)?.penalties).toBe(0);
    await vi.advanceTimersByTimeAsync(501);
    expect(engine.getPhase()).toBe('phase1');
    // Their phase 1 is passed for them too, so the present player decides alone.
    expect(engine.getPlayers().find((p) => p.id === active.data.playerId)?.phase1Decision).toEqual({ type: 'pass' });
  });

  it('player-roll mode: an absent active roller has the roll made for them', async () => {
    const created: QuixxEngine[] = [];
    vi.spyOn(quixxGame, 'createState').mockImplementationOnce((roomCode, players) => {
      const engine = new QuixxEngine(
        players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
        roomCode,
        { diceRolling: 'player', turnTimer: null, phase1Timer: null },
      );
      created.push(engine);
      return engine;
    });
    const h = createLobbyHarness(quixxDefinition, { graceMs: 60_000 });
    const engine = h.getState()!;
    expect(engine).toBe(created[0]);
    const roller = h.humans.find((s) => s.data.playerId === engine.getActivePlayerId())!;
    const other = h.humans.find((s) => s !== roller)!;

    roller.fire('disconnect');
    expect(engine.getPhase()).toBe('phase1');
    expect(await h.send(other, { type: 'phase1-pass' })).toEqual({ ok: true });
    // Phase 1 resolves; their phase 2 is passed for them; the present player rolls next.
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.getPhase()).toBe('rolling');
    expect(engine.getActivePlayerId()).toBe(other.data.playerId);

    // And when their roll comes round again while still away, it is made for them.
    expect(await h.send(other, { type: 'roll-dice' })).toEqual({ ok: true });
    expect(await h.send(other, { type: 'phase1-pass' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1); // the absent seat's phase 1 pass
    expect(engine.getPhase()).toBe('phase2');
    expect(await h.send(other, { type: 'phase2-pass' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.getActivePlayerId()).toBe(roller.data.playerId);
    expect(engine.getPhase()).not.toBe('rolling');
    // Two stand-in turns, each passing both phases, and still no penalty.
    await vi.advanceTimersByTimeAsync(1);
    expect(await h.send(other, { type: 'phase1-pass' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.getActivePlayerId()).toBe(other.data.playerId);
    expect(engine.getPlayers().find((p) => p.id === roller.data.playerId)?.penalties).toBe(0);
  });

  it('a removed seat passes every phase 1 and is skipped in the rotation', async () => {
    const h = createLobbyHarness(quixxDefinition, { humans: 3, graceMs: 100 });
    const engine = h.getState()!;
    const gone = h.humans[2];
    gone.fire('disconnect');
    await vi.advanceTimersByTimeAsync(100);
    expect(engine.isRemoved(gone.data.playerId)).toBe(true);

    const actives = new Set<string>();
    for (let i = 0; i < 80 && !engine.isGameOver(); i++) {
      await passIfDue(h);
      await vi.advanceTimersByTimeAsync(250);
      actives.add(engine.getActivePlayerId());
    }
    expect(actives.has(gone.data.playerId)).toBe(false);
    expect(engine.getRound()).toBeGreaterThan(2);
  });

  it('a bot move scheduled before a seat disconnects lands, and the round carries on without them', async () => {
    const h = createLobbyHarness(quixxDefinition, { humans: 2, bots: 1, graceMs: 60_000 });
    const engine = h.getState()!;
    const [host, guest] = h.humans;
    await vi.advanceTimersByTimeAsync(500);
    expect(engine.getPhase()).toBe('phase1');
    expect(await h.send(host, { type: 'phase1-pass' })).toEqual({ ok: true });

    guest.fire('disconnect');
    expect(engine.getPlayers().find((p) => p.id === guest.data.playerId)?.phase1Decision).toEqual({ type: 'pass' });
    expect(engine.getPlayers().find((p) => p.isBot)?.phase1Decision).toBeNull();

    await vi.advanceTimersByTimeAsync(1_200);
    expect(engine.getPlayers().find((p) => p.isBot)?.phase1Decision).not.toBeNull();
    expect(engine.getPhase()).not.toBe('phase1');
  });
});
