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

export type ServerToClientEvents = {
  'room:updated': (room: Room) => void;
  'game:state': (state: BaseGameState) => void;
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
  'lobby:gameSelected': (gameId: string | null) => void;
};

export type ClientToServerEvents = {
  'room:create': (playerName: string, callback: (room: Room) => void) => void;
  'room:join': (code: string, playerName: string, callback: (room: Room | null, error?: string) => void) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:action': (action: Record<string, unknown>) => void;
  'chat:send': (text: string) => void;

  'lobby:create': (
    playerName: string,
    callback: (result: CreateRoomResult) => void,
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
    callback: (success: boolean) => void,
  ) => void;
};

export type InterServerEvents = {
  ping: () => void;
};
