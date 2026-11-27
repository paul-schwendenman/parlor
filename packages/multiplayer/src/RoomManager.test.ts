import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, type ExpiryOutcome } from './RoomManager.js';

const gameRules = { id: 'test', minPlayers: 2, maxPlayers: 8, supportsBots: true };

function seatTwoInGame(rm: RoomManager) {
  const host = rm.createRoom('sockA', 'Ann');
  const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
  rm.setPlayerReady(host.playerId, true);
  rm.setPlayerReady(guest.playerId!, true);
  rm.selectGame(host.roomCode, gameRules);
  rm.startGame(host.roomCode);
  return { host, guest };
}

describe('RoomManager identity', () => {
  it('createRoom returns stable id + token and keys maps by playerId', () => {
    const rm = new RoomManager();
    const res = rm.createRoom('sockA', 'Ann');
    expect(res.roomCode).toMatch(/^[A-Z0-9]+$/);
    expect(res.playerId).toBeTruthy();
    expect(res.reconnectToken).toBeTruthy();
    expect(res.playerId).not.toBe('sockA');

    const players = rm.getPlayersInRoom(res.roomCode);
    expect(players).toHaveLength(1);
    expect(players[0].id).toBe(res.playerId);
    expect(rm.getPlayerIdBySocket('sockA')).toBe(res.playerId);
    expect(rm.getRoomByPlayer(res.playerId)?.code).toBe(res.roomCode);
    expect(rm.isHost(res.roomCode, res.playerId)).toBe(true);
  });

  it('joinRoom issues a distinct id + token and maps the socket', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    expect(guest.success).toBe(true);
    expect(guest.playerId).toBeTruthy();
    expect(guest.playerId).not.toBe(host.playerId);
    expect(guest.reconnectToken).not.toBe(host.reconnectToken);
    expect(rm.getPlayerIdBySocket('sockB')).toBe(guest.playerId);
  });

  it('rejects duplicate names', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const dup = rm.joinRoom(host.roomCode, 'sockB', 'ann');
    expect(dup.success).toBe(false);
    expect(dup.error).toMatch(/taken/i);
  });
});

describe('RoomManager reconnect + token', () => {
  it('accepts reconnect with the correct token and re-maps the new socket', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    rm.handleDisconnect('sockB');

    const ok = rm.handleReconnect(host.roomCode, guest.playerId!, guest.reconnectToken!, 'sockC');
    expect(ok?.reconnectToken).toEqual(expect.any(String));
    expect(rm.getPlayerIdBySocket('sockC')).toBe(guest.playerId);

    const players = rm.getPlayersInRoom(host.roomCode);
    const reconnected = players.find((p) => p.id === guest.playerId);
    expect(reconnected?.connected).toBe(true);
    // Player is still keyed by its stable id, not the new socket id.
    expect(players.map((p) => p.id)).toContain(guest.playerId);
    expect(players.map((p) => p.id)).not.toContain('sockC');
  });

  it('rejects reconnect with a wrong token', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    rm.handleDisconnect('sockB');

    const ok = rm.handleReconnect(host.roomCode, guest.playerId!, 'not-the-token', 'sockC');
    expect(ok).toBeNull();
    expect(rm.getPlayerIdBySocket('sockC')).toBeUndefined();
  });

  it('rejects reconnect for an unknown player', () => {
    const rm = new RoomManager();
    const { host } = seatTwoInGame(rm);
    const ok = rm.handleReconnect(host.roomCode, 'ghost-id', 'whatever', 'sockC');
    expect(ok).toBeNull();
  });
});

describe('RoomManager maxPlayers', () => {
  it('enforces max at join', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    rm.setMaxPlayers(host.roomCode, 2);
    expect(rm.joinRoom(host.roomCode, 'sockB', 'Bob').success).toBe(true);
    const third = rm.joinRoom(host.roomCode, 'sockC', 'Cy');
    expect(third.success).toBe(false);
    expect(third.error).toMatch(/full/i);
  });

  it('blocks start when player count exceeds max', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.setPlayerReady(host.playerId, true);
    rm.setPlayerReady(guest.playerId!, true);
    rm.selectGame(host.roomCode, gameRules);
    // Shrink the cap below the seated count.
    rm.setMaxPlayers(host.roomCode, 1);
    expect(rm.canStartGame(host.roomCode)).toBe(false);
    expect(rm.startGame(host.roomCode)).toBeNull();
  });
});

