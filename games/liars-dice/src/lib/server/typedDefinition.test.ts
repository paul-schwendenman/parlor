/**
 * Liar's Dice on the typed contract (plan 3.1b): per-recipient envelopes, the
 * lifecycle hooks, and bot work that is in flight across a restart, a removal
 * and a room deletion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStateEnvelope } from '@parlor/game-types';
import { createDispatchHarness, createLobbyHarness, type CapturedEmit } from '@parlor/multiplayer/testing';
import { liarsDiceDefinition, liarsDiceGame } from './definition.js';
import { AIPlayer, type AICallbacks } from './ai/AIPlayer.js';
import type { LiarsDiceEngine } from './game/LiarsDiceEngine.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function received(emitted: CapturedEmit[], to: string): GameStateEnvelope<'liars-dice'>[] {
  return emitted
    .filter((e) => e.event === 'game:state' && e.to === to)
    .map((e) => e.payload as GameStateEnvelope<'liars-dice'>);
}

const activeId = (engine: LiarsDiceEngine) => {
  const state = engine.getState();
  return state.players[state.activePlayerIndex].id;
};

/** The first bot turn waits for `release()`, then bids; later bot turns never finish. */
function holdFirstBotTurn() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const resumed = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn')
    .mockImplementation(() => new Promise<void>(() => undefined))
    .mockImplementationOnce(async (_state, callbacks: AICallbacks) => {
      await gate;
      resumed();
      callbacks.onBid(5, 6);
    });
  return { release, resumed, takeTurn };
}

describe("Liar's Dice game:state envelopes", () => {
  it('players get their own dice; spectators get no dice and myIndex -1', async () => {
    const h = createDispatchHarness(liarsDiceDefinition, 3);
    h.spectate('spectator-socket');
    const engine = h.getState()!;
    h.emitted.length = 0;

    expect(await h.send(activeId(engine), { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      const envelopes = received(h.emitted, id);
      expect(envelopes).toHaveLength(1);
      expect(envelopes[0]).toEqual({ gameId: 'liars-dice', view: engine.getPlayerView(id) });
      expect(envelopes[0].view.myDice.length).toBeGreaterThan(0);
    }
    const spectator = received(h.emitted, 'spectator-socket');
    expect(spectator).toEqual([{ gameId: 'liars-dice', view: engine.getSpectatorView() }]);
    expect(spectator[0].view).toMatchObject({ myDice: [], myIndex: -1, revealedDice: null });
    expect(spectator[0].view.players.every((p) => p.dice === null)).toBe(true);
  });
});

describe("Liar's Dice lifecycle hooks", () => {
  it('onPlayerRemoved: a removed opener makes the opening bid so the table moves on', async () => {
    const removed = vi.spyOn(liarsDiceGame, 'onPlayerRemoved');
    const h = createLobbyHarness(liarsDiceDefinition);
    const engine = h.getState()!;
    const opener = h.humans.find((s) => s.data.playerId === activeId(engine))!;
    const other = h.humans.find((s) => s !== opener)!;

    h.emitted.length = 0;
    opener.fire('disconnect');
    // Nothing to call yet, so nothing changes and nothing is re-sent.
    expect(received(h.emitted, other.data.playerId)).toEqual([]);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: opener.data.playerId, state: engine }));
    expect(engine.getState().currentBid).toMatchObject({ playerId: opener.data.playerId, quantity: 1, faceValue: 2 });
    expect(activeId(engine)).toBe(other.data.playerId);
    expect(received(h.emitted, other.data.playerId).at(-1)?.view.isMyTurn).toBe(true);
    expect(received(h.emitted, opener.data.playerId)).toEqual([]);
    expect(await h.send(other, { type: 'challenge' })).toEqual({ ok: true });
  });

  it('onRoomDestroyed gets the running engine, and an in-flight bot turn changes nothing afterwards', async () => {
    const destroyed = vi.spyOn(liarsDiceGame, 'onRoomDestroyed');
    const bot = holdFirstBotTurn();
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 1, bots: 1 });
    const engine = h.getState()!;
    if (activeId(engine) === h.humans[0].data.playerId) {
      expect(await h.send(h.humans[0], { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.takeTurn).toHaveBeenCalledTimes(1);
    const before = structuredClone(engine.getState());

    h.humans[0].fire('room:leave');
    expect(h.roomManager.getRoom(h.roomCode)).toBeUndefined();
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode: h.roomCode, state: engine });

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getState()).toEqual(before);
    expect(h.emitted).toEqual([]);
  });
});

describe("Liar's Dice bot work across a restart and a removal", () => {
  it('a bot turn that started before a restart neither mutates the old game nor emits', async () => {
    const bot = holdFirstBotTurn();
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 1, bots: 1 });
    const engine = h.getState()!;
    if (activeId(engine) === h.humans[0].data.playerId) {
      expect(await h.send(h.humans[0], { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.takeTurn).toHaveBeenCalledTimes(1);
    const signal = bot.takeTurn.mock.calls[0][2]!;
    const before = structuredClone(engine.getState());

    h.humans[0].fire('lobby:restartGame');
    const restarted = h.getState()!;
    expect(restarted).not.toBe(engine);
    expect(signal.aborted).toBe(true);

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getState()).toEqual(before);
    expect(restarted.getState().bidHistory).toEqual([]);
    expect(h.emitted).toEqual([]);
  });

  it('a bot turn in flight when another seat is removed still lands, and only remaining seats see it', async () => {
    const bot = holdFirstBotTurn();
    const removed = vi.spyOn(liarsDiceGame, 'onPlayerRemoved');
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 2, bots: 1 });
    const engine = h.getState()!;
    const [botId] = h.botIds;
    for (let quantity = 1; activeId(engine) !== botId; quantity++) {
      const socket = h.humans.find((s) => s.data.playerId === activeId(engine))!;
      expect(await h.send(socket, { type: 'bid', quantity, faceValue: 2 })).toEqual({ ok: true });
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.takeTurn).toHaveBeenCalledTimes(1);

    const [host, guest] = h.humans;
    guest.fire('disconnect');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledOnce();

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getState().currentBid).toMatchObject({ playerId: botId, quantity: 5, faceValue: 6 });
    expect(received(h.emitted, host.data.playerId).at(-1)?.view.currentBid).toMatchObject({ playerId: botId });
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
  });
});
