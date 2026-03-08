import { describe, it, expect, beforeEach } from 'vitest';
import { AIStrategy } from '../AIStrategy.js';
import { createTestGameState } from '../../game/__tests__/factories/gameState.js';
import { createTestDice } from '../../game/__tests__/factories/dice.js';
import { createTestPlayer, resetPlayerIdCounter } from '../../game/__tests__/factories/player.js';

describe('AIStrategy', () => {
	let strategy: AIStrategy;

	beforeEach(() => {
		strategy = new AIStrategy();
		resetPlayerIdCounter();
	});

	describe('decideDiceToKeep', () => {
		it('should keep good dice (doubloon, jolly_roger, shield, cutlass)', () => {
			const dice = createTestDice([
				'doubloon',
				'jolly_roger',
				'shield',
				'cutlass',
				'x_marks_spot',
				'walk_plank'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState({
				players: [self, createTestPlayer({ id: 'p2' })]
			});

			const keepIndices = strategy.decideDiceToKeep(dice, self, state);

			// Doubloon (8), jolly_roger (7), shield (5), cutlass (4) all >= 4
			expect(keepIndices).toContain(0); // doubloon
			expect(keepIndices).toContain(1); // jolly_roger
			expect(keepIndices).toContain(2); // shield
			expect(keepIndices).toContain(3); // cutlass
			expect(keepIndices).not.toContain(4); // x_marks_spot
			expect(keepIndices).not.toContain(5); // walk_plank
		});

		it('should keep walk_plank dice when close to mutiny and opponents have low lives', () => {
			const dice = createTestDice([
				'walk_plank',
				'walk_plank',
				'doubloon',
				'shield',
				'cutlass',
				'x_marks_spot'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const opponent = createTestPlayer({ id: 'p2', lives: 2 }); // low lives
			const state = createTestGameState({
				players: [self, opponent]
			});

			const keepIndices = strategy.decideDiceToKeep(dice, self, state);

			// Should keep walk_plank indices (0, 1) for mutiny strategy
			expect(keepIndices).toContain(0);
			expect(keepIndices).toContain(1);
		});

		it('should keep x_marks_spot dice when close to shipwreck and opponents have gold', () => {
			const dice = createTestDice([
				'x_marks_spot',
				'x_marks_spot',
				'doubloon',
				'shield',
				'cutlass',
				'walk_plank'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const opponent = createTestPlayer({ id: 'p2', doubloons: 20 });
			const state = createTestGameState({
				players: [self, opponent]
			});

			const keepIndices = strategy.decideDiceToKeep(dice, self, state);

			expect(keepIndices).toContain(0);
			expect(keepIndices).toContain(1);
		});

		it('should deduplicate indices', () => {
			const dice = createTestDice([
				'doubloon',
				'doubloon',
				'doubloon',
				'doubloon',
				'doubloon',
				'doubloon'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState({
				players: [self, createTestPlayer({ id: 'p2' })]
			});

			const keepIndices = strategy.decideDiceToKeep(dice, self, state);
			const unique = new Set(keepIndices);

			expect(keepIndices.length).toBe(unique.size);
		});
	});

	describe('shouldRollAgain', () => {
		it('should return false when no rolls remaining', () => {
			const dice = createTestDice([
				'x_marks_spot',
				'walk_plank',
				'x_marks_spot',
				'walk_plank',
				'x_marks_spot',
				'walk_plank'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState();

			expect(strategy.shouldRollAgain(dice, 0, self, state)).toBe(false);
		});

		it('should return true when there are 2+ negative unlocked dice', () => {
			const dice = createTestDice([
				'x_marks_spot',
				'walk_plank',
				'doubloon',
				'shield',
				'cutlass',
				'jolly_roger'
			]);
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState();

			expect(strategy.shouldRollAgain(dice, 2, self, state)).toBe(true);
		});

		it('should return false when locked dice value is high and few negatives', () => {
			const dice = createTestDice([
				'doubloon',
				'doubloon',
				'doubloon',
				'jolly_roger',
				'shield',
				'shield'
			]);
			// Lock the good dice (total locked value = 8+8+8+7+5 = 36 >= 20)
			dice[0].locked = true;
			dice[1].locked = true;
			dice[2].locked = true;
			dice[3].locked = true;
			dice[4].locked = true;
			// Only index 5 is unlocked, and it's positive
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState();

			expect(strategy.shouldRollAgain(dice, 1, self, state)).toBe(false);
		});
	});

	describe('selectTarget', () => {
		it('should return null when no other players alive', () => {
			const self = createTestPlayer({ id: 'ai-1' });
			const state = createTestGameState({
				players: [
					self,
					createTestPlayer({ id: 'p2', isEliminated: true }),
					createTestPlayer({ id: 'p3', isEliminated: true })
				]
			});

			expect(strategy.selectTarget('cutlass', self, state)).toBeNull();
		});

		it('should target vulnerable player with cutlass', () => {
			const self = createTestPlayer({ id: 'ai-1' });
			const vulnerable = createTestPlayer({ id: 'p2', lives: 1, shields: 0, doubloons: 3 });
			const healthy = createTestPlayer({ id: 'p3', lives: 10, shields: 2, doubloons: 20 });
			const state = createTestGameState({
				players: [self, vulnerable, healthy]
			});

			const target = strategy.selectTarget('cutlass', self, state);

			expect(target?.id).toBe('p2');
		});

		it('should target richest player with jolly_roger', () => {
			const self = createTestPlayer({ id: 'ai-1' });
			const poor = createTestPlayer({ id: 'p2', doubloons: 2 });
			const rich = createTestPlayer({ id: 'p3', doubloons: 20 });
			const state = createTestGameState({
				players: [self, poor, rich]
			});

			const target = strategy.selectTarget('jolly_roger', self, state);

			expect(target?.id).toBe('p3');
		});

		it('should not target self', () => {
			const self = createTestPlayer({ id: 'ai-1', doubloons: 100 });
			const other = createTestPlayer({ id: 'p2', doubloons: 5 });
			const state = createTestGameState({
				players: [self, other]
			});

			const target = strategy.selectTarget('jolly_roger', self, state);

			expect(target?.id).toBe('p2');
		});

		it('should not target eliminated players', () => {
			const self = createTestPlayer({ id: 'ai-1' });
			const eliminated = createTestPlayer({ id: 'p2', isEliminated: true, doubloons: 100 });
			const alive = createTestPlayer({ id: 'p3', doubloons: 5 });
			const state = createTestGameState({
				players: [self, eliminated, alive]
			});

			const target = strategy.selectTarget('jolly_roger', self, state);

			expect(target?.id).toBe('p3');
		});
	});
});
