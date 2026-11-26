import { browser } from '$app/environment';
import { createParlorRuntime, saveSession, loadSession, clearSession } from '@parlor/multiplayer/client';
import type { GameSocket } from '@parlor/multiplayer/client';
import { connectionState } from './connectionStore.svelte.js';
import { lobbyState } from './lobbyStore.svelte.js';
import { gameState } from './gameStore.svelte.js';
import { playerState } from './playerStore.svelte.js';

const runtime = createParlorRuntime({
	browser,
	connectionState,
	lobbyState,
	gameState,
	playerState,
	restorePlayerOnReconnect: true,
	enableGameSelection: true,
	onGameState: (state) => gameState.setState(state),
});

function clearRoomState(): void {
	clearSession();
	playerState.reset();
	lobbyState.reset();
	gameState.reset();
}

let boundSocket: GameSocket | undefined;

export function getSocket(): GameSocket {
	const socket = runtime.getSocket();
	if (socket !== boundSocket) {
		boundSocket = socket;
		socket.on('room:closed', (roomCode) => {
			if (playerState.roomCode === roomCode) clearRoomState();
		});
		socket.on('connect', () => {
			if (!playerState.roomCode || playerState.id) return;
			void spectateRoomAction(playerState.roomCode).catch(() => clearRoomState());
		});
	}
	return socket;
}

export async function spectateRoomAction(roomCode: string): Promise<void> {
	const code = roomCode.trim().toUpperCase();
	const socket = getSocket();
	await new Promise<void>((resolve, reject) => {
		socket.timeout(5000).emit('lobby:spectate', code, (timeout, success, message) => {
			if (timeout || !success) {
				reject(new Error(message ?? 'Could not watch this room. Check your connection and try again.'));
				return;
			}
			clearRoomState();
			playerState.set({ id: '', name: '', roomCode: code });
			resolve();
		});
	});
}

export async function leaveRoomAction(): Promise<void> {
	const socket = getSocket();
	if (!socket.connected) throw new Error('Reconnect before leaving the room.');
	await new Promise<void>((resolve, reject) => {
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			reject(new Error('Could not leave the room. Try again.'));
		}, 5000);
		socket.emit('room:leave', (success, message) => {
			if (timedOut) return;
			clearTimeout(timer);
			if (!success) {
				reject(new Error(message ?? 'Could not leave the room. Try again.'));
				return;
			}
			runtime.disconnectSocket();
			resolve();
		});
	});
}

export function createRoomAction(playerName: string, gameId?: string): Promise<string> {
	return runtime.createRoomAction(playerName, gameId);
}

export function joinRoomAction(
	roomCode: string,
	playerName: string,
): Promise<{ success: boolean; error?: string }> {
	return runtime.joinRoomAction(roomCode, playerName);
}

export function selectGameAction(gameId: string | null): void {
	runtime.selectGameAction(gameId);
}

export function readyAction(isReady: boolean): void {
	runtime.readyAction(isReady);
}

export function startGameAction(): void {
	runtime.startGameAction();
}

export function disconnectSocket(): void {
	runtime.disconnectSocket();
}

// Drop the socket on HMR so the module singleton doesn't leak a stale connection.
if (import.meta.hot) {
	import.meta.hot.dispose(() => runtime.teardown());
}

export { saveSession, loadSession, clearSession };
