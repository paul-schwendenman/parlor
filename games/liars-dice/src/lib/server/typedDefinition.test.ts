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
  it('onPlayerRemoved: removing a seat from a two-player game eliminates it, and the last player wins', async () => {
    const removed = vi.spyOn(liarsDiceGame, 'onPlayerRemoved');
    const h = createLobbyHarness(liarsDiceDefinition);
    const engine = h.getState()!;
    const [stays, leaves] = h.humans;

    leaves.fire('disconnect');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: leaves.data.playerId, state: engine }));
    expect(engine.getState()).toMatchObject({ gameOver: true, phase: 'game-over', winner: stays.data.playerId });
    expect(engine.getState().players.find((p) => p.id === leaves.data.playerId)).toMatchObject({ eliminated: true, diceCount: 0 });
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
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

describe("Liar's Dice absent and removed seats (plan 3.9)", () => {
  it('a disconnected opener gets the opening-bid stand-in at once, and the table moves on', () => {
    const h = createLobbyHarness(liarsDiceDefinition, { graceMs: 60_000 });
    const engine = h.getState()!;
    const opener = h.humans.find((s) => s.data.playerId === activeId(engine))!;
    const other = h.humans.find((s) => s !== opener)!;

    opener.fire('disconnect');
    expect(engine.getState().players.find((p) => p.id === opener.data.playerId)?.connected).toBe(false);
    expect(engine.getState().currentBid).toMatchObject({ playerId: opener.data.playerId, quantity: 1, faceValue: 2 });
    expect(activeId(engine)).toBe(other.data.playerId);
  });

  it('a disconnected seat raises minimally whenever bidding reaches it, never risking a die, and is eliminated once removed', async () => {
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 3, graceMs: 60_000 });
    const engine = h.getState()!;
    const absent = h.humans.find((s) => s.data.playerId !== activeId(engine))!;
    absent.fire('disconnect');

    // Bid up until the turn reaches the absent seat: it raises by the smallest
    // legal amount instead of calling (a call would put a die at stake).
    for (let lap = 0; lap < 2; lap++) {
      while (activeId(engine) !== absent.data.playerId) {
        const socket = h.humans.find((s) => s.data.playerId === activeId(engine))!;
        // Present players just make the smallest legal raise too.
        expect(await h.send(socket, { type: 'bid', ...engine.getStandInBid()! })).toEqual({ ok: true });
      }
      const standing = engine.getState().currentBid!;
      await vi.advanceTimersByTimeAsync(1);
      expect(engine.getState().phase).toBe('bidding');
      const raised = engine.getState().currentBid!;
      expect(raised.playerId).toBe(absent.data.playerId);
      expect(engine.isValidBid(raised, standing)).toBe(true);
      expect(activeId(engine)).not.toBe(absent.data.playerId);
    }
    // Grace-window stand-ins never cost the seat a die.
    expect(engine.getState().players.find((p) => p.id === absent.data.playerId)?.diceCount).toBe(5);

    await vi.advanceTimersByTimeAsync(60_000);
    const seat = engine.getState().players.find((p) => p.id === absent.data.playerId)!;
    expect(seat).toMatchObject({ eliminated: true, diceCount: 0 });
    expect(engine.getState().gameOver).toBe(false);
    expect(activeId(engine)).not.toBe(absent.data.playerId);
  });

  it('the stand-in bid is the lowest legal quantity, preferring a non-1 face', () => {
    const h = createDispatchHarness(liarsDiceDefinition, 2);
    const engine = h.getState()!;
    expect(engine.getStandInBid()).toEqual({ quantity: 1, faceValue: 2 });
    const bidder = activeId(engine);
    engine.placeBid(bidder, 4, 3);
    expect(engine.getStandInBid()).toEqual({ quantity: 2, faceValue: 1 }); // wild ones: 1s at half the quantity
    engine.placeBid(activeId(engine), 2, 1);
    expect(engine.getStandInBid()).toEqual({ quantity: 3, faceValue: 1 }); // 1s up by one beats 5 of anything
  });

  it('F-30: the bot is handed only its own dice and the public table', async () => {
    const bot = holdFirstBotTurn();
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 1, bots: 1 });
    const engine = h.getState()!;
    if (activeId(engine) === h.humans[0].data.playerId) {
      expect(await h.send(h.humans[0], { type: 'bid', quantity: 1, faceValue: 2 })).toEqual({ ok: true });
    }
    await vi.advanceTimersByTimeAsync(0);
    const [view] = bot.takeTurn.mock.calls[0];
    expect(Object.keys(view).sort()).toEqual(['currentBid', 'myDice', 'spotOnEnabled', 'totalDiceInPlay', 'wildOnes']);
    const botSeat = engine.getState().players.find((p) => p.id === h.botIds[0])!;
    expect(view.myDice).toEqual(botSeat.dice);
    expect(view.myDice).not.toBe(botSeat.dice);
  });

  it('a bot turn in flight when the next human disconnects lands, then that human gets a stand-in', async () => {
    const bot = holdFirstBotTurn();
    const h = createLobbyHarness(liarsDiceDefinition, { humans: 2, bots: 1, graceMs: 60_000 });
    const engine = h.getState()!;
    const [botId] = h.botIds;
    for (let quantity = 1; activeId(engine) !== botId; quantity++) {
      const socket = h.humans.find((s) => s.data.playerId === activeId(engine))!;
      expect(await h.send(socket, { type: 'bid', quantity, faceValue: 2 })).toEqual({ ok: true });
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.takeTurn).toHaveBeenCalledTimes(1);
    const order = engine.getState().players.map((p) => p.id);
    const nextId = order[(order.indexOf(botId) + 1) % order.length];
    h.humans.find((s) => s.data.playerId === nextId)!.fire('disconnect');

    bot.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getState().bidHistory.at(-2)).toMatchObject({ playerId: botId, quantity: 5, faceValue: 6 });
    // The next seat is away: it raises the bot's bid by the smallest legal amount.
    expect(engine.getState().phase).toBe('bidding');
    expect(engine.getState().currentBid).toMatchObject({ playerId: nextId, quantity: 3, faceValue: 1 });
  });
});
