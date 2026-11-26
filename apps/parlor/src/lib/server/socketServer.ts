import type { Server, Socket } from 'socket.io';
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	LobbyPlayer
} from '@parlor/game-types';
import {
	RoomManager,
	dispatchGameAction,
	allowSocketRequest,
	RATE_LIMIT_MESSAGE,
	returnRoomToLobby,
	safeAck,
	setupLobbyHandlers,
	toPublicError
} from '@parlor/multiplayer';
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
				// Throw (rather than silently return) so the lobby rolls the start back.
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) throw new Error(`No game selected for room ${roomCode}`);
				const callbacks = getCallbacksForGame(gameId, io);
				if (!callbacks) throw new Error(`Unknown game ${gameId} for room ${roomCode}`);
				callbacks.onGameStart?.(roomCode, players, io);
			},

			onGameReset: (roomCode: string, io: AppServer) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId, io);
				callbacks?.onGameReset?.(roomCode, io);
			},

			onRoomDestroyed: (roomCode, io) => {
				const gameId = roomManager.getGameId(roomCode);
				if (gameId) getCallbacksForGame(gameId, io)?.onRoomDestroyed?.(roomCode, io);
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
		socket.on('lobby:selectGame', (gameId: string | null, callback) => {
			const ack = safeAck(callback);
			try {
				if (!allowSocketRequest(socket)) {
					ack(false, RATE_LIMIT_MESSAGE);
					return;
				}
				const roomCode = socket.data.roomCode;
				if (!roomCode) {
					ack(false, 'Not in a room');
					return;
				}
				if (!roomManager.isHost(roomCode, socket.data.playerId)
					|| !roomManager.isSeatedPlayer(roomCode, socket.data.playerId, socket.id)) {
					ack(false, 'Only the host can select the game');
					return;
				}

				const room = roomManager.getRoom(roomCode);
				if (!room || room.status !== 'waiting') {
					ack(false, 'Cannot change game after it has started');
					return;
				}

				// null clears the current selection (host pressed "Change").
				if (gameId === null) {
					roomManager.selectGame(roomCode, null);
					io.to(roomCode).emit('lobby:gameSelected', null);
					io.to(roomCode).emit('lobby:state', roomManager.getPlayersInRoom(roomCode), false);
					ack(true);
					return;
				}

				if (typeof gameId !== 'string' || !gameId.trim()) {
					ack(false, 'Invalid game');
					return;
				}

				const definition = getGameDefinition(gameId);
				if (!definition) {
					socket.emit('error', 'Unknown game');
					ack(false, 'Unknown game');
					return;
				}

				if (!roomManager.selectGame(roomCode, definition.meta)) {
					ack(false, `This game supports up to ${definition.meta.maxPlayers} players`);
					return;
				}
				io.to(roomCode).emit('lobby:gameSelected', gameId);
				io.to(roomCode).emit('lobby:state', roomManager.getPlayersInRoom(roomCode), roomManager.canStartGame(roomCode));
				ack(true);
			} catch (err) {
				ack(false, toPublicError(err, 'Failed to select game', { roomCode: socket.data.roomCode }).message);
			}
		});

		// Unified game:action handler: the core boundary validates, checks
		// membership, and routes to the room's game.
		socket.on('game:action', (action, ack) => {
			const roomCode = socket.data.roomCode;
			const gameId = roomCode ? roomManager.getGameId(roomCode) : null;
			void dispatchGameAction({
				io,
				socket,
				roomManager,
				definition: gameId ? getGameDefinition(gameId) : undefined,
				action,
				ack,
				onRoomFailure: (code) => returnRoomToLobby(io, roomManager, code, dynamicCallbacks)
			});
		});
	});
}
