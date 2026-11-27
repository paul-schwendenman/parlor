export const ROOM_CODE_LENGTH = 4;

/** Longest player name the server accepts, in characters. Name inputs use it as their maxlength. */
export const PLAYER_NAME_MAX_LENGTH = 20;

/** Most bots a room can seat at once. The lobby disables Add bot at this count. */
export const MAX_BOTS = 4;

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface LobbyPlayer extends Player {
  isReady: boolean;
  isBot: boolean;
}

export interface SessionData {
  playerId: string;
  playerName: string;
  roomCode: string;
  reconnectToken?: string;
}

/** Result of a successful `lobby:create`. */
export interface CreateRoomResult {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}

/** Result of a `lobby:join` attempt. */
export interface JoinRoomResult {
  success: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  reconnectToken?: string;
}

export interface SocketData {
  playerId: string;
  playerName: string;
  roomCode: string;
}

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: string;
  tags: string[];
  displayModes: ('peer' | 'jackbox')[];
  supportsBots?: boolean;
}

/**
 * Stable public error codes for a rejected `game:action`.
 * - `RATE_LIMITED` is reserved for the boundary rate limiter (plan 3.3).
 * - `TIMEOUT` is produced client-side only, when no ack arrives.
 */
export type ActionErrorCode =
  | 'NOT_IN_ROOM'
  | 'NOT_A_PLAYER'
  | 'NO_ACTIVE_GAME'
  | 'INVALID_ACTION'
  | 'NOT_YOUR_TURN'
  | 'RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'TIMEOUT';

/** Ack payload for `game:action`. `message` is always safe to show to the user. */
export type ActionResult = { ok: true } | { ok: false; code: ActionErrorCode; message: string };

/**
 * View type each game sends over `game:state`, keyed by game id (plan 3.1b).
 * Empty here: each game adds its own entry by module augmentation, next to its
 * view type, so core never depends on a game package:
 *
 * ```ts
 * declare module '@parlor/game-types' {
 *   interface GameViewMap { 'crazy-eights': CrazyEightsPlayerView }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by module augmentation
export interface GameViewMap {}

/**
 * Action union each game's client sends over `game:action`, keyed by game id
 * (plan 3.5). Filled by module augmentation exactly like `GameViewMap`, and the
 * one source of truth for a game's actions: `defineGame` types its handlers and
 * `validateAction` from this entry, and a GameView's socket only accepts it.
 *
 * ```ts
 * declare module '@parlor/game-types' {
 *   interface GameActionMap { 'crazy-eights': CrazyEightsAction }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by module augmentation
export interface GameActionMap {}

/**
 * Every game id the wire knows about: the games that have added both a view
 * (`GameViewMap`) and an action union (`GameActionMap`). A game that augments
 * only one of the two is not a `GameId`, so `defineGame` rejects it.
 */
export type GameId = Extract<Extract<keyof GameViewMap, keyof GameActionMap>, string>;

/** The view game `K` sends over `game:state`. */
export type GameView<K extends GameId = GameId> = GameViewMap[K];

/**
 * An action game `K`'s client may send over `game:action` (the union over all
 * games by default). Every action carries a string `type`; an entry that does
 * not is filtered out here, so a game that registers one cannot handle,
 * validate or send it.
 */
export type GameAction<K extends GameId = GameId> = Extract<GameActionMap[K], { type: string }>;

/**
 * Payload of `game:state`: the view tagged with the game that produced it, so a
 * client can narrow `view` by `gameId` and never renders one game's view with
 * another game's component.
 */
export type GameStateEnvelope<K extends GameId = GameId> = {
  [P in K]: { gameId: P; view: GameViewMap[P] };
}[K];

export interface GameBallotSnapshot {
  roundId: string;
  totals: Partial<Record<string, number>>;
  /**
   * Every seated player's current vote, by player id. Rooms are private, so
   * the table sees who voted for what (the lobby draws voters on each game).
   */
  votes: Partial<Record<string, string>>;
  /** The recipient's own vote; always null for a spectator. */
  myVote: string | null;
  /**
   * The game the room had confirmed when the host reopened the ballot ("Change
   * game"), or null on a first ballot. It stays the room's game, and leads,
   * until the host plays another; `lobby:keepGame` restores it unchanged.
   */
  currentGameId: string | null;
}

/** Why the host role moved, sent with `lobby:hostChanged`. */
export type HostChangeReason = 'transfer' | 'handoff' | 'left';

