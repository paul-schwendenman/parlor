import { describe, it, expect, beforeEach } from 'vitest';
import { DiceRoller } from '../DiceRoller.js';
import {
	createTestDice,
	createBlackbeardsCurseDice,
	createMutinyDice,
	createShipwreckDice
} from './factories/dice.js';

describe('DiceRoller', () => {
	let roller: DiceRoller;

	beforeEach(() => {
		roller = new DiceRoller();
	});

	describe('createFreshDice', () => {
		it('should create 6 dice with doubloon faces', () => {
			const dice = roller.createFreshDice();

			expect(dice).toHaveLength(6);
			dice.forEach((die, index) => {
				expect(die.id).toBe(index);
				expect(die.face).toBe('doubloon');
				expect(die.locked).toBe(false);
				expect(die.rolling).toBe(false);
			});
		});
	});

	describe('roll', () => {
		it('should not change locked dice', () => {
			const dice = createTestDice([
				'doubloon',
				'shield',
				'cutlass',
				'walk_plank',
				'x_marks_spot',
				'jolly_roger'
			]);
			dice[0].locked = true;
			dice[2].locked = true;

			const result = roller.roll(dice);

			expect(result.dice[0].face).toBe('doubloon');
			expect(result.dice[2].face).toBe('cutlass');
		});

		it('should roll unlocked dice to valid faces', () => {
			const dice = roller.createFreshDice();
			const result = roller.roll(dice);

			const validFaces = [
				'doubloon',
				'x_marks_spot',
				'jolly_roger',
				'cutlass',
				'walk_plank',
				'shield'
			];

			result.dice.forEach((die) => {
				expect(validFaces).toContain(die.face);
			});
		});

		it('should set rolling to false after roll', () => {
			const dice = roller.createFreshDice();
			const result = roller.roll(dice);

			result.dice.forEach((die) => {
				expect(die.rolling).toBe(false);
			});
		});

		it('should preserve die ids', () => {
			const dice = roller.createFreshDice();
			const result = roller.roll(dice);

			result.dice.forEach((die, index) => {
				expect(die.id).toBe(index);
			});
		});
	});

	describe('combo detection', () => {
		describe("Blackbeard's Curse", () => {
			it('should detect when all 6 faces are different', () => {
				const dice = createBlackbeardsCurseDice();
				// Lock all dice so roll doesn't change them
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('blackbeards_curse');
				expect(result.bonusCount).toBe(0);
			});

			it('should not detect with duplicate faces', () => {
				const dice = createTestDice([
					'doubloon',
					'doubloon',
					'shield',
					'cutlass',
					'walk_plank',
					'x_marks_spot'
				]);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).not.toBe('blackbeards_curse');
			});
		});

		describe('Mutiny', () => {
			it('should detect with exactly 3 walk_plank', () => {
				const dice = createMutinyDice(0);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('mutiny');
				expect(result.bonusCount).toBe(0);
			});

			it('should detect with 4 walk_plank and report bonus of 1', () => {
				const dice = createMutinyDice(1);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('mutiny');
				expect(result.bonusCount).toBe(1);
			});

			it('should detect with 5 walk_plank and report bonus of 2', () => {
				const dice = createMutinyDice(2);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('mutiny');
				expect(result.bonusCount).toBe(2);
			});

			it('should not detect with only 2 walk_plank', () => {
				const dice = createTestDice([
					'walk_plank',
					'walk_plank',
					'doubloon',
					'shield',
					'cutlass',
					'x_marks_spot'
				]);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).not.toBe('mutiny');
			});
		});

		describe('Shipwreck', () => {
			it('should detect with exactly 3 x_marks_spot', () => {
				const dice = createShipwreckDice(0);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('shipwreck');
				expect(result.bonusCount).toBe(0);
			});

			it('should detect with 4 x_marks_spot and report bonus of 1', () => {
				const dice = createShipwreckDice(1);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('shipwreck');
				expect(result.bonusCount).toBe(1);
			});

			it('should not detect with only 2 x_marks_spot', () => {
				const dice = createTestDice([
					'x_marks_spot',
					'x_marks_spot',
					'doubloon',
					'shield',
					'cutlass',
					'walk_plank'
				]);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).not.toBe('shipwreck');
			});
		});

		describe('combo priority', () => {
			it('should prioritize blackbeards_curse over other combos', () => {
				// Blackbeard's curse requires all unique, so it can't overlap with mutiny/shipwreck
				const dice = createBlackbeardsCurseDice();
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBe('blackbeards_curse');
			});
		});

		describe('no combo', () => {
			it('should return null combo when no combo detected', () => {
				const dice = createTestDice([
					'doubloon',
					'doubloon',
					'shield',
					'shield',
					'cutlass',
					'jolly_roger'
				]);
				dice.forEach((d) => (d.locked = true));

				const result = roller.roll(dice);

				expect(result.combo).toBeNull();
				expect(result.bonusCount).toBe(0);
			});
		});
	});
});
