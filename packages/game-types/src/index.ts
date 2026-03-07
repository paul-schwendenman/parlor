export interface Player {
  id: string;
  name: string;
  connected: boolean;
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

export type ServerToClientEvents = {
  'room:updated': (room: Room) => void;
  'game:state': (state: BaseGameState) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'chat:message': (message: ChatMessage) => void;
  'error': (message: string) => void;
};

export type ClientToServerEvents = {
  'room:create': (playerName: string, callback: (room: Room) => void) => void;
  'room:join': (code: string, playerName: string, callback: (room: Room | null, error?: string) => void) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:action': (action: Record<string, unknown>) => void;
  'chat:send': (text: string) => void;
};
