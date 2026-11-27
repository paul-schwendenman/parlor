import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoomManager } from '@parlor/multiplayer';
import { createFakeIo } from '@parlor/multiplayer/testing';
import { AIPlayer } from './ai/AIPlayer.js';
import { kingsCornerDefinition } from './definition.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function startBotTurn() {
  const io = createFakeIo();
  const rooms = new RoomManager();
  const host = rooms.createRoom('host', 'Host');
  const { roomCode } = host;
  rooms.selectGame(roomCode, kingsCornerDefinition.meta);
  const bot = rooms.addBot(roomCode, 'Bot');
  if (!bot.botId) throw new Error('Expected a bot seat');
  rooms.setPlayerReady(host.playerId, true);
  const callbacks = kingsCornerDefinition.createLobbyCallbacks(rooms, io);
  const players = rooms.startGame(roomCode);
  if (!players || !callbacks.onGameStart || !callbacks.onPlayerDisconnect) {
    throw new Error('Expected to start a Kings Corner game');
  }
  callbacks.onGameStart(roomCode, players, io);
  const engine = kingsCornerDefinition.typed.getState(rooms, roomCode);
  if (!engine) throw new Error('Expected a Kings Corner engine');

  // The engine advances from the disconnected first seat to the bot.
  void callbacks.onPlayerDisconnect(roomCode, host.playerId, io);
  expect(engine.getPlayerView(bot.botId).isActivePlayer).toBe(true);
  return { rooms, roomCode, engine, botId: bot.botId, emitted: io.emitted };
}

it('blocks every mutation and view emit when a running bot resumes after reset', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const resumed = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn').mockImplementation(async (callbacks) => {
    await pending;
    resumed();
    callbacks.onDrawCard();
    callbacks.onEndTurn();
  });

  const { rooms, roomCode, engine, botId, emitted } = startBotTurn();
  await vi.advanceTimersByTimeAsync(0);
  expect(takeTurn).toHaveBeenCalledTimes(1);
  const [, signal] = takeTurn.mock.calls[0];
  expect(signal.aborted).toBe(false);
  const before = structuredClone(engine.getPlayerView(botId));

  expect(rooms.resetGame(roomCode)).toBe(true);
  expect(signal.aborted).toBe(true);
  emitted.length = 0;
  const drawCard = vi.spyOn(engine, 'drawCard');
  const endTurn = vi.spyOn(engine, 'endTurn');
  finish();
  await vi.advanceTimersByTimeAsync(0);

  expect(resumed).toHaveBeenCalledTimes(1);
  expect(drawCard).not.toHaveBeenCalled();
  expect(endTurn).not.toHaveBeenCalled();
  expect(engine.getPlayerView(botId)).toEqual(before);
  expect(emitted).toEqual([]);
  expect(rooms.getRoom(roomCode)?.status).toBe('waiting');
  expect(rooms.getRoom(roomCode)?.gameData).toBeNull();
});

it('aborts a timed-out bot and ignores its late callback after the fallback turn', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const resumed = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn').mockImplementation(async (callbacks) => {
    await pending;
    resumed();
    callbacks.onDrawCard();
  });

  const { rooms, roomCode, engine, botId, emitted } = startBotTurn();
  await vi.advanceTimersByTimeAsync(0);
  const [, signal] = takeTurn.mock.calls[0];
  await vi.advanceTimersByTimeAsync(30_000);

  expect(signal.aborted).toBe(true);
  expect(engine.getPlayerView(botId).isActivePlayer).toBe(false);
  const before = structuredClone(engine.getPlayerView(botId));
  emitted.length = 0;
  const drawCard = vi.spyOn(engine, 'drawCard');
  finish();
  await vi.advanceTimersByTimeAsync(0);

  expect(resumed).toHaveBeenCalledTimes(1);
  expect(drawCard).not.toHaveBeenCalled();
  expect(engine.getPlayerView(botId)).toEqual(before);
  expect(emitted).toEqual([]);
  rooms.resetGame(roomCode);
});

it('finishes the room when the bot timeout plays its last king', async () => {
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn')
    .mockImplementation(() => new Promise<void>(() => undefined));
  const { rooms, roomCode, engine, botId, emitted } = startBotTurn();

  // Put the active bot one mandatory play from winning, with an empty corner.
  engine.drawCard(botId);
  const { activePlayerIndex } = engine.getPlayerView(botId);
  engine['players'][activePlayerIndex].hand = [{ rank: 'K', suit: 'hearts' }];
  expect(engine.getPlayerView(botId).mustPlayKing).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(takeTurn).toHaveBeenCalledTimes(1);
  emitted.length = 0;

  await vi.advanceTimersByTimeAsync(30_000);

  expect(engine.getActivePlayerId()).toBe(botId);
  expect(rooms.getRoom(roomCode)?.status).toBe('finished');
  expect(emitted.filter(({ event }) => event === 'game:state')).toEqual([
    expect.objectContaining({
      payload: {
        gameId: 'kings-corner',
        view: expect.objectContaining({
          phase: 'game-over',
          gameOver: true,
          winner: { id: botId, name: 'Bot' },
        }),
      },
    }),
  ]);
});
