import { afterEach, expect, it, vi } from 'vitest';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { bootyDiceDefinition } from './definition.js';
import { AIPlayer } from './ai/AIPlayer.js';
import type { GameEngine } from './game/GameEngine.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('aborts an overdue bot before allowing the timeout fallback to end its turn', async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const emit = vi.fn();
  const io = { to: () => ({ emit }) } as never as AppServer;
  const rooms = new RoomManager();
  const host = rooms.createRoom('host-socket', 'Host');
  rooms.selectGame(host.roomCode, bootyDiceDefinition.meta);
  const bot = rooms.addBot(host.roomCode, 'Bot');
  rooms.setPlayerReady(host.playerId, true);
  const players = rooms.startGame(host.roomCode);
  if (!players) throw new Error('Expected the room to start');

  let completeBotTurn: () => void = () => {
    throw new Error('Bot turn did not start');
  };
  let signal: AbortSignal | undefined;
  const aborted = vi.fn();
  const takeTurn = vi.spyOn(AIPlayer.prototype, 'takeTurn').mockImplementation(
    (_state, callbacks, turnSignal) => new Promise<void>((resolve, reject) => {
      signal = turnSignal;
      signal?.addEventListener('abort', aborted, { once: true });
      completeBotTurn = () => {
        callbacks.onFinishRolling();
        callbacks.onEndTurn();
        void callbacks.onRoll().then(() => resolve(), reject);
      };
    }),
  );

  bootyDiceDefinition.createLobbyCallbacks(rooms, io).onGameStart?.(host.roomCode, players, io);
  const engine = rooms.getGameData<GameEngine>(host.roomCode);
  if (!engine) throw new Error('Expected a game engine');
  expect(engine.getState().players[0].id).toBe(bot.botId);
  await vi.advanceTimersByTimeAsync(0);
  expect(takeTurn).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(false);

  await vi.advanceTimersByTimeAsync(30_000);
  expect(aborted).toHaveBeenCalledOnce();
  expect(signal?.aborted).toBe(true);
  const afterFallback = structuredClone(engine.getState());
  expect(afterFallback.turnNumber).toBe(2);
  expect(afterFallback.players[afterFallback.currentPlayerIndex].id).toBe(host.playerId);
  emit.mockClear();

  completeBotTurn();
  await vi.runAllTimersAsync();
  expect(engine.getState()).toEqual(afterFallback);
  expect(emit).not.toHaveBeenCalled();
});
