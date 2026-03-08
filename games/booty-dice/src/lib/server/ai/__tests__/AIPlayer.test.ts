import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIPlayer } from '../AIPlayer.js';
import { createTestGameState } from '../../game/__tests__/factories/gameState.js';
import { createTestDice } from '../../game/__tests__/factories/dice.js';
import { createTestPlayer, resetPlayerIdCounter } from '../../game/__tests__/factories/player.js';

describe('AIPlayer', () => {
	let aiPlayer: AIPlayer;

	beforeEach(() => {
		vi.useFakeTimers();
		aiPlayer = new AIPlayer();
		resetPlayerIdCounter();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should perform mandatory first roll', async () => {
		const diceAfterRoll = createTestDice([
			'doubloon',
			'doubloon',
			'shield',
			'shield',
			'doubloon',
			'doubloon'
		]);
		const self = createTestPlayer({ id: 'ai-1', isAI: true });
		const state = createTestGameState({
			players: [self, createTestPlayer({ id: 'p2' })],
			currentPlayerIndex: 0,
			rollsRemaining: 3
		});

		const callbacks = {
			onLockDice: vi.fn(),
			onRoll: vi.fn().mockResolvedValue(diceAfterRoll),
			onFinishRolling: vi.fn(),
			onSelectTarget: vi.fn(),
			onEndTurn: vi.fn()
		};

		const turnPromise = aiPlayer.takeTurn(state, callbacks);

		// Advance through all timers
		await vi.runAllTimersAsync();
		await turnPromise;

		// First roll is always called
		expect(callbacks.onRoll).toHaveBeenCalled();
		expect(callbacks.onFinishRolling).toHaveBeenCalledOnce();
		expect(callbacks.onEndTurn).toHaveBeenCalledOnce();
	});

	it('should select targets for cutlass and jolly_roger dice', async () => {
		const diceAfterRoll = createTestDice([
			'cutlass',
			'jolly_roger',
			'doubloon',
			'shield',
			'doubloon',
			'shield'
		]);
		const self = createTestPlayer({ id: 'ai-1', isAI: true });
		const opponent = createTestPlayer({ id: 'p2', doubloons: 10 });
		const state = createTestGameState({
			players: [self, opponent],
			currentPlayerIndex: 0,
			rollsRemaining: 3
		});

		const callbacks = {
			onLockDice: vi.fn(),
			onRoll: vi.fn().mockResolvedValue(diceAfterRoll),
			onFinishRolling: vi.fn(),
			onSelectTarget: vi.fn(),
			onEndTurn: vi.fn()
		};

		const turnPromise = aiPlayer.takeTurn(state, callbacks);
		await vi.runAllTimersAsync();
		await turnPromise;

		// Should have selected targets for cutlass (index 0) and jolly_roger (index 1)
		expect(callbacks.onSelectTarget).toHaveBeenCalledWith(0, 'p2');
		expect(callbacks.onSelectTarget).toHaveBeenCalledWith(1, 'p2');
	});

	it('should not select targets when no cutlass or jolly_roger dice', async () => {
		const diceAfterRoll = createTestDice([
			'doubloon',
			'doubloon',
			'shield',
			'shield',
			'doubloon',
			'shield'
		]);
		const self = createTestPlayer({ id: 'ai-1', isAI: true });
		const state = createTestGameState({
			players: [self, createTestPlayer({ id: 'p2' })],
			currentPlayerIndex: 0,
			rollsRemaining: 3
		});

		const callbacks = {
			onLockDice: vi.fn(),
			onRoll: vi.fn().mockResolvedValue(diceAfterRoll),
			onFinishRolling: vi.fn(),
			onSelectTarget: vi.fn(),
			onEndTurn: vi.fn()
		};

		const turnPromise = aiPlayer.takeTurn(state, callbacks);
		await vi.runAllTimersAsync();
		await turnPromise;

		expect(callbacks.onSelectTarget).not.toHaveBeenCalled();
	});

	it('should call onLockDice before subsequent rolls', async () => {
		// First roll returns bad dice so AI wants to roll again
		const badDice = createTestDice([
			'x_marks_spot',
			'walk_plank',
			'x_marks_spot',
			'walk_plank',
			'doubloon',
			'shield'
		]);
		// Second roll returns good dice
		const goodDice = createTestDice([
			'doubloon',
			'doubloon',
			'doubloon',
			'doubloon',
			'doubloon',
			'shield'
		]);
		const self = createTestPlayer({ id: 'ai-1', isAI: true });
		const state = createTestGameState({
			players: [self, createTestPlayer({ id: 'p2' })],
			currentPlayerIndex: 0,
			rollsRemaining: 3
		});

		const callbacks = {
			onLockDice: vi.fn(),
			onRoll: vi.fn().mockResolvedValueOnce(badDice).mockResolvedValueOnce(goodDice),
			onFinishRolling: vi.fn(),
			onSelectTarget: vi.fn(),
			onEndTurn: vi.fn()
		};

		const turnPromise = aiPlayer.takeTurn(state, callbacks);
		await vi.runAllTimersAsync();
		await turnPromise;

		// onLockDice should have been called at least once for deciding which dice to keep
		expect(callbacks.onLockDice).toHaveBeenCalled();
		// Should have rolled at least twice (mandatory first + at least one more)
		expect(callbacks.onRoll).toHaveBeenCalledTimes(2);
	});
});
