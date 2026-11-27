import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, type ExpiryOutcome, type HostHandoffOutcome } from './RoomManager.js';

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
    // The host keeps the role through its short grace (plan 8.7).
    expect(result?.newHostId).toBeUndefined();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(true);
    const stillThere = rm.getPlayersInRoom(host.roomCode).find((p) => p.id === host.playerId);
    expect(stillThere?.connected).toBe(false);
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

describe('RoomManager.transferHost (plan 8.6)', () => {
  function lobbyOfThree(rm: RoomManager) {
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    const third = rm.joinRoom(host.roomCode, 'sockC', 'Cat');
    rm.selectGame(host.roomCode, gameRules);
    const bot = rm.addBot(host.roomCode, 'Bot Dee');
    rm.addSpectator(host.roomCode, 'sockS');
    const other = rm.createRoom('sockO', 'Oz');
    return { host, guest: guest.playerId!, third: third.playerId!, bot: bot.botId!, other: other.playerId };
  }

  it('rejects every invalid transfer without touching the room, then accepts a valid one', () => {
    const rm = new RoomManager();
    const { host, guest, third, bot, other } = lobbyOfThree(rm);
    rm.handleDisconnect('sockC');
    const before = structuredClone(rm.getRoom(host.roomCode));

    const rejected: [string, string, string][] = [
      [guest, third, 'Only the host can pass the host role on'],
      ['sockS', guest, 'Only the host can pass the host role on'],
      [host.playerId, host.playerId, 'You are already the host'],
      [host.playerId, bot, 'A bot cannot be the host'],
      [host.playerId, third, 'Cat is offline. Try again when they are back.'],
      [host.playerId, 'nobody', 'That player is not in this room'],
      [host.playerId, 'sockS', 'That player is not in this room'],
      [host.playerId, other, 'That player is not in this room'],
    ];
    for (const [from, to, error] of rejected) {
      expect(rm.transferHost(host.roomCode, from, to)).toEqual({ success: false, error });
      expect(rm.getRoom(host.roomCode)).toEqual(before);
    }
    expect(rm.transferHost('NOPE99', host.playerId, guest)).toEqual({ success: false, error: 'Room not found' });

    expect(rm.transferHost(host.roomCode.toLowerCase(), host.playerId, guest)).toEqual({ success: true });
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest);
    expect(rm.isHost(host.roomCode, host.playerId)).toBe(false);
    // The old host is now an ordinary guest and cannot take the role back.
    expect(rm.transferHost(host.roomCode, host.playerId, guest).success).toBe(false);
  });

  it('only passes the role on in the lobby', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    expect(rm.transferHost(host.roomCode, host.playerId, guest.playerId!)).toEqual({
      success: false,
      error: 'You can pass the host role on in the lobby, between games',
    });
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
  });

  it('gives the new host the start: the old host now needs Ready', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    rm.selectGame(host.roomCode, gameRules);
    rm.setPlayerReady(guest.playerId!, true);
    expect(rm.canStartGame(host.roomCode)).toBe(true);
    rm.transferHost(host.roomCode, host.playerId, guest.playerId!);
    expect(rm.canStartGame(host.roomCode)).toBe(false);
    rm.setPlayerReady(host.playerId, true);
    expect(rm.canStartGame(host.roomCode)).toBe(true);
  });
});

