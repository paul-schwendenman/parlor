export {
  createGameServer,
  type GameServerOptions,
  type AppServer,
  buildSocketServerOptions,
  type SocketServerOptionsInput,
  parseCorsOrigin,
  registerHealthCheck,
  setupGracefulShutdown,
  type GracefulShutdownOptions,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_RECOVERY_DURATION,
} from './server.js';
export {
  createGameClient,
  type GameClientOptions,
  type GameSocket,
  createRoom,
  joinRoom,
  saveSession,
  loadSession,
  clearSession,
} from './client.js';
export { RoomManager, type GameRoom, type DisconnectResult } from './RoomManager.js';
export {
  setupLobbyHandlers,
  type LobbyCallbacks,
  type LobbyHandlerOptions,
} from './lobbyHandlers.js';
export { generateRoomCode } from './utils.js';
export { type ServerGameDefinition } from './gameDefinition.js';
