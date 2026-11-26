/**
 * CORE-AUDIT A-12 / D-02: the server's own 3 s auto-advance after a reveal used
 * to fire even after a player had already advanced with `nextRound`, cutting
 * a *later* round's reveal short. The timer is now bound to its round.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager, type AppServer } from '@parlor/multiplayer';
import { liarsDiceDefinition } from './definition.js';
import type { LiarsDiceEngine } from './game/LiarsDiceEngine.js';
import type { LiarsDiceAction } from '../types/game.js';

const io = { to: () => ({ emit: () => {} }) } as unknown as AppServer;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const rm = new RoomManager();
  const { roomCode, playerId: a } = rm.createRoom('sa', 'A');
  rm.selectGame(roomCode, liarsDiceDefinition.meta);
  const b = rm.joinRoom(roomCode, 'sb', 'B').playerId!;
  rm.setPlayerReady(a, true);
  rm.setPlayerReady(b, true);
  const players = rm.startGame(roomCode)!;
  const callbacks = liarsDiceDefinition.createLobbyCallbacks(rm, io);
  callbacks.onGameStart!(roomCode, players, io);
  const engine = rm.getGameData<LiarsDiceEngine>(roomCode)!;
  // Sync handler: a rule error throws straight out of `act`.
  const act = (playerId: string, action: LiarsDiceAction): void => {
    void liarsDiceDefinition.handleGameAction(
      io,
      { data: { roomCode, playerId }, emit: vi.fn() } as never,
      rm,
      action,
    );
  };
  const active = () => engine.getState().players[engine.getState().activePlayerIndex].id;
  return { rm, roomCode, engine, callbacks, act, active, a, b };
}

describe("Liar's Dice auto-advance timer", () => {
  it('does not cut a later reveal short after a player already advanced', () => {
    const t = setup();
    t.act(t.active(), { type: 'bid', quantity: 1, faceValue: 2 });
    // Active bidder drops → server auto-challenges and schedules the 3 s advance.
    void t.callbacks.onPlayerDisconnect!(t.roomCode, t.active(), io);
    expect(t.engine.getState().phase).toBe('challenge');
    expect(t.engine.getState().round).toBe(1);

    // A seated player advances early, and round 2 reaches its own reveal.
    t.act(t.a, { type: 'nextRound' });
    expect(t.engine.getState().round).toBe(2);
    t.act(t.active(), { type: 'bid', quantity: 1, faceValue: 2 });
    t.act(t.active(), { type: 'challenge' });
    expect(t.engine.getState().phase).toBe('challenge');

    // The stale round-1 timer fires: round 2's reveal must survive.
    vi.advanceTimersByTime(3000);
    expect(t.engine.getState().round).toBe(2);
    expect(t.engine.getState().phase).toBe('challenge');
  });

  it('still auto-advances when nobody pressed next round', () => {
    const t = setup();
    t.act(t.active(), { type: 'bid', quantity: 1, faceValue: 2 });
    void t.callbacks.onPlayerDisconnect!(t.roomCode, t.active(), io);
    vi.advanceTimersByTime(3000);
    expect(t.engine.getState().round).toBe(2);
    expect(t.engine.getState().phase).toBe('bidding');
  });

  it('nextRound outside the reveal throws a rule error and changes nothing', () => {
    const t = setup();
    const before = t.engine.getState();
    expect(() => t.act(t.a, { type: 'nextRound' })).toThrow('Cannot start next round from this phase');
    expect(t.engine.getState()).toEqual(before);
  });
});

it('marks the room finished when the last reveal ends the game', () => {
  const t = setup();
  const startingDice = t.engine.getState().players[0].diceCount;

  for (let round = 0; round < startingDice; round++) {
    t.act(t.active(), { type: 'bid', quantity: 30, faceValue: 2 });
    t.act(t.active(), { type: 'challenge' });
    if (round + 1 < startingDice) {
      expect(t.rm.getRoom(t.roomCode)?.status).toBe('playing');
      t.act(t.a, { type: 'nextRound' });
    }
  }

  expect(t.engine.getState().gameOver).toBe(true);
  expect(t.rm.getRoom(t.roomCode)?.status).toBe('finished');
});
