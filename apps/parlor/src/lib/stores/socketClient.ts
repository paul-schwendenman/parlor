import type { RoomInvitePreview } from '@parlor/game-types';
import { browser } from '$app/environment';
import { createParlorRuntime, saveSession, loadSession, clearSession } from '@parlor/multiplayer/client';
import type { GameSocket } from '@parlor/multiplayer/client';
import { connectionState } from './connectionStore.svelte.js';
import { lobbyState } from './lobbyStore.svelte.js';
import { gameState } from './gameStore.svelte.js';
import { playerState } from './playerStore.svelte.js';
import { roomNotice } from './roomNotice.svelte.js';

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
	roomNotice.reset();
}

let boundSocket: GameSocket | undefined;

export function getSocket(): GameSocket {
	const socket = runtime.getSocket();
	if (socket !== boundSocket) {
		boundSocket = socket;
		socket.on('lobby:ballot', (roomCode, ballot) => {
			if (playerState.roomCode === roomCode) lobbyState.ballot = ballot;
		});
		// Host changes are announced room-wide (plan 9.3); the runtime keeps `hostId`.
		socket.on('lobby:state', (players) => {
			roomNotice.rememberPlayers(playerState.roomCode, lobbyState.hostId, players);
		});
		socket.on('lobby:hostChanged', (newHostId, reason) => {
			roomNotice.hostChanged(playerState.roomCode, playerState.id, newHostId, reason);
		});
		socket.on('lobby:gameKept', (roomCode, hostName, gameName) => {
			if (playerState.roomCode === roomCode && playerState.id !== lobbyState.hostId) {
				roomNotice.show(roomCode, `${hostName} kept ${gameName}.`);
			}
		});
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

export async function ballotAction(
	action: 'open' | 'vote' | 'confirm' | 'keep',
	gameId: string | null = null,
	roundId = '',
): Promise<void> {
	const socket = getSocket();
	if (!socket.connected) throw new Error('Reconnect to update your game choice.');
	await new Promise<void>((resolve, reject) => {
		const failure = 'Could not update your game choice. Try again.';
		const timer = setTimeout(() => reject(new Error(failure)), 5000);
		const ack = (ok: boolean, message?: string) => {
			clearTimeout(timer);
			if (ok) resolve();
			else reject(new Error(message ?? failure));
		};
		if (action === 'open') socket.emit('lobby:selectGame', null, ack);
		else if (action === 'vote') socket.emit('lobby:vote', roundId, gameId, ack);
		else if (action === 'keep') socket.emit('lobby:keepGame', roundId, ack);
		else if (gameId !== null) socket.emit('lobby:confirmGame', roundId, gameId, ack);
		else ack(false, 'Choose a game first.');
	});
}

/**
 * Host only: pass the host role to another player in the room. The new host
 * arrives for everyone (this client too) as `lobby:hostChanged`.
 */
export async function transferHostAction(playerId: string): Promise<void> {
	const socket = getSocket();
	if (!socket.connected) throw new Error('Reconnect to pass the host role on.');
	await new Promise<void>((resolve, reject) => {
		const failure = 'Could not pass the host role on. Try again.';
		const timer = setTimeout(() => reject(new Error(failure)), 5000);
		socket.emit('lobby:transferHost', playerId, (ok, message) => {
			clearTimeout(timer);
			if (ok) resolve();
			else reject(new Error(message ?? failure));
		});
	});
}

/**
 * Does a room with this code exist? `null` when we couldn't tell (offline,
 * timed out or rate limited), so a caller never mistakes that for "gone".
 */
export async function roomExistsAction(roomCode: string): Promise<boolean | null> {
	if (!getSocket().connected) return null;
	const result = await lookupRoomAction(roomCode);
	return result?.exists ?? null;
}

export function lookupRoomAction(roomCode: string): Promise<{ exists: boolean; gameId?: string | null; preview?: RoomInvitePreview } | null> {
	const socket = getSocket();
	return new Promise((resolve) => {
		socket.timeout(5000).emit('lobby:roomExists', roomCode.trim().toUpperCase(), (timeout, exists, error, gameId, preview) => {
			resolve(timeout || error ? null : { exists, gameId, preview });
		});
	});
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
