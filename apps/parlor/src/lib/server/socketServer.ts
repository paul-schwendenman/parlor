import { randomUUID } from 'node:crypto';
import type { LobbyPlayer } from '@parlor/game-types';
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
import type { AppServer, AppSocket, GameIo, GameRoom, LobbyCallbacks } from '@parlor/multiplayer';
import { registerAllGames } from './games/index.js';
import { getGameDefinition } from './gameRegistry.js';

interface Ballot {
	roundId: string;
	votes: Map<string, string>;
	/**
	 * The game the host had confirmed before reopening the ballot ("Change
	 * game"), or null on a first ballot. Readiness is left alone while the
	 * ballot is open, so keeping this game restores the room exactly.
	 */
	currentGameId: string | null;
}

export function setupParlorSocketHandlers(io: AppServer, roomManager = new RoomManager()): void {
	const callbackCache = new Map<string, LobbyCallbacks>();

	const ballots = new WeakMap<GameRoom, Ballot>();

	function openBallot(room: GameRoom, currentGameId: string | null = null): Ballot {
		const ballot = { roundId: randomUUID(), votes: new Map<string, string>(), currentGameId };
		ballots.set(room, ballot);
		return ballot;
	}

	function publishBallot(roomCode: string): void {
		const room = roomManager.getRoom(roomCode);
		if (!room) return;
		const ballot = room.gameId === null && room.status === 'waiting'
			? ballots.get(room) ?? openBallot(room)
			: undefined;
		if (!ballot) {
			io.to(roomCode).emit('lobby:ballot', roomCode, null);
			return;
		}

		const totals = new Map<string, number>();
		for (const [playerId, gameId] of ballot.votes) {
			if (!room.players.has(playerId)) {
				ballot.votes.delete(playerId);
				continue;
			}
			totals.set(gameId, (totals.get(gameId) ?? 0) + 1);
		}
		const counts = Object.fromEntries(totals);
		const votes = Object.fromEntries(ballot.votes);
		for (const socketId of io.sockets.adapter.rooms.get(roomCode) ?? []) {
			const playerId = roomManager.getPlayerIdBySocket(socketId);
			io.to(socketId).emit('lobby:ballot', roomCode, {
				roundId: ballot.roundId,
				totals: counts,
				votes,
				myVote: playerId ? ballot.votes.get(playerId) ?? null : null,
				currentGameId: ballot.currentGameId
			});
		}
	}

	function getCallbacksForGame(gameId: string): LobbyCallbacks | null {
		const cached = callbackCache.get(gameId);
		if (cached) return cached;

		const definition = getGameDefinition(gameId);
		if (!definition) return null;

		const callbacks = definition.createLobbyCallbacks(roomManager, io);
		callbackCache.set(gameId, callbacks);
		return callbacks;
	}

	// Register all game definitions
	registerAllGames();

	io.on('connection', (socket: AppSocket) => {
		// Create dynamic lobby callbacks that delegate to the correct game based on room's gameId
		const dynamicCallbacks: LobbyCallbacks = {
			onLobbyRosterChanged: publishBallot,
			onGameStart: (roomCode: string, players: LobbyPlayer[], io: GameIo) => {
				// Throw (rather than silently return) so the lobby rolls the start back.
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) throw new Error(`No game selected for room ${roomCode}`);
				const callbacks = getCallbacksForGame(gameId);
				if (!callbacks) throw new Error(`Unknown game ${gameId} for room ${roomCode}`);
				callbacks.onGameStart?.(roomCode, players, io);
			},

			onGameReset: (roomCode: string, io: GameIo) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId);
				callbacks?.onGameReset?.(roomCode, io);
			},

			onRoomDestroyed: (roomCode) => {
				const gameId = roomManager.getGameId(roomCode);
				if (gameId) getCallbacksForGame(gameId)?.onRoomDestroyed?.(roomCode, io);
			},

			onSpectatorJoin: (roomCode, socketId) => {
				const gameId = roomManager.getGameId(roomCode);
				if (gameId) getCallbacksForGame(gameId)?.onSpectatorJoin?.(roomCode, socketId);
			},

			onPlayerDisconnect: (roomCode: string, playerId: string, io: GameIo) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId);
				return callbacks?.onPlayerDisconnect?.(roomCode, playerId, io);
			},

			onPlayerReconnect: (roomCode: string, playerId: string, io: GameIo) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId);
				return callbacks?.onPlayerReconnect?.(roomCode, playerId, io);
			},

			onPlayerRemoved: (roomCode: string, playerId: string, io: GameIo) => {
				const gameId = roomManager.getGameId(roomCode);
				if (!gameId) return;
				const callbacks = getCallbacksForGame(gameId);
				return callbacks?.onPlayerRemoved?.(roomCode, playerId, io);
			}
		};

		// Set up lobby handlers with dynamic callbacks
		setupLobbyHandlers(io, socket, roomManager, dynamicCallbacks);

		function updateGameChoice(
			action: 'select' | 'confirm' | 'vote',
			gameId: unknown,
			callback: ((success: boolean, error?: string) => void) | undefined,
			roundId?: unknown
		): void {
			const ack = safeAck(callback);
			try {
				if (!allowSocketRequest(socket)) {
					ack(false, RATE_LIMIT_MESSAGE);
					return;
				}
				const { roomCode, playerId } = socket.data;
				if (!roomCode) {
					ack(false, 'Not in a room');
					return;
				}
				if (!roomManager.isSeatedPlayer(roomCode, playerId, socket.id)
					|| (action !== 'vote' && !roomManager.isHost(roomCode, playerId))) {
					ack(false, action === 'vote' ? 'Only seated players can vote' : 'Only the host can select the game');
					return;
				}
				const room = roomManager.getRoom(roomCode);
				if (!room || room.status !== 'waiting') {
					ack(false, 'Cannot change game after it has started');
					return;
				}
				const ballot = ballots.get(room);
				if (action !== 'select' && (!ballot || ballot.roundId !== roundId)) {
					ack(false, 'This vote has closed. Use the current lobby to vote again.');
					return;
				}
				if (gameId === null ? action === 'confirm' : typeof gameId !== 'string' || !gameId.trim()) {
					ack(false, 'Invalid game');
					return;
				}
				const definition = typeof gameId === 'string' ? getGameDefinition(gameId) : undefined;
				if (gameId !== null && !definition) {
					if (action === 'select') socket.emit('error', 'Unknown game');
					ack(false, 'Unknown game');
					return;
				}
				if (definition && room.players.size > definition.meta.maxPlayers) {
					ack(false, `This game supports up to ${definition.meta.maxPlayers} players`);
					return;
				}
				if (action === 'vote' && ballot) {
					if (typeof gameId === 'string') ballot.votes.set(playerId, gameId);
					else ballot.votes.delete(playerId);
					publishBallot(roomCode);
					ack(true);
					return;
				}

				// An already-open ballot is preserved if the request to open it is retried.
				const previousGameId = room.gameId;
				if (!roomManager.selectGame(roomCode, definition?.meta ?? null)) {
					ack(false, 'Could not select this game');
					return;
				}
				if (definition) {
					// Readiness was for the game before; a different game asks everyone again.
					if (gameId !== (ballot?.currentGameId ?? previousGameId)) roomManager.clearReadiness(roomCode);
					ballots.delete(room);
				} else if (previousGameId !== null) {
					// "Change game": the confirmed game stays current (and leads) until
					// the host plays another or keeps it.
					openBallot(room, previousGameId);
				}
				io.to(roomCode).emit('lobby:gameSelected', room.gameId);
				io.to(roomCode).emit('lobby:state', roomManager.getPlayersInRoom(roomCode), roomManager.canStartGame(roomCode));
				publishBallot(roomCode);
				ack(true);
			} catch (err) {
				ack(false, toPublicError(err, 'Could not update game choice', roomManager.getErrorContext(socket.data.roomCode, socket.data.playerId)).message);
			}
		}

		// The host backs out of a reopened ballot: the current game comes back
		// exactly as it was (readiness was never touched), and the ballot closes.
		function keepGame(roundId: unknown, callback: ((success: boolean, error?: string) => void) | undefined): void {
			const ack = safeAck(callback);
			try {
				if (!allowSocketRequest(socket)) {
					ack(false, RATE_LIMIT_MESSAGE);
					return;
				}
				const { roomCode, playerId } = socket.data;
				if (!roomCode) {
					ack(false, 'Not in a room');
					return;
				}
				if (!roomManager.isSeatedPlayer(roomCode, playerId, socket.id) || !roomManager.isHost(roomCode, playerId)) {
					ack(false, 'Only the host can keep the game');
					return;
				}
				const room = roomManager.getRoom(roomCode);
				if (!room || room.status !== 'waiting') {
					ack(false, 'Cannot change game after it has started');
					return;
				}
				const ballot = ballots.get(room);
				if (!ballot || ballot.roundId !== roundId) {
					ack(false, 'This vote has closed. Use the current lobby to vote again.');
					return;
				}
				const definition = ballot.currentGameId ? getGameDefinition(ballot.currentGameId) : undefined;
				if (!definition) {
					ack(false, 'There is no current game to keep. Vote on a game instead.');
					return;
				}
				const { name, maxPlayers } = definition.meta;
				if (room.players.size > maxPlayers || !roomManager.selectGame(roomCode, definition.meta)) {
					ack(false, `${name} seats ${maxPlayers}. Remove a bot or play another game.`);
					return;
				}
				ballots.delete(room);
				io.to(roomCode).emit('lobby:gameSelected', room.gameId);
				io.to(roomCode).emit('lobby:state', roomManager.getPlayersInRoom(roomCode), roomManager.canStartGame(roomCode));
				publishBallot(roomCode);
				ack(true);
			} catch (err) {
				ack(false, toPublicError(err, 'Could not keep the game', roomManager.getErrorContext(socket.data.roomCode, socket.data.playerId)).message);
			}
		}

		socket.on('lobby:selectGame', (gameId, callback) => updateGameChoice('select', gameId, callback));
		socket.on('lobby:keepGame', (roundId, callback) => keepGame(roundId, callback));
		socket.on('lobby:confirmGame', (roundId, gameId, callback) => updateGameChoice('confirm', gameId, callback, roundId));
		socket.on('lobby:vote', (roundId, gameId, callback) => updateGameChoice('vote', gameId, callback, roundId));

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
