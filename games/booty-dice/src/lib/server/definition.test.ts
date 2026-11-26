import { afterEach, expect, it, vi } from 'vitest';
import { dispatchGameAction, RoomManager, type AppServer, type AppSocket } from '@parlor/multiplayer';
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

it('sends one updated view per recipient when a turn adds multiple log entries', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  const emit = vi.fn();
  const io = {
    to: (recipient: string) => ({ emit: (event: string, view: unknown) => emit(recipient, event, view) }),
  } as never as AppServer;
  const rooms = new RoomManager();
  const host = rooms.createRoom('host-socket', 'Host');
  const { roomCode, playerId } = host;
  rooms.selectGame(roomCode, bootyDiceDefinition.meta);
  const guest = rooms.joinRoom(roomCode, 'guest-socket', 'Guest');
  if (!guest.playerId) throw new Error('Expected a guest seat');
  rooms.addSpectator(roomCode, 'spectator-socket');
  rooms.setPlayerReady(playerId, true);
  rooms.setPlayerReady(guest.playerId, true);
  const players = rooms.startGame(roomCode);
  if (!players) throw new Error('Expected the room to start');
  bootyDiceDefinition.createLobbyCallbacks(rooms, io).onGameStart?.(roomCode, players, io);
  const socket = { id: 'host-socket', data: { roomCode, playerId }, emit: vi.fn() } as never as AppSocket;
  const send = (type: string) => dispatchGameAction({
    io,
    socket,
    roomManager: rooms,
    definition: bootyDiceDefinition,
    action: { type },
    ack: undefined,
    onRoomFailure: vi.fn(),
  });

  expect(await send('roll')).toEqual({ ok: true });
  const engine = rooms.getGameData<GameEngine>(roomCode);
  const before = engine?.getState().gameLog.length ?? 0;
  emit.mockClear();

  expect(await send('endTurn')).toEqual({ ok: true });
  expect(engine?.getState().gameLog.length).toBeGreaterThan(before + 1);
  expect(emit.mock.calls.map(([recipient, event]) => [recipient, event])).toEqual([
    [playerId, 'game:state'],
    [guest.playerId, 'game:state'],
    ['spectator-socket', 'game:state'],
  ]);
});
