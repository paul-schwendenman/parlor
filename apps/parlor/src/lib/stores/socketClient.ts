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
	onView: (state) => gameState.setView(state),
});

export function getSocket(): GameSocket {
	return runtime.getSocket();
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
