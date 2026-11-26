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
  it('onPlayerRemoved: removing a seat from a two-player game ends it, and the last seat wins', async () => {
    const removed = vi.spyOn(kingsCornerGame, 'onPlayerRemoved');
    const h = createLobbyHarness(kingsCornerDefinition);
    const engine = h.getState()!;
    const [host, guest] = h.humans;

    guest.fire('disconnect');
    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: guest.data.playerId, state: engine }));
    expect(engine.isGameOver()).toBe(true);
    expect(engine.getPlayerView(host.data.playerId).winner).toEqual({ id: host.data.playerId, name: 'Host' });
    expect(h.roomManager.getRoom(h.roomCode)?.status).toBe('finished');
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
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

describe('Kings Corner absent and removed seats (plan 3.9)', () => {
  it('C-05 / E-10: after a mid-game leave, the bot is found by engine seat and still takes its turn', async () => {
    const h = createLobbyHarness(kingsCornerDefinition, { humans: 2, bots: 1 });
    const engine = h.getState()!;
    const [a, b] = h.humans;
    const [botId] = h.botIds;

    const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn');
    await endTurn(h, a);
    a.fire('room:leave');
    expect(h.roomManager.getPlayersInRoom(h.roomCode).map((p) => p.id)).toEqual([b.data.playerId, botId]);
    // B's turn: lobby index 1 is now the bot, but the bot must not be started out of turn.
    await vi.advanceTimersByTimeAsync(0);
    expect(takeTurn).not.toHaveBeenCalled();

    await endTurn(h, b);
    expect(engine.getActivePlayerId()).toBe(botId);
    await vi.advanceTimersByTimeAsync(0);
    expect(takeTurn).toHaveBeenCalledOnce();

    // The real bot plays its turn; the removed seat is skipped and play returns to B.
    await vi.advanceTimersByTimeAsync(31_000);
    expect(engine.getActivePlayerId()).toBe(b.data.playerId);
  });

  it('a disconnected seat gets a stand-in turn whenever the turn reaches it, and is skipped once removed', async () => {
    const h = createLobbyHarness(kingsCornerDefinition, { humans: 3, graceMs: 60_000 });
    const engine = h.getState()!;
    const [a, b, c] = h.humans;
    c.fire('disconnect');
    for (let round = 0; round < 2; round++) {
      await endTurn(h, a);
      await endTurn(h, b);
      await vi.advanceTimersByTimeAsync(0);
      expect(engine.getActivePlayerId()).toBe(a.data.playerId);
    }
    const handBefore = engine.getPlayerView(c.data.playerId).myHand.length;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.roomManager.getPlayersInRoom(h.roomCode)).toHaveLength(2);
    await endTurn(h, a);
    expect(engine.getActivePlayerId()).toBe(b.data.playerId);
    await endTurn(h, b);
    expect(engine.getActivePlayerId()).toBe(a.data.playerId);
    expect(engine.getPlayerView(c.data.playerId).myHand.length).toBe(handBefore);
  });

  it('a bot turn in flight when the next human disconnects lands, then that human gets a stand-in', async () => {
    const { bot, h, engine, botId } = await botTurnInFlight(2);
    const [host, guest] = h.humans;
    // Seats: host, guest, bot. After the bot comes the host.
    host.fire('disconnect');
    expect(engine.getActivePlayerId()).toBe(botId);

    bot.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.resumed).toHaveBeenCalledOnce();
    // The host's turn was stood in for, so it is the guest's turn now.
    expect(engine.getActivePlayerId()).toBe(guest.data.playerId);
  });
});
