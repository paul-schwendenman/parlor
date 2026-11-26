/**
 * Games not migrated to `defineGame` yet still emit bare views. The adapter must
 * put every one of them in a `{ gameId, view }` envelope on every path (lobby
 * callbacks, either `io` they are handed, and actions) and leave other events alone.
 */
import { describe, expect, it, vi } from 'vitest';
import type { LobbyPlayer } from '@parlor/game-types';
import { RoomManager } from './RoomManager.js';
import { withGameStateEnvelope, isTypedGameDefinition } from './legacyGameDefinition.js';
import { defineGame } from './defineGame.js';
import { createDispatchHarness } from './testing.js';
import type { AppServer, AppSocket, ServerGameDefinition } from './gameDefinition.js';

function makeIo() {
  const emitted: { to: string; event: string; args: unknown[] }[] = [];
  const io = {
    to: (to: string) => ({
      emit: (event: string, ...args: unknown[]) => {
        emitted.push({ to, event, args });
        return true;
      },
    }),
    marker: 'real-io',
  };
  return { io: io as never as AppServer, emitted };
}

const meta = {
  id: 'quixx',
  name: 'Legacy',
  description: 'test',
  minPlayers: 2,
  maxPlayers: 4,
  estimatedMinutes: '1',
  tags: [],
  displayModes: ['peer' as const],
};

/** A pre-3.1b definition: bare views through both the closure `io` and the parameter `io`. */
function legacyDefinition(): ServerGameDefinition {
  return {
    meta,
    createLobbyCallbacks: (rm, closureIo) => ({
      onGameStart: (roomCode: string, players: LobbyPlayer[], paramIo: AppServer) => {
        rm.setGameData(roomCode, {});
        paramIo.to(players[0].id).emit('game:state', { from: 'param' } as never);
        closureIo.to(roomCode).emit('game:state', { from: 'closure' } as never);
        closureIo.to(roomCode).emit('lobby:hostChanged', 'someone');
      },
      onPlayerRemoved: (_roomCode: string, playerId: string, paramIo: AppServer) => {
        paramIo.to(playerId).emit('game:state', { from: 'removed' } as never);
      },
    }),
    validateAction: (action) => ({ ok: true, action }),
    handleGameAction: (io, socket) => {
      io.to(socket.data.playerId).emit('game:state', { from: 'action' } as never);
    },
  };
}

describe('withGameStateEnvelope', () => {
  it('wraps bare views from lobby callbacks, through the closure io and the parameter io', () => {
    const { io, emitted } = makeIo();
    const callbacks = withGameStateEnvelope(legacyDefinition()).createLobbyCallbacks(new RoomManager(), io);
    const players = [{ id: 'p1', name: 'A', connected: true, isReady: true, isBot: false }];

    callbacks.onGameStart?.('ROOM', players, io);
    void callbacks.onPlayerRemoved?.('ROOM', 'p1', io);

    expect(emitted).toEqual([
      { to: 'p1', event: 'game:state', args: [{ gameId: 'quixx', view: { from: 'param' } }] },
      { to: 'ROOM', event: 'game:state', args: [{ gameId: 'quixx', view: { from: 'closure' } }] },
      // Other events pass through untouched.
      { to: 'ROOM', event: 'lobby:hostChanged', args: ['someone'] },
      { to: 'p1', event: 'game:state', args: [{ gameId: 'quixx', view: { from: 'removed' } }] },
    ]);
  });

  it('wraps bare views emitted while handling an action through the real boundary', async () => {
    const h = createDispatchHarness(withGameStateEnvelope(legacyDefinition()));
    const { io, emitted } = makeIo();
    const definition = withGameStateEnvelope(legacyDefinition());
    const socket = { data: { roomCode: h.roomCode, playerId: h.playerIds[0] } } as never as AppSocket;
    await definition.handleGameAction(io, socket, h.roomManager, { type: 'x' });
    expect(emitted).toEqual([
      { to: h.playerIds[0], event: 'game:state', args: [{ gameId: 'quixx', view: { from: 'action' } }] },
    ]);

    // Via the boundary too: the harness io records the envelope.
    expect(await h.send(h.playerIds[1], { type: 'x' })).toEqual({ ok: true });
    expect(h.emitted.at(-1)).toEqual({
      to: h.playerIds[1], event: 'game:state', payload: { gameId: 'quixx', view: { from: 'action' } },
    });
  });

  it('keeps everything else on the io working (non-emit members pass through)', () => {
    const { io } = makeIo();
    const seen = vi.fn();
    const definition = withGameStateEnvelope({
      ...legacyDefinition(),
      createLobbyCallbacks: (_rm, wrappedIo) => {
        seen(Reflect.get(wrappedIo, 'marker'));
        return {};
      },
    });
    definition.createLobbyCallbacks(new RoomManager(), io);
    expect(seen).toHaveBeenCalledWith('real-io');
  });

  it('returns typed definitions unchanged and refuses unknown loose ids', () => {
    const typed = defineGame({
      ...{ meta: { ...meta, id: 'kings-corner' as const } },
      validateAction: () => ({ ok: false, message: 'no' }),
      createState: () => ({}),
      actions: {},
      getPlayerView: () => null,
      getSpectatorView: () => null,
      isGameOver: () => false,
      onPlayerRemoved: () => undefined,
      onRoomDestroyed: () => undefined,
    });
    expect(isTypedGameDefinition(typed)).toBe(true);
    expect(withGameStateEnvelope(typed)).toBe(typed);

    expect(isTypedGameDefinition(legacyDefinition())).toBe(false);
    expect(() => withGameStateEnvelope({ ...legacyDefinition(), meta: { ...meta, id: 'mystery' } })).toThrow(
      /neither built with defineGame nor listed/,
    );
  });
});
