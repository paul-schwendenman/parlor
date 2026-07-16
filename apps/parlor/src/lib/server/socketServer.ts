import type { Server, Socket } from 'socket.io';
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	LobbyPlayer
} from '@parlor/game-types';
import { RoomManager, setupLobbyHandlers } from '@parlor/multiplayer';
import type { LobbyCallbacks } from '@parlor/multiplayer';
import { registerAllGames } from './games/index.js';
import { getGameDefinition } from './gameRegistry.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const roomManager = new RoomManager();

// Cache callbacks per game definition so we don't recreate closures unnecessarily
const callbackCache = new Map<string, LobbyCallbacks>();

function getCallbacksForGame(gameId: string, io: AppServer): LobbyCallbacks | null {
	let cached = callbackCache.get(gameId);
	if (cached) return cached;

	const definition = getGameDefinition(gameId);
	if (!definition) return null;

	cached = definition.createLobbyCallbacks(roomManager, io);
	callbackCache.set(gameId, cached);
	return cached;
}

export function setupParlorSocketHandlers(io: AppServer): void {
	// Register all game definitions
	registerAllGames();

	io.on('connection', (socket: AppSocket) => {
		// Create dynamic lobby callbacks that delegate to the correct game based on room's gameId
		const dynamicCallbacks: LobbyCallbacks = {
			onGameStart: (roomCode: string, players: LobbyPlayer[], io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onGameStart?.(roomCode, players, io);
			},

			onGameReset: (roomCode: string, io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onGameReset?.(roomCode, io);
			},

			onPlayerDisconnect: (roomCode: string, playerId: string, io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onPlayerDisconnect?.(roomCode, playerId, io);
			},

			onPlayerReconnect: (roomCode: string, playerId: string, io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onPlayerReconnect?.(roomCode, playerId, io);
			},

			onPlayerRemoved: (roomCode: string, playerId: string, io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onPlayerRemoved?.(roomCode, playerId, io);
			}
		};

		// Set up lobby handlers with dynamic callbacks
		setupLobbyHandlers(io, socket, roomManager, dynamicCallbacks);

		// Handle game selection by host
		socket.on('lobby:selectGame', (gameId: string, callback) => {
			try {
				const roomCode = socket.data.roomCode;
				if (!roomCode) {
					callback?.(false, 'Not in a room');
					return;
				}
				if (!roomManager.isHost(roomCode, socket.data.playerId)) {
					callback?.(false, 'Only the host can select the game');
					return;
				}

				const room = roomManager.getRoom(roomCode);
				if (!room || room.status !== 'waiting') {
					callback?.(false, 'Cannot change game after it has started');
					return;
				}

				if (typeof gameId !== 'string' || !gameId.trim()) {
					callback?.(false, 'Invalid game');
					return;
				}

				const definition = getGameDefinition(gameId);
				if (!definition) {
					socket.emit('error', 'Unknown game');
					callback?.(false, 'Unknown game');
					return;
				}

				roomManager.setGameId(roomCode, gameId);
				roomManager.setMaxPlayers(roomCode, definition.meta.maxPlayers);
				io.to(roomCode).emit('lobby:gameSelected', gameId);
				callback?.(true);
			} catch (err) {
				callback?.(false, err instanceof Error ? err.message : 'Failed to select game');
			}
		});

		// Unified game:action handler - routes to correct game
		socket.on('game:action', (action) => {
			const roomCode = socket.data.roomCode;
			if (!roomCode) return;

			const gameId = roomManager.getGameId(roomCode);
			if (!gameId) return;

			const definition = getGameDefinition(gameId);
			if (!definition) return;

			definition.handleGameAction(io, socket, roomManager, action);
		});
	});
}
