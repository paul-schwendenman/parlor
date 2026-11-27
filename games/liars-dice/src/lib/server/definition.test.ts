/**
 * CORE-AUDIT A-12 / D-02: the server's own 3 s auto-advance after a reveal used
 * to fire even after a player had already advanced with `nextRound`, cutting
 * a *later* round's reveal short. The timer is now bound to its round.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from '@parlor/multiplayer';
import { createActionSocket, createFakeIo } from '@parlor/multiplayer/testing';
import { liarsDiceDefinition } from './definition.js';
import type { LiarsDiceAction } from '../types/game.js';
import { AIPlayer } from './ai/AIPlayer.js';

const io = createFakeIo();

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
  const engine = liarsDiceDefinition.typed.getState(rm, roomCode)!;
  // Sync handler: a rule error throws straight out of `act`.
  const act = (playerId: string, action: LiarsDiceAction): void => {
    void liarsDiceDefinition.handleGameAction(
      io,
      createActionSocket(`socket-${playerId}`, { roomCode, playerId }),
      rm,
      action,
    );
  };
  const active = () => engine.getState().players[engine.getState().activePlayerIndex].id;
  return { rm, roomCode, engine, callbacks, act, active, a, b };
}

/**
 * A human ('a') and a bot. The server's own reveal timer is scheduled when the
 * bot challenges (a disconnected player no longer challenges since plan 3.9:
 * their stand-in only raises). The bot here acts at once: it opens, or
 * challenges any standing bid.
 */
function setupWithBot() {
  const botMode = { challenges: true };
  vi.spyOn(AIPlayer.prototype, 'takeTurn').mockImplementation((view, callbacks) => {
    if (!view.currentBid) callbacks.onBid(1, 2);
    else if (botMode.challenges) callbacks.onChallenge();
    else callbacks.onBid(view.currentBid.quantity + 1, view.currentBid.faceValue);
    return Promise.resolve();
  });
  const rm = new RoomManager();
  const { roomCode, playerId: a } = rm.createRoom('sa', 'A');
  rm.selectGame(roomCode, liarsDiceDefinition.meta);
  const bot = rm.addBot(roomCode, 'Bot').botId!;
  rm.setPlayerReady(a, true);
  const players = rm.startGame(roomCode)!;
  liarsDiceDefinition.createLobbyCallbacks(rm, io).onGameStart!(roomCode, players, io);
  const engine = liarsDiceDefinition.typed.getState(rm, roomCode)!;
  const act = (action: LiarsDiceAction): void => {
    void liarsDiceDefinition.handleGameAction(io, createActionSocket('sa', { roomCode, playerId: a }), rm, action);
  };
  const active = () => engine.getState().players[engine.getState().activePlayerIndex].id;
  /** Let a scheduled bot turn run (well short of the 3 s reveal timer). */
  const settle = () => vi.advanceTimersByTime(1);
  /** From the start of a round, play until its reveal: the bot challenges (scheduling the timer). */
  const botReveal = (): void => {
    botMode.challenges = true;
    settle(); // the bot opens if it starts
    if (active() === a) act({ type: 'bid', quantity: engine.getState().currentBid ? 30 : 1, faceValue: 2 });
    settle(); // the bot challenges
  };
  /** From the start of a round, play until its reveal: the player challenges (no timer). */
  const playerReveal = (): void => {
    botMode.challenges = false;
    settle(); // the bot opens if it starts
    if (!engine.getState().currentBid) {
      act({ type: 'bid', quantity: 1, faceValue: 2 });
      settle(); // the bot raises
    }
    act({ type: 'challenge' });
  };
  return { engine, act, active, botReveal, playerReveal, a, bot };
}

describe("Liar's Dice auto-advance timer", () => {
  it('does not cut a later reveal short after a player already advanced', () => {
    const t = setupWithBot();
    // Round 1: the bot challenges, which schedules the server's 3 s advance.
    t.botReveal();
    const round = t.engine.getState().round;
    const scheduledAt = Date.now();
    expect(t.engine.getState().phase).toBe('challenge');

    // The player advances early, and the next round reaches its own reveal.
    t.act({ type: 'nextRound' });
    expect(t.engine.getState().round).toBe(round + 1);
    t.playerReveal();
    expect(t.engine.getState().phase).toBe('challenge');

    // The stale timer from the earlier round fires: this round's reveal must survive.
    vi.advanceTimersByTime(scheduledAt + 3000 - Date.now());
    expect(t.engine.getState().round).toBe(round + 1);
    expect(t.engine.getState().phase).toBe('challenge');
  });

  it('still auto-advances when nobody pressed next round', () => {
    const t = setupWithBot();
    t.botReveal();
    const round = t.engine.getState().round;
    vi.advanceTimersByTime(3000);
    expect(t.engine.getState().round).toBe(round + 1);
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