export type ServerToClientEvents = {
  'room:closed': (roomCode: string) => void;
  'game:state': (state: GameStateEnvelope) => void;
  'error': (message: string) => void;

  'lobby:state': (players: LobbyPlayer[], canStart: boolean) => void;
  /**
   * Who holds the host role. `reason` is set only when the role just moved:
   * `transfer` (the host passed it on), `handoff` (the host has been
   * disconnected past the short grace, and may come back), `left` (the host
   * left the room or was removed). With no reason this is a sync (on join,
   * spectate or reconnect) and nothing changed for the room.
   */
  'lobby:hostChanged': (newHostId: string, reason?: HostChangeReason) => void;
  /** Player kept during the disconnect grace window (grey them out, do not remove). */
  'player:disconnected': (playerId: string) => void;
  /** Player rejoined within the grace window (un-grey them). */
  'player:reconnected': (playerId: string) => void;
  'lobby:gameStarting': () => void;
  'lobby:returned': (gameId: string | null) => void;
  'lobby:ballot': (roomCode: string, ballot: GameBallotSnapshot | null) => void;
  'lobby:gameSelected': (gameId: string | null) => void;
};

/** Client-to-server events other than `game:action`: identical on both ends of the wire. */
export type LobbyClientEvents = {
  /** Leave the room for good. */
  'room:leave': (callback?: (success: boolean, error?: string) => void) => void;
  'lobby:create': (
    playerName: string,
    callback: (result: CreateRoomResult | null, error?: string) => void,
    gameId?: string,
  ) => void;
  'lobby:vote': (roundId: string, gameId: string | null, callback: (success: boolean, error?: string) => void) => void;
  'lobby:confirmGame': (roundId: string, gameId: string, callback: (success: boolean, error?: string) => void) => void;
  'lobby:selectGame': (gameId: string | null, callback?: (success: boolean, error?: string) => void) => void;
  /** Host backs out of a reopened ballot: the current game, readiness and all, stays. */
  'lobby:keepGame': (roundId: string, callback: (success: boolean, error?: string) => void) => void;
  /**
   * Whether a room with this code exists, for a pasted `/lobby/CODE` link with
   * no session. Reveals nothing a join attempt by code wouldn't.
   */
  'lobby:roomExists': (roomCode: string, callback: (exists: boolean, error?: string, gameId?: string | null) => void) => void;
  'lobby:join': (
    roomCode: string,
    playerName: string,
    callback: (result: JoinRoomResult) => void,
  ) => void;
  /** Join a room as a spectator. */
  'lobby:spectate': (roomCode: string, callback: (success: boolean, error?: string) => void) => void;
  'lobby:ready': (isReady: boolean, callback?: (success: boolean, error?: string) => void) => void;
  'lobby:startGame': (callback?: (success: boolean, error?: string) => void) => void;
  'lobby:resetGame': () => void;
  'lobby:restartGame': () => void;
  'lobby:addBot': (callback: (success: boolean, error?: string) => void) => void;
  'lobby:removeBot': (botId: string, callback: (success: boolean, error?: string) => void) => void;
  /**
   * Host only, in the lobby: pass the host role to another connected, seated
   * human. On success the room receives `lobby:hostChanged`.
   */
  'lobby:transferHost': (playerId: string, callback: (success: boolean, error?: string) => void) => void;
  'player:reconnect': (
    roomCode: string,
    playerId: string,
    token: string,
    callback: (success: boolean, reconnectToken?: string) => void,
  ) => void;
};

/**
 * Client-to-server events as the **server** receives them. `game:action` is
 * untrusted wire data here: the core action boundary checks its envelope and
 * the game's `validateAction` turns it into a typed action.
 */
export type ClientToServerEvents = LobbyClientEvents & {
  'game:action': (action: Record<string, unknown>, ack?: (result: ActionResult) => void) => void;
};

/**
 * Client-to-server events as a client for game `K` **sends** them: `game:action`
 * only accepts that game's actions (`GameAction<K>`). The default (every game)
 * is what the multi-game parlor client uses; a GameView takes the socket for its
 * own game id, so sending another game's action does not compile.
 */
export type GameClientEvents<K extends GameId = GameId> = LobbyClientEvents & {
  'game:action': (action: GameAction<K>, ack?: (result: ActionResult) => void) => void;
};

export type InterServerEvents = {
  ping: () => void;
};
