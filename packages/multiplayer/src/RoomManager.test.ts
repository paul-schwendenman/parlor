import { describe, expect, it } from 'vitest';
import { RoomManager } from './RoomManager.js';

function seatTwoInGame(rm: RoomManager) {
  const host = rm.createRoom('sockA', 'Ann');
  const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
  rm.setPlayerReady(host.playerId, true);
  rm.setPlayerReady(guest.playerId!, true);
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
    expect(ok).toBe(true);
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
    expect(ok).toBe(false);
    expect(rm.getPlayerIdBySocket('sockC')).toBeUndefined();
  });

  it('rejects reconnect for an unknown player', () => {
    const rm = new RoomManager();
    const { host } = seatTwoInGame(rm);
    const ok = rm.handleReconnect(host.roomCode, 'ghost-id', 'whatever', 'sockC');
    expect(ok).toBe(false);
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
    // Shrink the cap below the seated count.
    rm.setMaxPlayers(host.roomCode, 1);
    expect(rm.canStartGame(host.roomCode)).toBe(false);
    expect(rm.startGame(host.roomCode)).toBeNull();
  });
});

describe('RoomManager disconnect + leave', () => {
  it('reassigns host to another human on lobby disconnect', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');

    const result = rm.handleDisconnect('sockA');
    expect(result?.wasHost).toBe(true);
    expect(result?.playerId).toBe(host.playerId);
    expect(rm.getRoom(host.roomCode)?.hostId).toBe(guest.playerId);
  });

  it('keeps the seat on in-game disconnect', () => {
    const rm = new RoomManager();
    const { host, guest } = seatTwoInGame(rm);
    const result = rm.handleDisconnect('sockB');
    expect(result?.wasInGame).toBe(true);
    const players = rm.getPlayersInRoom(host.roomCode);
    expect(players.find((p) => p.id === guest.playerId)?.connected).toBe(false);
  });

  it('leaveRoom removes the player entirely', () => {
    const rm = new RoomManager();
    const host = rm.createRoom('sockA', 'Ann');
    const guest = rm.joinRoom(host.roomCode, 'sockB', 'Bob');
    const result = rm.leaveRoom('sockB');
    expect(result?.playerId).toBe(guest.playerId);
    const players = rm.getPlayersInRoom(host.roomCode);
    expect(players.map((p) => p.id)).not.toContain(guest.playerId);
    expect(rm.getPlayerIdBySocket('sockB')).toBeUndefined();
  });
});
