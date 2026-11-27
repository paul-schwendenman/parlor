import { expect, it, vi } from 'vitest';
import { ROOM_CODE_LENGTH } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';

it('bounds code allocation attempts and preserves the current seat if allocation fails', () => {
  const random = vi.fn<(max: number) => number>().mockReturnValue(0);
  const rooms = new RoomManager(undefined, random);
  const first = rooms.createRoom('host', 'Host');
  expect(first.roomCode).toBe('A'.repeat(ROOM_CODE_LENGTH));
  const before = structuredClone(rooms.getRoom(first.roomCode));
  random.mockClear();

  expect(() => rooms.createRoom('host', 'Another room')).toThrow(/allocate/);
  expect(random).toHaveBeenCalledTimes(16 * ROOM_CODE_LENGTH);
  expect(rooms.getRoom(first.roomCode)).toEqual(before);
  expect(rooms.getPlayerIdBySocket('host')).toBe(first.playerId);

  expect(random).toHaveBeenCalledWith(32);
  random.mockReturnValue(31);;
  const next = rooms.createRoom('host', 'Another room');
  expect(next.roomCode).toBe('9'.repeat(ROOM_CODE_LENGTH));
  expect(rooms.getPlayerIdBySocket('host')).toBe(next.playerId);
  expect(rooms.getRoom(first.roomCode)).toBeUndefined();
});

it('caps room creation and releases capacity when a room is destroyed', () => {
  const rooms = new RoomManager();
  for (let index = 0; index < 512; index++) rooms.createRoom(`host-${index}`, 'Host');
  expect(() => rooms.createRoom('extra-host', 'Host')).toThrow(/room limit/);
  expect(rooms.getPlayerIdBySocket('extra-host')).toBeUndefined();
  rooms.leaveRoom('host-0');
  expect(rooms.createRoom('extra-host', 'Host').roomCode).toHaveLength(ROOM_CODE_LENGTH);
});

it('caps bots and accepts another after a bot is removed', () => {
  const rooms = new RoomManager();
  const { roomCode } = rooms.createRoom('host', 'Host');
  rooms.selectGame(roomCode, { id: 'test', minPlayers: 2, maxPlayers: 8, supportsBots: true });
  for (const name of ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave']) {
    expect(rooms.addBot(roomCode, name).success).toBe(true);
  }
  const before = structuredClone(rooms.getRoom(roomCode));
  expect(rooms.addBot(roomCode, 'Bot Eve')).toMatchObject({ success: false, error: expect.stringMatching(/4 bots at most/) });
  expect(rooms.getRoom(roomCode)).toEqual(before);
  const bot = rooms.getPlayersInRoom(roomCode).find((player) => player.isBot);
  expect(rooms.removeBot(roomCode, bot?.id ?? '').success).toBe(true);
  expect(rooms.addBot(roomCode, 'Bot Alice').success).toBe(true);
});

it('caps spectators without releasing a rejected player’s seat', () => {
  const rooms = new RoomManager();
  const original = rooms.createRoom('original', 'Original');
  const target = rooms.createRoom('target', 'Target');
  for (let index = 0; index < 16; index++) {
    expect(rooms.addSpectator(target.roomCode, `spectator-${index}`).success).toBe(true);
  }
  const before = structuredClone(rooms.getRoom(target.roomCode));
  expect(rooms.addSpectator(target.roomCode, 'original')).toMatchObject({
    success: false, error: expect.stringMatching(/spectator limit/),
  });
  expect(rooms.getRoom(target.roomCode)).toEqual(before);
  expect(rooms.getPlayerIdBySocket('original')).toBe(original.playerId);
  expect(rooms.addSpectator(target.roomCode, 'spectator-0').success).toBe(true);
  rooms.removeSpectator('spectator-0');
  expect(rooms.addSpectator(target.roomCode, 'original').success).toBe(true);
});
