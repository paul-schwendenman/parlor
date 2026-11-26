export {
  createGameServer,
  createSocketServer,
  type SocketServerInput,
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
export { type GameInstance } from './gameInstance.js';
export { abortableDelay, type GameScheduling } from './gameTimeout.js';
export { RoomManager, type GameRoom, type DisconnectResult } from './RoomManager.js';
export {
  setupLobbyHandlers,
  returnRoomToLobby,
  type LobbyCallbacks,
  type LobbyHandlerOptions,
} from './lobbyHandlers.js';
export { generateRoomCode } from './utils.js';
export { safeAck } from './ack.js';
export { type ServerGameDefinition, type AppSocket } from './gameDefinition.js';
export {
  GameRuleError,
  isGameRuleError,
  toPublicError,
  INTERNAL_ERROR_MESSAGE,
  type GameRuleErrorCode,
  type PublicError,
} from './errors.js';
export {
  type ActionValidation,
  invalid,
  valid,
  isRecord,
  hasExactKeys,
  isIntInRange,
  isOneOf,
  validateByType,
  typeOnly,
} from './actionValidation.js';
export {
  dispatchGameAction,
  validateActionEnvelope,
  ACTION_LIMITS,
  type DispatchGameActionOptions,
} from './actionBoundary.js';
export { appendGameLog, MAX_GAME_LOG_ENTRIES } from './gameLog.js';

export { allowSocketRequest, RATE_LIMIT_MESSAGE } from './rateLimit.js';
export { setupFatalProcessHandlers } from './processSafety.js';