describe('RoomManager disconnect + leave', () => {
  it('retains a disconnected lobby player during the grace window', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');

    const result = rm.handleDisconnect('sockA');
    expect(result?.wasHost).toBe(true);
    expect(result?.retained).toBe(true);
    expect(result?.playerId).toBe(host.playerId);
    expect(result?.newHostId).toBe(guest.playerId);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
    const stillThere = rm.getPlayersInRoom(host.roomCode).find((p) => p.id === host.playerId);
    expect(stillThere?.connected).toBe(false);
    // Silence the second host's would-be reassign so the room isn't left dangling.
    expect(guest.playerId).toBeTruthy();
  });

  it('keeps the seat on in-game disconnect', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    const result = rm.handleDisconnect('sockB');
    expect(result?.wasInGame).toBe(true);
    expect(result?.retained).toBe(true);
    const players = rm.getPlayersInRoom(host.roomCode);
    expect(players.find((p) => p.id === guest.playerId)?.connected).toBe(false);
  });

  it('leaveRoom removes the player entirely', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    const result = rm.leaveRoom('sockB');
    expect(result?.playerId).toBe(guest.playerId);
    expect(result?.retained).toBe(false);
    const players = rm.getPlayersInRoom(host.roomCode);
    expect(players.map((p) => p.id)).not.toContain(guest.playerId);
    expect(rm.getPlayerIdBySocket('sockB')).toBeUndefined();
  });
});

describe('RoomManager disconnect grace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function seatTwoInGameShort(rm: RoomManager) {
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.setPlayerReady(host.playerId, true);
    rm.setPlayerReady(guest.playerId!, true);
    rm.selectGame(host.roomCode, gameRules);
    rm.startGame(host.roomCode);
    return { host, guest };
  }

  it('reconnect within grace clears the timer and keeps hand/host/seat', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guest } = seatTwoInGameShort(rm);
    const onExpire = vi.fn();

    rm.handleDisconnect('sockB', onExpire);
    // Reconnect before the window elapses.
    vi.advanceTimersByTime(30_000);
    const ok = rm.handleReconnect(host.roomCode, guest.playerId!, guest.reconnectToken!, 'sockC');
    expect(ok?.reconnectToken).toEqual(expect.any(String));

    // Let the original window fully pass — the timer must have been cleared.
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();

    const players = rm.getPlayersInRoom(host.roomCode);
    expect(players.map((p) => p.id)).toContain(guest.playerId);
    expect(players.find((p) => p.id === guest.playerId)?.connected).toBe(true);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
  });

  it('lobby expiry removes the player and preserves the transferred host', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    const outcomes: ExpiryOutcome[] = [];

    rm.handleDisconnect('sockA', (o) => outcomes.push(o));
    vi.advanceTimersByTime(1_000);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      playerId: host.playerId,
      wasHost: false,
      wasInGame: false,
      roomDestroyed: false,
    });
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
    expect(rm.getPlayersInRoom(host.roomCode).map((p) => p.id)).not.toContain(host.playerId);
  });

  it('destroys a bot-only room when the last human expires', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const host = rm.createRoom('sockA', 'Ann');
    rm.selectGame(host.roomCode, gameRules);
    rm.addBot(host.roomCode, 'Bot Bob');
    const outcomes: ExpiryOutcome[] = [];

    rm.handleDisconnect('sockA', (o) => outcomes.push(o));
    vi.advanceTimersByTime(1_000);

    expect(outcomes[0]?.roomDestroyed).toBe(true);
    expect(rm.getRoom(host.roomCode)).toBeUndefined();
  });

  it('in-game expiry reports wasInGame and preserves the transferred host', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.setPlayerReady(host.playerId, true);
    rm.setPlayerReady(guest.playerId!, true);
    rm.selectGame(host.roomCode, gameRules);
    rm.startGame(host.roomCode);
    const outcomes: ExpiryOutcome[] = [];

    // Host disconnects mid-game.
    rm.handleDisconnect('sockA', (o) => outcomes.push(o));
    vi.advanceTimersByTime(1_000);

    expect(outcomes[0]).toMatchObject({
      playerId: host.playerId,
      wasInGame: true,
      wasHost: false,
      roomDestroyed: false,
    });
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('GCs the room and clears timers when every player is gone', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.setPlayerReady(host.playerId, true);
    rm.setPlayerReady(guest.playerId!, true);
    rm.selectGame(host.roomCode, gameRules);
    rm.startGame(host.roomCode);
    const outcomes: ExpiryOutcome[] = [];

    rm.handleDisconnect('sockA', (o) => outcomes.push(o));
    rm.handleDisconnect('sockB', (o) => outcomes.push(o));
    vi.advanceTimersByTime(1_000);

    // Both timers fired; the second removal empties and destroys the room.
    expect(outcomes.some((o) => o.roomDestroyed)).toBe(true);
    expect(rm.getRoom(host.roomCode)).toBeUndefined();
    // No dangling timers — advancing further does nothing.
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
  });
});

