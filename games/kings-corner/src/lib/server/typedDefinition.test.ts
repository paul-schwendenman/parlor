/**
 * Kings Corner on the typed contract (plan 3.1b): per-recipient envelopes, the
 * lifecycle hooks, and a bot turn in flight across a restart, a removal and a
 * room deletion.
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
import { kingsCornerDefinition, kingsCornerGame } from './definition.js';
import { AIPlayer } from './ai/AIPlayer.js';

type AICallbacks = Parameters<AIPlayer['takeTurn']>[0];
import type { KingsCornerEngine } from './game/KingsCornerEngine.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function received(emitted: CapturedEmit[], to: string): GameStateEnvelope<'kings-corner'>[] {
  return emitted
    .filter((e) => e.event === 'game:state' && e.to === to)
    .map((e) => e.payload as GameStateEnvelope<'kings-corner'>);
}

/** Draw, play any mandatory kings, and end the turn, all through the boundary. */
async function endTurn(h: LobbyHarness<KingsCornerEngine>, socket: FakeSocket): Promise<void> {
  const engine = h.getState()!;
  const view = () => engine.getPlayerView(socket.data.playerId);
  if (view().phase === 'drawing') expect(await h.send(socket, { type: 'draw-card' })).toEqual({ ok: true });
  while (view().mustPlayKing) {
    const king = view().playableCards.find((p) => p.card.rank === 'K')!;
    expect(await h.send(socket, { type: 'play-card', card: king.card, target: king.validTargets[0] })).toEqual({ ok: true });
  }
  expect(await h.send(socket, { type: 'end-turn' })).toEqual({ ok: true });
}

/** The first bot turn waits for `release()`, then draws, plays mandatory kings and ends; later bot turns never finish. */
function holdFirstBotTurn() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const resumed = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn')
    .mockImplementation(() => new Promise<void>(() => undefined))
    .mockImplementationOnce(async (callbacks: AICallbacks) => {
      await gate;
      resumed();
      callbacks.onDrawCard();
      // Play mandatory kings first, like the real bot, so ending the turn is legal.
      while (callbacks.getView().mustPlayKing) {
        const king = callbacks.getView().playableCards.find((p) => p.card.rank === 'K')!;
        callbacks.onPlayCard(king.card, king.validTargets[0]);
      }
      callbacks.onEndTurn();
    });
  return { release, resumed, takeTurn };
}

/** One human (the host, seat 0) and one bot, with the bot's turn started and held. */
async function botTurnInFlight(humans = 1) {
  const bot = holdFirstBotTurn();
  const h = createLobbyHarness(kingsCornerDefinition, { humans, bots: 1 });
  for (const socket of h.humans) await endTurn(h, socket);
  await vi.advanceTimersByTimeAsync(0);
  expect(bot.takeTurn).toHaveBeenCalledTimes(1);
  return { bot, h, engine: h.getState()!, botId: h.botIds[0] };
}

describe('Kings Corner game:state envelopes', () => {
  it('players get their own hand; spectators get an empty hand and myIndex -1', async () => {
    const h = createDispatchHarness(kingsCornerDefinition, 3);
    h.spectate('spectator-socket');
    const engine = h.getState()!;
    const active = h.playerIds.find((id) => engine.getPlayerView(id).isActivePlayer)!;
    h.emitted.length = 0;

    expect(await h.send(active, { type: 'draw-card' })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      expect(received(h.emitted, id)).toEqual([{ gameId: 'kings-corner', view: engine.getPlayerView(id) }]);
      expect(engine.getPlayerView(id).myHand.length).toBeGreaterThan(0);
    }
    const spectator = received(h.emitted, 'spectator-socket');
    expect(spectator).toEqual([{ gameId: 'kings-corner', view: engine.getSpectatorView() }]);
    expect(spectator[0].view).toMatchObject({ myHand: [], myIndex: -1, playableCards: [] });
  });
});

describe('Kings Corner lifecycle hooks', () => {
  it('onPlayerRemoved: a removed seat whose turn it is gets the disconnect stand-in, and play returns', async () => {
    const removed = vi.spyOn(kingsCornerGame, 'onPlayerRemoved');
    const h = createLobbyHarness(kingsCornerDefinition);
    const engine = h.getState()!;
    const [host, guest] = h.humans;
    expect(engine.getPlayerView(host.data.playerId).isActivePlayer).toBe(true);

    guest.fire('disconnect');
    await endTurn(h, host);
    expect(engine.getPlayerView(guest.data.playerId).isActivePlayer).toBe(true);

    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: guest.data.playerId, state: engine }));
    expect(engine.getPlayerView(host.data.playerId).isActivePlayer).toBe(true);
    expect(received(h.emitted, host.data.playerId)).toHaveLength(1);
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
    expect(await h.send(host, { type: 'draw-card' })).toEqual({ ok: true });
  });

  it('onRoomDestroyed gets the running engine, and an in-flight bot turn changes nothing afterwards', async () => {
    const destroyed = vi.spyOn(kingsCornerGame, 'onRoomDestroyed');
    const { bot, h, engine, botId } = await botTurnInFlight();
    const before = structuredClone(engine.getPlayerView(botId));

    h.humans[0].fire('room:leave');
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode: h.roomCode, state: engine });

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getPlayerView(botId)).toEqual(before);
    expect(h.emitted).toEqual([]);
  });
});

describe('Kings Corner bot work across a restart and a removal', () => {
  it('a bot turn that started before a restart neither mutates the old game nor emits', async () => {
    const { bot, h, engine, botId } = await botTurnInFlight();
    const signal = bot.takeTurn.mock.calls[0][1];
    const before = structuredClone(engine.getPlayerView(botId));

    h.humans[0].fire('lobby:restartGame');
    expect(h.getState()).not.toBe(engine);
    expect(signal.aborted).toBe(true);

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getPlayerView(botId)).toEqual(before);
    expect(h.emitted).toEqual([]);
  });

  it('a bot turn in flight when another seat is removed still lands, and only remaining seats see it', async () => {
    const removed = vi.spyOn(kingsCornerGame, 'onPlayerRemoved');
    const { bot, h, engine, botId } = await botTurnInFlight(2);
    const [host, guest] = h.humans;

    guest.fire('disconnect');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledOnce();
    expect(engine.getPlayerView(botId).isActivePlayer).toBe(true);

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getPlayerView(botId).isActivePlayer).toBe(false);
    expect(received(h.emitted, host.data.playerId).length).toBeGreaterThan(0);
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
  });
});
