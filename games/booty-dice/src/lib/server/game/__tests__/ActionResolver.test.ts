import { describe, it, expect, beforeEach } from 'vitest';
import { ActionResolver } from '../ActionResolver.js';
import {
	createTestPlayer,
	createTestPlayers,
	resetPlayerIdCounter
} from './factories/player.js';
import {
	createTestDice,
	createBlackbeardsCurseDice,
	createMutinyDice,
	createShipwreckDice
} from './factories/dice.js';
import type { PendingAction } from '$lib/types/game.js';

describe('ActionResolver', () => {
	let resolver: ActionResolver;

	beforeEach(() => {
		resolver = new ActionResolver();
		resetPlayerIdCounter();
	});

	describe('individual dice effects', () => {
		it('should give +2 doubloons for each doubloon die', () => {
			const currentPlayer = createTestPlayer();
			const dice = createTestDice(['doubloon', 'doubloon', 'shield', 'shield', 'shield', 'shield']);

			const effects = resolver.resolve(dice, [], currentPlayer, [currentPlayer]);

			const coinEffects = effects.filter(
				(e) => e.type === 'coins_gained' && e.targetId === currentPlayer.id
			);
			expect(coinEffects).toHaveLength(2);
			expect(coinEffects.every((e) => e.amount === 2)).toBe(true);
		});

		it('should deduct 2 doubloons for each x_marks_spot', () => {
			const currentPlayer = createTestPlayer();
			const dice = createTestDice([
				'x_marks_spot',
				'x_marks_spot',
				'shield',
				'shield',
				'shield',
				'shield'
			]);

			const effects = resolver.resolve(dice, [], currentPlayer, [currentPlayer]);

			const lossEffects = effects.filter(
				(e) => e.type === 'coins_lost' && e.targetId === currentPlayer.id
			);
			expect(lossEffects).toHaveLength(2);
			expect(lossEffects.every((e) => e.amount === 2)).toBe(true);
		});

		it('should cause 1 life lost for each walk_plank', () => {
			const currentPlayer = createTestPlayer();
			const dice = createTestDice([
				'walk_plank',
				'walk_plank',
				'shield',
				'shield',
				'shield',
				'shield'
			]);

			const effects = resolver.resolve(dice, [], currentPlayer, [currentPlayer]);

			const lifeEffects = effects.filter(
				(e) => e.type === 'life_lost' && e.targetId === currentPlayer.id
			);
			expect(lifeEffects).toHaveLength(2);
			expect(lifeEffects.every((e) => e.amount === 1)).toBe(true);
		});

		it('should give +1 shield for each shield die', () => {
			const currentPlayer = createTestPlayer();
			const dice = createTestDice([
				'shield',
				'shield',
				'doubloon',
				'doubloon',
				'doubloon',
				'doubloon'
			]);

			const effects = resolver.resolve(dice, [], currentPlayer, [currentPlayer]);

			const shieldEffects = effects.filter(
				(e) => e.type === 'shield_gained' && e.targetId === currentPlayer.id
			);
			expect(shieldEffects).toHaveLength(2);
			expect(shieldEffects.every((e) => e.amount === 1)).toBe(true);
		});
	});

	describe('targeted actions', () => {
		it('should deal 1 damage with cutlass to selected target', () => {
			const players = createTestPlayers(2);
			const [currentPlayer, target] = players;
			const dice = createTestDice(['cutlass', 'shield', 'shield', 'shield', 'shield', 'shield']);

			const pendingActions: PendingAction[] = [
				{
					dieIndex: 0,
					face: 'cutlass',
					resolved: true,
					targetPlayerId: target.id
				}
			];

			const effects = resolver.resolve(dice, pendingActions, currentPlayer, players);

			const damageEffects = effects.filter((e) => e.type === 'damage' && e.targetId === target.id);
			expect(damageEffects).toHaveLength(1);
			expect(damageEffects[0].amount).toBe(1);
			expect(damageEffects[0].sourceId).toBe(currentPlayer.id);
		});

		it('should steal up to 2 doubloons with jolly_roger', () => {
			const players = createTestPlayers(2);
			const [currentPlayer, target] = players;
			target.doubloons = 5;

			const dice = createTestDice([
				'jolly_roger',
				'shield',
				'shield',
				'shield',
				'shield',
				'shield'
			]);

			const pendingActions: PendingAction[] = [
				{
					dieIndex: 0,
					face: 'jolly_roger',
					resolved: true,
					targetPlayerId: target.id
				}
			];

			const effects = resolver.resolve(dice, pendingActions, currentPlayer, players);

			const stealLoss = effects.find((e) => e.type === 'coins_lost' && e.targetId === target.id);
			const stealGain = effects.find(
				(e) => e.type === 'coins_gained' && e.targetId === currentPlayer.id
			);

			expect(stealLoss).toBeDefined();
			expect(stealLoss!.amount).toBe(2);
			expect(stealGain).toBeDefined();
			expect(stealGain!.amount).toBe(2);
		});

		it('should steal only available doubloons if target has less than 2', () => {
			const players = createTestPlayers(2);
			const [currentPlayer, target] = players;
			target.doubloons = 1;

			const dice = createTestDice([
				'jolly_roger',
				'shield',
				'shield',
				'shield',
				'shield',
				'shield'
			]);

			const pendingActions: PendingAction[] = [
				{
					dieIndex: 0,
					face: 'jolly_roger',
					resolved: true,
					targetPlayerId: target.id
				}
			];

			const effects = resolver.resolve(dice, pendingActions, currentPlayer, players);

			const stealLoss = effects.find((e) => e.type === 'coins_lost' && e.targetId === target.id);

			expect(stealLoss!.amount).toBe(1);
		});

		it('should not steal if target has 0 doubloons', () => {
			const players = createTestPlayers(2);
			const [currentPlayer, target] = players;
			target.doubloons = 0;

			const dice = createTestDice([
				'jolly_roger',
				'shield',
				'shield',
				'shield',
				'shield',
				'shield'
			]);

			const pendingActions: PendingAction[] = [
				{
					dieIndex: 0,
					face: 'jolly_roger',
					resolved: true,
					targetPlayerId: target.id
				}
			];

			const effects = resolver.resolve(dice, pendingActions, currentPlayer, players);

			const stealEffects = effects.filter(
				(e) => e.type === 'coins_lost' || e.type === 'coins_gained'
			);

			expect(stealEffects).toHaveLength(0);
		});

		it('should not create effect for cutlass without target', () => {
			const players = createTestPlayers(2);
			const [currentPlayer] = players;
			const dice = createTestDice(['cutlass', 'shield', 'shield', 'shield', 'shield', 'shield']);

			// No pending action with target
			const effects = resolver.resolve(dice, [], currentPlayer, players);

			const damageEffects = effects.filter((e) => e.type === 'damage');
			expect(damageEffects).toHaveLength(0);
		});
	});

	describe('combo effects', () => {
		describe("Blackbeard's Curse", () => {
			it('should deal 2 life and 5 coins to all other players', () => {
				const players = createTestPlayers(3);
				const [currentPlayer, ...others] = players;
				const dice = createBlackbeardsCurseDice();

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				others.forEach((other) => {
					const lifeEffect = effects.find((e) => e.type === 'life_lost' && e.targetId === other.id);
					const coinEffect = effects.find(
						(e) => e.type === 'coins_lost' && e.targetId === other.id
					);

					expect(lifeEffect).toBeDefined();
					expect(lifeEffect!.amount).toBe(2);
					expect(coinEffect).toBeDefined();
					expect(coinEffect!.amount).toBe(5);
				});
			});

			it('should not affect eliminated players', () => {
				const players = createTestPlayers(3);
				const [currentPlayer, , eliminated] = players;
				eliminated.isEliminated = true;

				const dice = createBlackbeardsCurseDice();

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				const eliminatedEffects = effects.filter((e) => e.targetId === eliminated.id);
				expect(eliminatedEffects).toHaveLength(0);
			});

			it('should override individual dice effects', () => {
				const players = createTestPlayers(2);
				const [currentPlayer] = players;
				const dice = createBlackbeardsCurseDice();

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				// Should not have individual effects like doubloon gain or walk_plank damage to self
				const selfEffects = effects.filter((e) => e.targetId === currentPlayer.id);
				expect(selfEffects).toHaveLength(0);
			});
		});

		describe('Mutiny', () => {
			it('should deal 1 life damage to all other players with base mutiny', () => {
				const players = createTestPlayers(3);
				const [currentPlayer, ...others] = players;
				const dice = createMutinyDice(0);

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				others.forEach((other) => {
					const lifeEffect = effects.find(
						(e) =>
							e.type === 'life_lost' && e.targetId === other.id && e.description.includes('Mutiny')
					);
					expect(lifeEffect).toBeDefined();
					expect(lifeEffect!.amount).toBe(1);
				});
			});

			it('should add bonus damage for extra walk_plank dice', () => {
				const players = createTestPlayers(2);
				const [currentPlayer, target] = players;
				const dice = createMutinyDice(2); // 5 walk_planks = +2 bonus

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				const mutinyEffect = effects.find(
					(e) =>
						e.type === 'life_lost' && e.targetId === target.id && e.description.includes('Mutiny')
				);
				expect(mutinyEffect).toBeDefined();
				expect(mutinyEffect!.amount).toBe(3); // 1 base + 2 bonus
			});

			it('should not process individual walk_plank damage in mutiny', () => {
				const players = createTestPlayers(2);
				const [currentPlayer] = players;
				const dice = createMutinyDice(0);

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				// Should not have individual life_lost from walk_plank to self
				const selfLifeLoss = effects.filter(
					(e) => e.type === 'life_lost' && e.targetId === currentPlayer.id
				);
				expect(selfLifeLoss).toHaveLength(0);
			});
		});

		describe('Shipwreck', () => {
			it('should cause 3 coin loss to all other players', () => {
				const players = createTestPlayers(3);
				const [currentPlayer, ...others] = players;
				const dice = createShipwreckDice(0);

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				others.forEach((other) => {
					const coinEffect = effects.find(
						(e) =>
							e.type === 'coins_lost' &&
							e.targetId === other.id &&
							e.description.includes('Shipwreck')
					);
					expect(coinEffect).toBeDefined();
					expect(coinEffect!.amount).toBe(3);
				});
			});

			it('should add bonus coin loss for extra x_marks_spot dice', () => {
				const players = createTestPlayers(2);
				const [currentPlayer, target] = players;
				const dice = createShipwreckDice(2); // 5 x_marks_spot = +2 bonus

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				const shipwreckEffect = effects.find(
					(e) =>
						e.type === 'coins_lost' &&
						e.targetId === target.id &&
						e.description.includes('Shipwreck')
				);
				expect(shipwreckEffect).toBeDefined();
				expect(shipwreckEffect!.amount).toBe(5); // 3 base + 2 bonus
			});

			it('should not process individual x_marks_spot in shipwreck', () => {
				const players = createTestPlayers(2);
				const [currentPlayer] = players;
				const dice = createShipwreckDice(0);

				const effects = resolver.resolve(dice, [], currentPlayer, players);

				// Should not have individual coins_lost from x_marks_spot to self
				const selfCoinLoss = effects.filter(
					(e) => e.type === 'coins_lost' && e.targetId === currentPlayer.id
				);
				expect(selfCoinLoss).toHaveLength(0);
			});
		});
	});

	describe('mixed dice', () => {
		it('should handle multiple different effects', () => {
			const players = createTestPlayers(2);
			const [currentPlayer, target] = players;
			target.doubloons = 10;

			// Use duplicate face to avoid Blackbeard's Curse (all 6 unique)
			const dice = createTestDice([
				'doubloon',
				'shield',
				'cutlass',
				'jolly_roger',
				'walk_plank',
				'doubloon' // duplicate to avoid curse
			]);

			const pendingActions: PendingAction[] = [
				{ dieIndex: 2, face: 'cutlass', resolved: true, targetPlayerId: target.id },
				{ dieIndex: 3, face: 'jolly_roger', resolved: true, targetPlayerId: target.id }
			];

			const effects = resolver.resolve(dice, pendingActions, currentPlayer, players);

			// Check for various effect types
			expect(effects.some((e) => e.type === 'coins_gained')).toBe(true); // doubloon
			expect(effects.some((e) => e.type === 'shield_gained')).toBe(true); // shield
			expect(effects.some((e) => e.type === 'damage')).toBe(true); // cutlass
			expect(effects.some((e) => e.type === 'coins_lost' && e.targetId === target.id)).toBe(true); // jolly_roger steal
			expect(effects.some((e) => e.type === 'life_lost' && e.targetId === currentPlayer.id)).toBe(
				true
			); // walk_plank
		});
	});
});
