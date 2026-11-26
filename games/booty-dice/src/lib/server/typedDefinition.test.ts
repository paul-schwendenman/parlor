/**
 * Booty Dice on the typed contract (plan 3.1b): per-recipient envelopes, the
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
import { bootyDiceDefinition, bootyDiceGame } from './definition.js';
import { AIPlayer } from './ai/AIPlayer.js';
import type { GameEngine } from './game/GameEngine.js';

type AICallbacks = Parameters<AIPlayer['takeTurn']>[1];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function received(emitted: CapturedEmit[], to: string): GameStateEnvelope<'booty-dice'>[] {
  return emitted
    .filter((e) => e.event === 'game:state' && e.to === to)
    .map((e) => e.payload as GameStateEnvelope<'booty-dice'>);
}

const currentId = (engine: GameEngine) => engine.getState().players[engine.getState().currentPlayerIndex].id;

/** Aim every pending attack or steal at the first other live player. */
function targetsFor(engine: GameEngine, playerId: string) {
  const other = engine.getState().players.find((p) => p.id !== playerId && !p.isEliminated)!;
  return engine.getState().pendingActions
    .filter((a) => !a.resolved)
    .map((a) => ({ dieIndex: a.dieIndex, targetPlayerId: other.id }));
}

/** A full human turn through the boundary. */
async function playTurn(h: LobbyHarness<GameEngine>, socket: FakeSocket): Promise<void> {
  const engine = h.getState()!;
  expect(await h.send(socket, { type: 'roll' })).toEqual({ ok: true });
  expect(await h.send(socket, { type: 'finishRolling' })).toEqual({ ok: true });
  for (const target of targetsFor(engine, socket.data.playerId)) {
    expect(await h.send(socket, { type: 'selectTarget', ...target })).toEqual({ ok: true });
  }
  expect(await h.send(socket, { type: 'endTurn' })).toEqual({ ok: true });
}

/** The first bot turn waits for `release()`, then plays a full turn; later bot turns never finish. */
function holdFirstBotTurn(engineOf: () => GameEngine) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const resumed = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn')
    .mockImplementation(() => new Promise<void>(() => undefined))
    .mockImplementationOnce(async (state, callbacks: AICallbacks) => {
      await gate;
      resumed();
      const botId = state.players[state.currentPlayerIndex].id;
      await callbacks.onRoll();
      callbacks.onFinishRolling();
      for (const target of targetsFor(engineOf(), botId)) callbacks.onSelectTarget(target.dieIndex, target.targetPlayerId);
      callbacks.onEndTurn();
    });
  return { release, resumed, takeTurn };
}

/** Humans play until it is the bot's turn, whose first move is then held. */
async function botTurnInFlight(humans = 1) {
  let engine: GameEngine | null = null;
  const bot = holdFirstBotTurn(() => engine!);
  const h = createLobbyHarness(bootyDiceDefinition, { humans, bots: 1 });
  engine = h.getState()!;
  const [botId] = h.botIds;
  while (currentId(engine) !== botId) {
    await playTurn(h, h.humans.find((s) => s.data.playerId === currentId(engine))!);
  }
  await vi.advanceTimersByTimeAsync(0);
  expect(bot.takeTurn).toHaveBeenCalledTimes(1);
  return { bot, h, engine, botId };
}

describe('Booty Dice game:state envelopes', () => {
  it('each player gets its own view and spectators the spectator view, all tagged booty-dice', async () => {
    const h = createDispatchHarness(bootyDiceDefinition, 3);
    h.spectate('spectator-socket');
    const engine = h.getState()!;
    h.emitted.length = 0;

    expect(await h.send(currentId(engine), { type: 'roll' })).toEqual({ ok: true });

    for (const id of h.playerIds) {
      expect(received(h.emitted, id)).toEqual([{ gameId: 'booty-dice', view: engine.getPlayerView(id) }]);
      expect(engine.getPlayerView(id).myIndex).toBeGreaterThanOrEqual(0);
    }
    const spectator = received(h.emitted, 'spectator-socket');
    expect(spectator).toEqual([{ gameId: 'booty-dice', view: engine.getSpectatorView() }]);
    expect(spectator[0].view).toMatchObject({ myIndex: -1, isMyTurn: false });
    expect(h.emitted).toHaveLength(4);
  });
});

describe('Booty Dice lifecycle hooks', () => {
  it('onPlayerRemoved: a removed seat whose turn came round forfeits it, and play returns', async () => {
    const removed = vi.spyOn(bootyDiceGame, 'onPlayerRemoved');
    const h = createLobbyHarness(bootyDiceDefinition);
    const engine = h.getState()!;
    const active = h.humans.find((s) => s.data.playerId === currentId(engine))!;
    const absent = h.humans.find((s) => s !== active)!;

    h.emitted.length = 0;
    absent.fire('disconnect');
    // Not their turn: nothing changes, so no view is re-sent.
    expect(received(h.emitted, active.data.playerId)).toEqual([]);

    await playTurn(h, active);
    expect(currentId(engine)).toBe(absent.data.playerId);
    const coins = engine.getState().players.map((p) => p.doubloons);

    h.emitted.length = 0;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ playerId: absent.data.playerId, state: engine }));
    expect(currentId(engine)).toBe(active.data.playerId);
    // No roll this turn, so nothing was scored for the absent seat.
    expect(engine.getState().players.map((p) => p.doubloons)).toEqual(coins);
    expect(received(h.emitted, active.data.playerId).at(-1)?.view.isMyTurn).toBe(true);
    expect(received(h.emitted, absent.data.playerId)).toEqual([]);
    expect(await h.send(active, { type: 'roll' })).toEqual({ ok: true });
  });

  it('onRoomDestroyed gets the running engine, and an in-flight bot turn changes nothing afterwards', async () => {
    const destroyed = vi.spyOn(bootyDiceGame, 'onRoomDestroyed');
    const { bot, h, engine } = await botTurnInFlight();
    const before = structuredClone(engine.getState());

    h.humans[0].fire('room:leave');
    expect(destroyed).toHaveBeenCalledExactlyOnceWith({ roomCode: h.roomCode, state: engine });

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getState()).toEqual(before);
    expect(h.emitted).toEqual([]);
  });
});

describe('Booty Dice bot work across a restart and a removal', () => {
  it('a bot turn that started before a restart neither mutates the old game nor emits', async () => {
    const { bot, h, engine } = await botTurnInFlight();
    const signal = bot.takeTurn.mock.calls[0][2]!;
    const before = structuredClone(engine.getState());

    h.humans[0].fire('lobby:restartGame');
    expect(h.getState()).not.toBe(engine);
    expect(signal.aborted).toBe(true);

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getState()).toEqual(before);
    expect(h.emitted).toEqual([]);
  });

  it('a bot turn in flight when another seat is removed still lands, and only remaining seats see it', async () => {
    const removed = vi.spyOn(bootyDiceGame, 'onPlayerRemoved');
    const { bot, h, engine, botId } = await botTurnInFlight(2);
    const [host, guest] = h.humans;
    const turn = engine.getState().turnNumber;

    guest.fire('disconnect');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removed).toHaveBeenCalledOnce();
    expect(currentId(engine)).toBe(botId);

    h.emitted.length = 0;
    bot.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(bot.resumed).toHaveBeenCalledOnce();
    expect(engine.getState().turnNumber).toBeGreaterThan(turn);
    expect(received(h.emitted, host.data.playerId).length).toBeGreaterThan(0);
    expect(received(h.emitted, guest.data.playerId)).toEqual([]);
  });
});