describe('RoomManager.isSeatedPlayer', () => {
  it('accepts a seated human bound to its own socket', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    expect(rm.isSeatedPlayer(host.roomCode, host.playerId)).toBe(true);
    expect(rm.isSeatedPlayer(host.roomCode, host.playerId, 'sockA')).toBe(true);
    expect(rm.isSeatedPlayer(host.roomCode.toLowerCase(), guest.playerId, 'sockB')).toBe(true);
  });

  it('rejects a missing id, an unknown room, and a player from another room', () => {
    const rm = new RoomManager();
    const { host } = seatTwoInGame(rm);
    const other = rm.createRoom('sockC', 'Cat');
    expect(rm.isSeatedPlayer(host.roomCode, undefined)).toBe(false);
    expect(rm.isSeatedPlayer(host.roomCode, '')).toBe(false);
    expect(rm.isSeatedPlayer('ZZZZ', host.playerId)).toBe(false);
    expect(rm.isSeatedPlayer(host.roomCode, other.playerId, 'sockC')).toBe(false);
  });

  it('rejects a socket acting for a seat it is not bound to', () => {
    const rm = new RoomManager();
    const { host } = seatTwoInGame(rm);
    expect(rm.isSeatedPlayer(host.roomCode, host.playerId, 'sockB')).toBe(false);
    expect(rm.isSeatedPlayer(host.roomCode, host.playerId, 'stranger')).toBe(false);
  });

  it('rejects spectators and bots', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    rm.selectGame(host.roomCode, gameRules);
    const bot = rm.addBot(host.roomCode, 'Bot Alice');
    rm.addSpectator(host.roomCode, 'sockS');
    expect(rm.isSpectator('sockS')).toBe(true);
    expect(rm.isSeatedPlayer(host.roomCode, host.playerId, 'sockS')).toBe(false);
    expect(rm.isSeatedPlayer(host.roomCode, bot.botId)).toBe(false);
  });

  it('rejects a player after they leave', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    rm.leaveRoom('sockB');
    expect(rm.isSeatedPlayer(host.roomCode, guest.playerId, 'sockB')).toBe(false);
  });
});

describe('RoomManager.clearReadiness', () => {
  it('unreadies every human seat, keeps bots ready, and refuses once a game is running', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.selectGame(host.roomCode, gameRules);
    rm.setPlayerReady(guest.playerId!, true);
    expect(rm.addBot(host.roomCode, 'Bot Cy').success).toBe(true);

    expect(rm.clearReadiness(host.roomCode)).toBe(true);
    const ready = Object.fromEntries(rm.getPlayersInRoom(host.roomCode).map(p => [p.name, p.isReady]));
    expect(ready).toEqual({ Ann: false, Bob: false, 'Bot Cy': true });
    expect(rm.clearReadiness('NOPE99')).toBe(false);

    rm.setPlayerReady(guest.playerId!, true);
    rm.startGame(host.roomCode);
    const before = structuredClone(rm.getRoom(host.roomCode));
    expect(rm.clearReadiness(host.roomCode)).toBe(false);
    expect(rm.getRoom(host.roomCode)).toEqual(before);
  });
});