describe('RoomManager host grace (plan 8.7)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function lobby(rm: RoomManager, names = ['Bob']) {
    const host = rm.createRoom('sockA', 'Ann');
    const guests = names.map((name, i) => rm.joinRoom(host.roomCode, `sock${i}`, name));
    return { host, guests };
  }

  it('keeps the role for the grace window, then hands it to a connected human', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [guest] } = lobby(rm);
    const handoffs: HostHandoffOutcome[] = [];
    const expiries: ExpiryOutcome[] = [];

    rm.handleDisconnect('sockA', (o) => expiries.push(o), (o) => handoffs.push(o));
    vi.advanceTimersByTime(9_999);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
    expect(handoffs).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(handoffs).toEqual([{ roomCode: host.roomCode, previousHostId: host.playerId, newHostId: guest.playerId }]);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(false);

    // The seat's own expiry later does not reassign again.
    vi.advanceTimersByTime(50_000);
    expect(expiries).toEqual([expect.objectContaining({ wasHost: false, newHostId: undefined })]);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('uses a configurable delay', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000, undefined, 250);
    const { host, guests: [guest] } = lobby(rm);
    const onHostChange = vi.fn();
    rm.handleDisconnect('sockA', undefined, onHostChange);
    vi.advanceTimersByTime(250);
    expect(onHostChange).toHaveBeenCalledOnce();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('cancels the hand-off when the host reconnects inside the window', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host } = lobby(rm);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    vi.advanceTimersByTime(5_000);
    const back = rm.handleReconnect(host.roomCode, host.playerId, host.reconnectToken, 'sockA2');
    expect(back?.newHostId).toBeUndefined();
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(onHostChange).not.toHaveBeenCalled();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
  });

  it('a second disconnect after a quick return starts a fresh window', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [guest] } = lobby(rm);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    vi.advanceTimersByTime(8_000);
    rm.handleReconnect(host.roomCode, host.playerId, host.reconnectToken, 'sockA2');
    rm.handleDisconnect('sockA2', undefined, onHostChange);
    vi.advanceTimersByTime(8_000);
    expect(onHostChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(onHostChange).toHaveBeenCalledOnce();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('an explicit leave after a quick return hands the role on at once, with no late hand-off', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [guest] } = lobby(rm);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    rm.handleReconnect(host.roomCode, host.playerId, host.reconnectToken, 'sockA2');
    const left = rm.leaveRoom('sockA2');
    expect(left?.newHostId).toBe(guest.playerId);
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(onHostChange).not.toHaveBeenCalled();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('when seat expiry comes first, removal reassigns once and the hand-off never fires', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000, undefined, 5_000);
    const { host, guests: [guest] } = lobby(rm);
    const expiries: ExpiryOutcome[] = [];
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', (o) => expiries.push(o), onHostChange);
    vi.advanceTimersByTime(1_000);
    expect(expiries).toEqual([expect.objectContaining({ wasHost: true, newHostId: guest.playerId })]);
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(onHostChange).not.toHaveBeenCalled();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('with equal delays the hand-off runs first and expiry does not reassign again', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000);
    const { host, guests: [guest] } = lobby(rm);
    const expiries: ExpiryOutcome[] = [];
    const handoffs: HostHandoffOutcome[] = [];

    rm.handleDisconnect('sockA', (o) => expiries.push(o), (o) => handoffs.push(o));
    vi.advanceTimersByTime(1_000);
    expect(handoffs).toHaveLength(1);
    expect(expiries).toEqual([expect.objectContaining({ wasHost: false, newHostId: undefined })]);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('clears the hand-off when the room is destroyed', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(1_000, undefined, 5_000);
    const host = rm.createRoom('sockA', 'Ann');
    rm.selectGame(host.roomCode, gameRules);
    rm.addBot(host.roomCode, 'Bot Bob');
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    vi.advanceTimersByTime(1_000);
    expect(rm.getRoom(host.roomCode)).toBeUndefined();
    expect(rm.hasPendingHostHandoff(host.roomCode)).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(onHostChange).not.toHaveBeenCalled();
  });

  it('picks whoever is connected when the window ends', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [bob, cat] } = lobby(rm, ['Bob', 'Cat']);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    rm.handleDisconnect('sock0');
    vi.advanceTimersByTime(10_000);
    expect(onHostChange).toHaveBeenCalledExactlyOnceWith({
      roomCode: host.roomCode, previousHostId: host.playerId, newHostId: cat.playerId,
    });
    expect(rm.getRoom(host.roomCode)?.hostId).not.toBe(bob.playerId);
  });

  it('with nobody connected at the end of the window, the first human back becomes host', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [bob] } = lobby(rm);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sockA', undefined, onHostChange);
    rm.handleDisconnect('sock0');
    vi.advanceTimersByTime(10_000);
    expect(onHostChange).not.toHaveBeenCalled();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);

    const back = rm.handleReconnect(host.roomCode, bob.playerId!, bob.reconnectToken!, 'sockB2');
    expect(back?.newHostId).toBe(bob.playerId);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(bob.playerId);
  });

  it('a guest who reconnects or joins inside the window does not take the role', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [bob] } = lobby(rm);
    const onHostChange = vi.fn();

    rm.handleDisconnect('sock0');
    rm.handleDisconnect('sockA', undefined, onHostChange);
    const back = rm.handleReconnect(host.roomCode, bob.playerId!, bob.reconnectToken!, 'sockB2');
    expect(back?.newHostId).toBeUndefined();
    const joined = rm.joinRoom(host.roomCode, 'sockD', 'Dee');
    expect(joined.newHostId).toBeUndefined();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);

    vi.advanceTimersByTime(10_000);
    expect(onHostChange).toHaveBeenCalledExactlyOnceWith({
      roomCode: host.roomCode, previousHostId: host.playerId, newHostId: bob.playerId,
    });
  });

  it('inside the window nobody can act as host and the room cannot start', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guests: [bob] } = lobby(rm);
    rm.selectGame(host.roomCode, gameRules);
    rm.setPlayerReady(bob.playerId!, true);
    expect(rm.canStartGame(host.roomCode)).toBe(true);

    rm.handleDisconnect('sockA');
    expect(rm.isHost(host.roomCode, bob.playerId!)).toBe(false);
    expect(rm.canStartGame(host.roomCode)).toBe(false);
    expect(rm.startGame(host.roomCode)).toBeNull();
    expect(rm.transferHost(host.roomCode, bob.playerId!, bob.playerId!).success).toBe(false);
    expect(rm.transferHost(host.roomCode, host.playerId, bob.playerId!)).toEqual({
      success: false, error: 'Only the host can pass the host role on',
    });

    vi.advanceTimersByTime(10_000);
    expect(rm.isHost(host.roomCode, bob.playerId!)).toBe(true);
    // The old host's seat is still in grace, so the room still waits for it.
    expect(rm.canStartGame(host.roomCode)).toBe(false);
  });

  it('an in-game host keeps the role through the window too', () => {
    vi.useFakeTimers();
    const rm = new RoomManager(60_000);
    const { host, guest } = seatTwoInGame(rm);
    const onHostChange = vi.fn();
    rm.handleDisconnect('sockA', undefined, onHostChange);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(host.playerId);
    vi.advanceTimersByTime(10_000);
    expect(onHostChange).toHaveBeenCalledOnce();
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });
});
