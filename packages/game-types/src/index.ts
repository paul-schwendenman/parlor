export const ROOM_CODE_LENGTH = 6;

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface LobbyPlayer extends Player {
  isReady: boolean;
  isBot: boolean;
}

export interface Room {
  id: string;
  code: string;
  host: string;
  players: Player[];
  maxPlayers: number;
  status: RoomStatus;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface BaseGameState {
  roomId: string;
  round: number;
  phase: string;
  players: Player[];
  startedAt: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  text: string;
  timestamp: number;
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

/** Every game id the wire knows about (the keys games have added to `GameViewMap`). */
export type GameId = Extract<keyof GameViewMap, string>;

/**
 * Payload of `game:state`: the view tagged with the game that produced it, so a
 * client can narrow `view` by `gameId` and never renders one game's view with
 * another game's component.
 */
export type GameStateEnvelope<K extends GameId = GameId> = {
  [P in K]: { gameId: P; view: GameViewMap[P] };
}[K];

export type ServerToClientEvents = {
  'room:updated': (room: Room) => void;
  'game:state': (state: GameStateEnvelope) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'chat:message': (message: ChatMessage) => void;
  'error': (message: string) => void;

  'lobby:state': (players: LobbyPlayer[], canStart: boolean) => void;
  'lobby:playerJoined': (player: LobbyPlayer) => void;
  'lobby:playerLeft': (playerId: string) => void;
  'lobby:hostChanged': (newHostId: string) => void;
  /** Player kept during the disconnect grace window (grey them out, do not remove). */
  'player:disconnected': (playerId: string) => void;
  /** Player rejoined within the grace window (un-grey them). */
  'player:reconnected': (playerId: string) => void;
  'lobby:gameStarting': () => void;
  'lobby:returned': (gameId: string | null) => void;
  'lobby:gameSelected': (gameId: string | null) => void;
};

export type ClientToServerEvents = {
  'room:create': (playerName: string, callback: (room: Room) => void) => void;
  'room:join': (code: string, playerName: string, callback: (room: Room | null, error?: string) => void) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:action': (action: Record<string, unknown>, ack?: (result: ActionResult) => void) => void;
  'chat:send': (text: string) => void;

  'lobby:create': (
    playerName: string,
    callback: (result: CreateRoomResult | null, error?: string) => void,
    gameId?: string,
  ) => void;
  'lobby:selectGame': (gameId: string | null, callback?: (success: boolean, error?: string) => void) => void;
  'lobby:join': (
    roomCode: string,
    playerName: string,
    callback: (result: JoinRoomResult) => void,
  ) => void;
  'lobby:spectate': (roomCode: string, callback: (success: boolean, error?: string) => void) => void;
  'lobby:ready': (isReady: boolean, callback?: (success: boolean, error?: string) => void) => void;
  'lobby:startGame': (callback?: (success: boolean, error?: string) => void) => void;
  'lobby:resetGame': () => void;
  'lobby:restartGame': () => void;
  'lobby:addBot': (callback: (success: boolean, error?: string) => void) => void;
  'lobby:removeBot': (botId: string, callback: (success: boolean, error?: string) => void) => void;
  'player:reconnect': (
    roomCode: string,
    playerId: string,
    token: string,
    callback: (success: boolean, reconnectToken?: string) => void,
  ) => void;
};

export type InterServerEvents = {
  ping: () => void;
};
