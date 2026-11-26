/**
 * The typed game contract (plan 3.1b). A game describes its state, actions,
 * views and lifecycle hooks; `defineGame` turns that into the
 * `ServerGameDefinition` the core runs, and owns the plumbing every game used to
 * copy: state lookup, the action switch, view broadcasts and the reconnect view.
 */
import type { GameId, GameMeta, GameStateEnvelope, GameViewMap, LobbyPlayer } from '@parlor/game-types';
import { RoomManager, type GameRoom } from './RoomManager.js';
import type { GameInstance } from './gameInstance.js';
import type { ActionValidation } from './actionValidation.js';
import type { LobbyCallbacks } from './lobbyHandlers.js';
import type { AppServer, ServerGameDefinition } from './gameDefinition.js';

/** What a game's hooks and action handlers get to work with. */
export interface GameContext<State> {
  readonly roomCode: string;
  /** This game instance's state, as returned by `createState`. */
  readonly state: State;
  /**
   * This game instance's lifetime (plan 3.2): `schedule()` timers on it, and
   * check `isCurrent()` after every await before touching `state`.
   */
  readonly instance: GameInstance;
  readonly roomManager: RoomManager;
  /**
   * Send each participant its player view and each spectator the spectator
   * view. Does nothing once the instance is stale. The core already broadcasts
   * after every action and lifecycle hook; call this only for intermediate
   * states (for example between steps of a bot turn).
   */
  broadcast(): void;
}

/** Context for an action or a hook about one player. */
export interface PlayerContext<State> extends GameContext<State> {
  readonly playerId: string;
}

export interface RoomDestroyedContext<State> {
  readonly roomCode: string;
  /** The state of the game that was running when the room went away, if any. */
  readonly state: State | null;
}

/** Handler result: a handler may be async, but must follow the `GameContext.instance` rules. */
export type GameHandlerResult = void | Promise<void>;

/**
 * One handler per action type. Each receives only its own member of the union,
 * already sanitized by `validateAction`. A handler rejects by throwing
 * `GameRuleError` before it mutates anything; it never returns silently.
 */
export type GameActionHandlers<State, Action extends { type: string }> = {
  [T in Action['type']]: (game: PlayerContext<State>, action: Action & { type: T }) => GameHandlerResult;
};

/** The typed contract a game implements. `View` is fixed by the game's `GameViewMap` entry. */
export interface TypedGameDefinition<Id extends GameId, State extends object, Action extends { type: string }> {
  meta: GameMeta & { id: Id };
  /** Same contract as `ServerGameDefinition.validateAction` (plan 3.1a), now returning the typed `Action`. */
  validateAction: (action: Record<string, unknown>) => ActionValidation<Action>;
  /** Build a fresh game for the seated players. Throwing rolls the start back to the lobby. */
  createState: (roomCode: string, players: LobbyPlayer[]) => State;
  actions: GameActionHandlers<State, Action>;
  getPlayerView: (state: State, playerId: string) => GameViewMap[Id];
  /** What spectators and excluded seats receive. Must not reveal anything hidden from every player. */
  getSpectatorView: (state: State) => GameViewMap[Id];
  /** Checked on every broadcast; true marks the room `finished`. */
  isGameOver: (state: State) => boolean;
  /** A participant's socket dropped; they are in the reconnect grace window. Views are broadcast afterwards. */
  onPlayerDisconnect?: (game: PlayerContext<State>) => GameHandlerResult;
  /** A participant came back inside the grace window. They are sent their view afterwards. */
  onPlayerReconnect?: (game: PlayerContext<State>) => GameHandlerResult;
  /**
   * Required. A participant's grace window expired and their seat is gone for
   * good. The game must leave itself playable without them (as far as its rules
   * allow). Views are broadcast afterwards.
   */
  onPlayerRemoved: (game: PlayerContext<State>) => GameHandlerResult;
  /**
   * Required. The room is being deleted. The core has already invalidated the
   * game instance (timers cancelled, signal aborted), so this is only for
   * resources the game keeps outside it. Must not emit.
   */
  onRoomDestroyed: (ended: RoomDestroyedContext<State>) => void;
}

