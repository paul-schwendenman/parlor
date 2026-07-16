import { browser } from '$app/environment';
import { createParlorRuntime, saveSession, loadSession, clearSession } from '@parlor/multiplayer/client';
import type { GameSocket } from '@parlor/multiplayer/client';
import { connectionState } from './connectionStore.svelte.js';
import { lobbyState } from './lobbyStore.svelte.js';
import { gameState } from './gameStore.svelte.js';
import { playerState } from './playerStore.svelte.js';
import type { BootyDicePlayerView } from '../types/game.js';

const runtime = createParlorRuntime({
  browser,
  connectionState,
  lobbyState,
  gameState,
  playerState,
  restorePlayerOnReconnect: true,
  onView: (state) => gameState.setView(state as unknown as BootyDicePlayerView),
});

export function getSocket(): GameSocket {
  return runtime.getSocket();
}

export function createRoomAction(playerName: string): Promise<string> {
  return runtime.createRoomAction(playerName);
}

export function joinRoomAction(
  roomCode: string,
  playerName: string,
): Promise<{ success: boolean; error?: string }> {
  return runtime.joinRoomAction(roomCode, playerName);
}

export function disconnectSocket(): void {
  runtime.disconnectSocket();
}

export { saveSession, loadSession, clearSession };
