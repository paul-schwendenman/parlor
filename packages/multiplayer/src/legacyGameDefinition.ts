/**
 * Compatibility path for games that have not moved to `defineGame` yet (plan 3.1b).
 *
 * Their definitions still emit a bare view with `io.to(id).emit('game:state', view as never)`.
 * The wire now carries `{ gameId, view }`, so the core hands those definitions an
 * `io` that wraps each `game:state` payload in the envelope for their game id.
 * Every other event passes through untouched. Delete this file once all games
 * are migrated.
 */
import { isLegacyGameId, type LegacyGameId } from '@parlor/game-types';
import type { LobbyCallbacks } from './lobbyHandlers.js';
import type { AppServer, ServerGameDefinition } from './gameDefinition.js';

/** Wrap a broadcast operator so its `emit('game:state', view)` sends the envelope. */
function wrapOperator<T extends object>(operator: T, gameId: LegacyGameId): T {
  return new Proxy(operator, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (prop !== 'emit' || typeof value !== 'function') return value;
      return (event: string, ...args: unknown[]): unknown =>
        Reflect.apply(value, target, event === 'game:state' ? [event, { gameId, view: args[0] }] : [event, ...args]);
    },
  });
}

/** An `io` whose `to(...).emit('game:state', view)` sends `{ gameId, view }`. */
export function envelopeGameStateEmits(io: AppServer, gameId: LegacyGameId): AppServer {
  return new Proxy(io, {
    get(target, prop, receiver) {
      if (prop !== 'to') return Reflect.get(target, prop, receiver);
      return (room: string | string[]) => wrapOperator(target.to(room), gameId);
    },
  });
}

/** True for definitions built with `defineGame` (they emit envelopes themselves). */
export function isTypedGameDefinition(definition: ServerGameDefinition): boolean {
  return definition.typed !== undefined;
}

/**
 * Adapt a not-yet-migrated definition to the `{ gameId, view }` wire. Typed
 * definitions are returned unchanged. Throws for an unknown legacy id, so a
 * game cannot silently go out on the wire with the wrong tag.
 */
export function withGameStateEnvelope(definition: ServerGameDefinition): ServerGameDefinition {
  if (isTypedGameDefinition(definition)) return definition;
  const gameId = definition.meta.id;
  if (!isLegacyGameId(gameId)) {
    throw new Error(`Game ${gameId} is neither built with defineGame nor listed in LEGACY_GAME_IDS`);
  }

  const cache = new WeakMap<AppServer, AppServer>();
  const wrap = (io: AppServer): AppServer => {
    let wrapped = cache.get(io);
    if (!wrapped) {
      wrapped = envelopeGameStateEmits(io, gameId);
      cache.set(io, wrapped);
    }
    return wrapped;
  };

  return {
    ...definition,
    createLobbyCallbacks: (roomManager, io): LobbyCallbacks => {
      const callbacks = definition.createLobbyCallbacks(roomManager, wrap(io));
      return {
        onGameStart: callbacks.onGameStart && ((roomCode, players, cbIo) => callbacks.onGameStart?.(roomCode, players, wrap(cbIo))),
        onGameReset: callbacks.onGameReset && ((roomCode, cbIo) => callbacks.onGameReset?.(roomCode, wrap(cbIo))),
        onRoomDestroyed: callbacks.onRoomDestroyed && ((roomCode, cbIo) => callbacks.onRoomDestroyed?.(roomCode, wrap(cbIo))),
        onPlayerDisconnect: callbacks.onPlayerDisconnect
          && ((roomCode, playerId, cbIo) => callbacks.onPlayerDisconnect?.(roomCode, playerId, wrap(cbIo))),
        onPlayerReconnect: callbacks.onPlayerReconnect
          && ((roomCode, playerId, cbIo) => callbacks.onPlayerReconnect?.(roomCode, playerId, wrap(cbIo))),
        onPlayerRemoved: callbacks.onPlayerRemoved
          && ((roomCode, playerId, cbIo) => callbacks.onPlayerRemoved?.(roomCode, playerId, wrap(cbIo))),
      };
    },
    handleGameAction: (io, socket, roomManager, action) =>
      definition.handleGameAction(wrap(io), socket, roomManager, action),
  };
}