interface StateEntry<State> {
  instance: GameInstance;
  state: State;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/** Run `after` once `result` settles successfully (sync or async). Rejections pass through. */
function then(result: GameHandlerResult, after: () => void): GameHandlerResult {
  if (isPromiseLike(result)) return Promise.resolve(result).then(after);
  after();
}

export function defineGame<const Id extends GameId, State extends object, Action extends { type: string }>(
  definition: TypedGameDefinition<Id, State, Action>,
): ServerGameDefinition<State, Action, GameViewMap[Id]> {
  const { meta } = definition;
  // Keyed by room, checked against the room's current instance, so a stale
  // game's state is never found and nothing needs `getGameData<T>()`.
  const states = new WeakMap<GameRoom, StateEntry<State>>();

  function envelope(view: GameViewMap[Id]): GameStateEnvelope {
    // `meta.id` and `view` are both tied to `Id` by the signature. Note this
    // compiles inside this package only because every map entry visible here is
    // still a loose legacy one; once the last legacy id is gone it will need an
    // assertion (TypeScript cannot distribute a generic `Id` over the union).
    return { gameId: meta.id, view };
  }

  function current(roomManager: RoomManager, roomCode: string): StateEntry<State> | null {
    const room = roomManager.getRoom(roomCode);
    const entry = room && states.get(room);
    if (!room || !entry) return null;
    const instance = roomManager.getGameInstance(roomCode);
    if (instance !== entry.instance || !instance.isCurrent() || room.gameData !== entry.state) return null;
    return entry;
  }

  function broadcast(io: AppServer, roomManager: RoomManager, roomCode: string, entry: StateEntry<State>): void {
    if (current(roomManager, roomCode) !== entry) return;
    const { state } = entry;
    entry.instance.emitIfCurrent(() => {
      if (definition.isGameOver(state)) roomManager.finishGame(roomCode, state);
      for (const player of roomManager.getGamePlayers(roomCode)) {
        if (RoomManager.isBotPlayer(player.id)) continue;
        io.to(player.id).emit('game:state', envelope(definition.getPlayerView(state, player.id)));
      }
      const spectators = roomManager.getGameSpectators(roomCode);
      if (spectators.length > 0) {
        const spectatorView = envelope(definition.getSpectatorView(state));
        for (const spectatorId of spectators) io.to(spectatorId).emit('game:state', spectatorView);
      }
    });
  }

  function playerContext(
    io: AppServer,
    roomManager: RoomManager,
    roomCode: string,
    entry: StateEntry<State>,
    playerId: string,
  ): PlayerContext<State> {
    return {
      roomCode,
      playerId,
      state: entry.state,
      instance: entry.instance,
      roomManager,
      broadcast: () => broadcast(io, roomManager, roomCode, entry),
    };
  }

  function createLobbyCallbacks(roomManager: RoomManager, io: AppServer): LobbyCallbacks {
    /** Run a player hook against the current game, then broadcast. */
    const playerHook = (
      hook: ((game: PlayerContext<State>) => GameHandlerResult) | undefined,
      roomCode: string,
      playerId: string,
    ): GameHandlerResult => {
      const entry = current(roomManager, roomCode);
      if (!entry) return;
      const work = hook?.(playerContext(io, roomManager, roomCode, entry, playerId));
      return then(work, () => broadcast(io, roomManager, roomCode, entry));
    };

    return {
      onGameStart: (roomCode, players, startIo) => {
        const room = roomManager.getRoom(roomCode);
        const instance = roomManager.getGameInstance(roomCode);
        if (!room || !instance) throw new Error(`No game instance for room ${roomCode}`);
        const entry = { instance, state: definition.createState(roomCode, players) };
        states.set(room, entry);
        roomManager.setGameData(roomCode, entry.state);
        broadcast(startIo, roomManager, roomCode, entry);
      },

      onGameReset: (roomCode) => {
        const room = roomManager.getRoom(roomCode);
        if (room) states.delete(room);
      },

      onRoomDestroyed: (roomCode) => {
        const room = roomManager.getRoom(roomCode);
        const entry = room && states.get(room);
        if (room) states.delete(room);
        // The instance is already invalidated here, so `current()` cannot be used;
        // `gameData` still points at the state only if that game has not been reset.
        const running = entry && room.gameData === entry.state ? entry.state : null;
        definition.onRoomDestroyed({ roomCode, state: running });
      },

      onPlayerDisconnect: (roomCode, playerId) =>
        playerHook(definition.onPlayerDisconnect, roomCode, playerId),

      onPlayerRemoved: (roomCode, playerId) =>
        playerHook(definition.onPlayerRemoved, roomCode, playerId),

      onPlayerReconnect: (roomCode, playerId) => {
        const entry = current(roomManager, roomCode);
        if (!entry) return;
        const isParticipant = roomManager.isGameParticipant(roomCode, playerId);
        const work = isParticipant
          ? definition.onPlayerReconnect?.(playerContext(io, roomManager, roomCode, entry, playerId))
          : undefined;
        return then(work, () => {
          if (current(roomManager, roomCode) !== entry) return;
          const view = isParticipant
            ? definition.getPlayerView(entry.state, playerId)
            : definition.getSpectatorView(entry.state);
          entry.instance.emitIfCurrent(() => io.to(playerId).emit('game:state', envelope(view)));
        });
      },
    };
  }

  return {
    meta,
    createLobbyCallbacks,
    validateAction: definition.validateAction,
    handleGameAction(io, socket, roomManager, action) {
      const { roomCode, playerId } = socket.data;
      const entry = current(roomManager, roomCode);
      // The boundary has checked there is a running game, so this is a bug, not a user error.
      if (!entry) throw new Error(`No ${meta.id} game state for room ${roomCode}`);
      const type: Action['type'] = action.type;
      const handler = definition.actions[type];
      const work = handler(playerContext(io, roomManager, roomCode, entry, playerId), action);
      return then(work, () => broadcast(io, roomManager, roomCode, entry));
    },
    typed: {
      getState: (roomManager, roomCode) => current(roomManager, roomCode)?.state ?? null,
      getPlayerView: (state, playerId) => definition.getPlayerView(state, playerId),
      getSpectatorView: (state) => definition.getSpectatorView(state),
    },
  };
}
