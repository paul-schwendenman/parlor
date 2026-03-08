import { browser } from '$app/environment';
import { createGameClient, saveSession, loadSession, clearSession } from '@parlor/multiplayer/client';
import type { GameSocket } from '@parlor/multiplayer/client';
import { connectionState } from './connectionStore.svelte.js';
import { lobbyState } from './lobbyStore.svelte.js';
import { gameState } from './gameStore.svelte.js';
import { playerState } from './playerStore.svelte.js';

let socket: GameSocket | null = null;
let reconnectAttempted = false;

export function getSocket(): GameSocket {
	if (!browser) {
		throw new Error('Socket can only be used in browser');
	}

	if (!socket) {
		socket = createGameClient({ autoReconnect: true });

		socket.on('connect', () => {
			connectionState.setConnected();

			if (reconnectAttempted) return;
			reconnectAttempted = true;

			const session = loadSession();
			if (session && session.roomCode && session.playerId) {
				socket?.emit('player:reconnect', session.roomCode, session.playerId, (success) => {
					if (success) {
						playerState.set({
							id: socket!.id!,
							name: session.playerName!,
							roomCode: session.roomCode!,
						});
					} else {
						clearSession();
						playerState.reset();
					}
				});
			}
		});

		socket.on('disconnect', () => {
			connectionState.setDisconnected();
		});

		socket.on('connect_error', () => {
			connectionState.setError('Unable to connect to server');
		});

		socket.io.on('reconnect_attempt', () => {
			connectionState.setReconnecting();
		});

		socket.io.on('reconnect_failed', () => {
			connectionState.setError('Failed to reconnect to server');
		});

		// Lobby events
		socket.on('lobby:state', (players, canStart) => {
			if (gameState.view && lobbyState.gameStarting) {
				gameState.reset();
				lobbyState.gameStarting = false;
			}
			lobbyState.setLobbyState(players, canStart);
		});

		socket.on('lobby:hostChanged', (newHostId) => {
			lobbyState.setHost(newHostId);
		});

		socket.on('lobby:gameStarting', () => {
			lobbyState.setGameStarting();
		});

		// Game selection event
		socket.on('lobby:gameSelected', (gameId) => {
			lobbyState.setSelectedGame(gameId);
			gameState.setGameId(gameId);
		});

		// Game events - generic view (each game sends its own view shape)
		socket.on('game:state', (state) => {
			gameState.setView(state);
		});

		socket.on('error', (message) => {
			console.error('Server error:', message);
		});
	}

	return socket;
}

export function createRoomAction(playerName: string, gameId?: string): Promise<string> {
	const s = getSocket();
	return new Promise((resolve) => {
		s.emit('lobby:create', playerName, (roomCode) => {
			playerState.set({ id: s.id!, name: playerName, roomCode });
			lobbyState.setHost(s.id!);
			saveSession({ playerId: s.id!, playerName, roomCode });

			// If a game was pre-selected, select it
			if (gameId) {
				s.emit('lobby:selectGame', gameId);
				lobbyState.setSelectedGame(gameId);
				gameState.setGameId(gameId);
			}

			resolve(roomCode);
		});
	});
}

export function joinRoomAction(
	roomCode: string,
	playerName: string,
): Promise<{ success: boolean; error?: string }> {
	const s = getSocket();
	return new Promise((resolve) => {
		s.emit('lobby:join', roomCode, playerName, (success, error) => {
			if (success) {
				const normalizedCode = roomCode.toUpperCase();
				playerState.set({ id: s.id!, name: playerName, roomCode: normalizedCode });
				saveSession({ playerId: s.id!, playerName, roomCode: normalizedCode });
			}
			resolve({ success, error });
		});
	});
}

export function selectGameAction(gameId: string): void {
	const s = getSocket();
	s.emit('lobby:selectGame', gameId);
}

export function disconnectSocket(): void {
	if (socket) {
		socket.disconnect();
		socket = null;
		reconnectAttempted = false;
	}
	clearSession();
	playerState.reset();
	lobbyState.reset();
	gameState.reset();
}

export { saveSession, loadSession, clearSession };
