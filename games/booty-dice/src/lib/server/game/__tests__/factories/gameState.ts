import type { GameState, PendingAction } from '$lib/types/game.js';
import { createTestPlayers } from './player.js';
import { createFreshDice, createTestDice } from './dice.js';

export function createTestGameState(overrides: Partial<GameState> = {}): GameState {
	return {
		roomCode: 'TEST01',
		phase: 'playing',
		players: createTestPlayers(3),
		currentPlayerIndex: 0,
		turnNumber: 1,
		rollsRemaining: 3,
		dice: createFreshDice(),
		turnPhase: 'rolling',
		pendingActions: [],
		gameLog: [],
		winnerId: null,
		...overrides
	};
}

export function createGameStateWithTargetSelection(
	targetActions: Array<{ face: 'cutlass' | 'jolly_roger'; targetId?: string }>
): GameState {
	const dice = createTestDice([
		'cutlass',
		'jolly_roger',
		'doubloon',
		'shield',
		'doubloon',
		'shield'
	]);
	const pendingActions: PendingAction[] = targetActions.map((action, index) => ({
		dieIndex: index,
		face: action.face,
		resolved: !!action.targetId,
		targetPlayerId: action.targetId
	}));

	return createTestGameState({
		dice,
		pendingActions,
		turnPhase: 'selecting_targets',
		rollsRemaining: 0
	});
}
