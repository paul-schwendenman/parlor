import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine.js';
import { createTestPlayers, resetPlayerIdCounter } from './factories/player.js';

// DICE_FACES order: ['doubloon', 'x_marks_spot', 'jolly_roger', 'cutlass', 'walk_plank', 'shield']
// Math.floor(random * 6) mapping:
//   0 = doubloon       (random in [0, 0.167))
//   1 = x_marks_spot   (random in [0.167, 0.333))
//   2 = jolly_roger     (random in [0.333, 0.5))
//   3 = cutlass         (random in [0.5, 0.667))
//   4 = walk_plank      (random in [0.667, 0.833))
//   5 = shield          (random in [0.833, 1))

/** Mock Math.random with a sequence of values, controlling both shuffle and dice rolls. */
function mockRandomSequence(values: number[]) {
	let callCount = 0;
	vi.spyOn(Math, 'random').mockImplementation(() => {
		return values[callCount++] ?? 0.05;
	});
}

/**
 * For a 2-player game, shuffle uses 1 Math.random call.
 * Returning 0.99 keeps the original player order (j=floor(0.99*2)=1, swap with self).
 * For a 3-player game, shuffle uses 2 calls.
 * Returning 0.99 for both keeps the original order.
 */
const SHUFFLE_KEEP_ORDER_2P = [0.99];
const SHUFFLE_KEEP_ORDER_3P = [0.99, 0.99];

const DOUBLOON = 0.05;
const X_MARKS_SPOT = 0.2;
const JOLLY_ROGER = 0.4;
const CUTLASS = 0.55;
const WALK_PLANK = 0.7;
const SHIELD = 0.85;

describe('GameEngine', () => {
	beforeEach(() => {
		resetPlayerIdCounter();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('should initialize game state with correct defaults', () => {
			const players = createTestPlayers(3);
			const engine = new GameEngine(players, 'TEST01');
			const state = engine.getState();

			expect(state.roomCode).toBe('TEST01');
			expect(state.phase).toBe('playing');
			expect(state.players).toHaveLength(3);
			expect(state.currentPlayerIndex).toBe(0);
			expect(state.turnNumber).toBe(1);
			expect(state.rollsRemaining).toBe(3);
			expect(state.dice).toHaveLength(6);
			expect(state.turnPhase).toBe('rolling');
			expect(state.pendingActions).toEqual([]);
			expect(state.winnerId).toBeNull();
		});

		it('should create fresh dice with doubloon faces', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');
			const state = engine.getState();

			state.dice.forEach((die, index) => {
				expect(die.id).toBe(index);
				expect(die.face).toBe('doubloon');
				expect(die.locked).toBe(false);
				expect(die.rolling).toBe(false);
			});
		});

		it('should add initial log entry', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');
			const state = engine.getState();

			expect(state.gameLog).toHaveLength(1);
			expect(state.gameLog[0].type).toBe('roll');
			expect(state.gameLog[0].message).toContain('turn begins');
		});
	});

	describe('getState', () => {
		it('should return a copy of state', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			const state1 = engine.getState();
			const state2 = engine.getState();

			expect(state1).not.toBe(state2);
			expect(state1.players).not.toBe(state2.players);
		});
	});

	describe('getCurrentPlayer', () => {
		it('should return player at currentPlayerIndex', () => {
			const players = createTestPlayers(3);
			const engine = new GameEngine(players, 'TEST01');

			const currentPlayer = engine.getCurrentPlayer();
			const state = engine.getState();

			expect(currentPlayer.id).toBe(state.players[state.currentPlayerIndex].id);
		});
	});

	describe('lockDice', () => {
		it('should lock specified dice indices', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			engine.lockDice([0, 2, 4]);
			const state = engine.getState();

			expect(state.dice[0].locked).toBe(true);
			expect(state.dice[1].locked).toBe(false);
			expect(state.dice[2].locked).toBe(true);
			expect(state.dice[3].locked).toBe(false);
			expect(state.dice[4].locked).toBe(true);
			expect(state.dice[5].locked).toBe(false);
		});

		it('should unlock dice not in the indices array', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			engine.lockDice([0, 1, 2, 3, 4, 5]); // Lock all
			engine.lockDice([0]); // Keep only first locked

			const state = engine.getState();
			expect(state.dice[0].locked).toBe(true);
			expect(state.dice.slice(1).every((d) => !d.locked)).toBe(true);
		});
	});

	describe('roll', () => {
		it('should decrease rollsRemaining', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			expect(engine.getState().rollsRemaining).toBe(3);
			engine.roll();
			expect(engine.getState().rollsRemaining).toBe(2);
			engine.roll();
			expect(engine.getState().rollsRemaining).toBe(1);
		});

		it('should throw error when no rolls remaining', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			engine.roll();
			engine.roll();
			engine.roll();

			expect(() => engine.roll()).toThrow('No rolls remaining');
		});

		it('should return canRollAgain based on remaining rolls', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			let result = engine.roll();
			expect(result.canRollAgain).toBe(true);

			result = engine.roll();
			expect(result.canRollAgain).toBe(true);

			result = engine.roll();
			expect(result.canRollAgain).toBe(false);
		});

		it('should add log entry for roll', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			const initialLogLength = engine.getState().gameLog.length;
			engine.roll();

			expect(engine.getState().gameLog.length).toBe(initialLogLength + 1);
		});
	});

	describe('selectTarget', () => {
		it('should assign target to pending action', () => {
			const players = createTestPlayers(3);

			// Control shuffle + dice: all cutlass
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_3P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS, // roll 1
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS, // roll 2
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS // roll 3
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.roll();
			engine.roll();

			const state = engine.getState();
			const cutlassAction = state.pendingActions.find((a) => a.face === 'cutlass');
			expect(cutlassAction).toBeDefined();

			const targetId = players[1].id;
			engine.selectTarget(cutlassAction!.dieIndex, targetId);

			const updatedState = engine.getState();
			const updatedAction = updatedState.pendingActions.find(
				(a) => a.dieIndex === cutlassAction!.dieIndex
			);

			expect(updatedAction?.targetPlayerId).toBe(targetId);
			expect(updatedAction?.resolved).toBe(true);
		});

		it('should throw error for invalid action', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			expect(() => engine.selectTarget(99, 'player-2')).toThrow('Invalid action');
		});

		it('should transition to resolving when all targets selected', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.roll();
			engine.roll();

			const state = engine.getState();
			expect(state.pendingActions.length).toBeGreaterThan(0);

			state.pendingActions.forEach((action) => {
				engine.selectTarget(action.dieIndex, players[1].id);
			});

			const finalState = engine.getState();
			expect(finalState.turnPhase).toBe('resolving');
		});
	});

	describe('hasUnresolvedTargets', () => {
		it('should return false when no pending actions', () => {
			const players = createTestPlayers(2);
			const engine = new GameEngine(players, 'TEST01');

			expect(engine.hasUnresolvedTargets()).toBe(false);
		});
	});

	describe('finishRolling', () => {
		it('should transition to resolving when no pending actions', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();

			expect(engine.getState().turnPhase).toBe('resolving');
		});

		it('should do nothing if not in rolling phase', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();

			const phaseBefore = engine.getState().turnPhase;
			engine.finishRolling();
			const phaseAfter = engine.getState().turnPhase;

			expect(phaseBefore).toBe(phaseAfter);
		});
	});

	describe('resolveTurn', () => {
		it('should return effects and no eliminations for safe roll', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();

			const result = engine.resolveTurn();

			expect(result.effects.length).toBeGreaterThan(0);
			expect(result.eliminations).toEqual([]);
			expect(result.winner).toBeNull();
		});

		it('should detect elimination when player loses all lives', () => {
			const players = createTestPlayers(2);
			players[0].lives = 1;

			// 1 walk_plank (self-damage) + 5 doubloons — no mutiny combo
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				WALK_PLANK,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			// player-1 is current (1 life), player-2 is other

			engine.roll();
			engine.finishRolling();
			const result = engine.resolveTurn();

			expect(result.eliminations).toContain(players[0].id);
			expect(result.winner).toBe(players[1].id);
		});

		it('should detect win by reaching 25 doubloons', () => {
			const players = createTestPlayers(2);
			players[0].doubloons = 23;
			players[1].doubloons = 23;

			// All doubloons (+2 each × 6 = +12, total 35 >= 25)
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();

			const result = engine.resolveTurn();

			expect(result.winner).not.toBeNull();
			expect(engine.getState().phase).toBe('ended');
		});
	});

	describe('endTurn', () => {
		it('should advance to next player', () => {
			const players = createTestPlayers(3);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_3P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();
			engine.resolveTurn();

			const initialIndex = engine.getState().currentPlayerIndex;
			engine.endTurn();

			const newIndex = engine.getState().currentPlayerIndex;
			expect(newIndex).toBe((initialIndex + 1) % 3);
		});

		it('should skip eliminated players', () => {
			const players = createTestPlayers(3);
			// Player at index 1 (player-2) will be targeted and killed
			players[1].lives = 1;
			players[1].shields = 0;

			// Shuffle keeps order, all dice = cutlass
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_3P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');
			// player-1 is current (index 0), player-2 at index 1 (1 life), player-3 at index 2

			engine.roll();
			engine.finishRolling();

			// Target player-2 with all cutlass attacks
			const state = engine.getState();
			state.pendingActions.forEach((action) => {
				engine.selectTarget(action.dieIndex, players[1].id);
			});

			const result = engine.resolveTurn();
			expect(result.eliminations).toContain(players[1].id);

			engine.endTurn();

			// Should skip player-2 (eliminated at index 1) and go to player-3 (index 2)
			const newState = engine.getState();
			expect(newState.players[newState.currentPlayerIndex].isEliminated).toBe(false);
			expect(newState.players[newState.currentPlayerIndex].id).toBe(players[2].id);
		});

		it('should reset dice and rolls for new turn', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.lockDice([0, 1, 2]);
			engine.finishRolling();
			engine.resolveTurn();
			engine.endTurn();

			const state = engine.getState();
			expect(state.rollsRemaining).toBe(3);
			expect(state.dice.every((d) => !d.locked)).toBe(true);
			expect(state.turnPhase).toBe('rolling');
			expect(state.pendingActions).toEqual([]);
		});

		it('should handle safety check when no non-eliminated player can be found', () => {
			// This tests a defensive safety guard that shouldn't be reachable through
			// normal gameplay (win conditions should catch it first). We use internal
			// state manipulation because this edge case can't be produced through the API.
			const players = createTestPlayers(3);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_3P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();
			engine.resolveTurn();

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(engine as any).state.players.forEach((p: { isEliminated: boolean }) => {
				p.isEliminated = true;
			});

			engine.endTurn();

			const state = engine.getState();
			expect(state.phase).toBe('ended');
		});

		it('should increment turn number', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();
			engine.resolveTurn();

			const turnBefore = engine.getState().turnNumber;
			engine.endTurn();
			const turnAfter = engine.getState().turnNumber;

			expect(turnAfter).toBe(turnBefore + 1);
		});
	});

	describe('shield absorption', () => {
		it('should absorb damage when target has shields', () => {
			const players = createTestPlayers(2);
			players[0].shields = 10;
			players[0].lives = 10;
			players[1].shields = 10;
			players[1].lives = 10;

			// Shuffle keeps order, all cutlass
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');
			// player-1 is current, player-2 is target (10 shields, 10 lives)

			engine.roll();
			engine.roll();
			engine.roll();

			const state = engine.getState();
			const currentPlayer = state.players[state.currentPlayerIndex];
			const target = state.players.find((p) => p.id !== currentPlayer.id)!;

			state.pendingActions.forEach((action) => {
				engine.selectTarget(action.dieIndex, target.id);
			});

			engine.resolveTurn();

			const finalState = engine.getState();
			const finalTarget = finalState.players.find((p) => p.id === target.id)!;

			// 6 cutlass attacks, each absorbed by a shield
			expect(finalTarget.shields).toBe(4); // 10 - 6 = 4
			expect(finalTarget.lives).toBe(10); // Lives preserved by shields
		});

		it('should deal damage when no shields available', () => {
			const players = createTestPlayers(2);
			players[0].shields = 0;
			players[1].shields = 0;

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');

			engine.roll();
			engine.roll();
			engine.roll();

			const state = engine.getState();
			const currentPlayer = state.players[state.currentPlayerIndex];
			const target = state.players.find((p) => p.id !== currentPlayer.id)!;

			state.pendingActions.forEach((action) => {
				engine.selectTarget(action.dieIndex, target.id);
			});

			engine.resolveTurn();

			const finalState = engine.getState();
			const finalTarget = finalState.players.find((p) => p.id === target.id)!;

			// 6 cutlass attacks, no shields, each deals 1 damage
			expect(finalTarget.lives).toBe(4); // 10 - 6 = 4
		});
	});

	describe('finishRolling with pending actions', () => {
		it('should transition to selecting_targets when there are pending actions', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			engine.finishRolling();

			const state = engine.getState();
			expect(state.pendingActions.length).toBeGreaterThan(0);
			expect(state.turnPhase).toBe('selecting_targets');
		});
	});

	describe('turn summary', () => {
		it('should log negative coin summary when losing more than gaining', () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();
			engine.resolveTurn();

			const state = engine.getState();
			const summaryLog = state.gameLog.find((e) => e.type === 'summary');
			expect(summaryLog).toBeDefined();
		});
	});

	describe('combo descriptions', () => {
		it('should describe mutiny combo in log', () => {
			const players = createTestPlayers(2);

			// 6 walk_plank → mutiny (3+ walk_plank)
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();
			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes('MUTINY')
			);
			expect(comboLog).toBeDefined();
			expect(comboLog!.message).toContain('MUTINY');
		});

		it('should describe shipwreck combo in log', () => {
			const players = createTestPlayers(2);

			// 6 x_marks_spot → shipwreck (3+ x_marks_spot)
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();
			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes('SHIPWRECK')
			);
			expect(comboLog).toBeDefined();
			expect(comboLog!.message).toContain('SHIPWRECK');
		});

		it("should describe blackbeard's curse combo in log when all faces unique", () => {
			const players = createTestPlayers(2);

			// Shuffle + 6 unique faces for Blackbeard's Curse
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				X_MARKS_SPOT,
				JOLLY_ROGER,
				CUTLASS,
				WALK_PLANK,
				SHIELD
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();
			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes("BLACKBEARD'S CURSE")
			);
			expect(comboLog).toBeDefined();
			expect(comboLog!.message).toContain("BLACKBEARD'S CURSE");
		});

		it("should not require target selection for blackbeard's curse", () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				X_MARKS_SPOT,
				JOLLY_ROGER,
				CUTLASS,
				WALK_PLANK,
				SHIELD
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();

			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes("BLACKBEARD'S CURSE")
			);
			expect(comboLog).toBeDefined();

			// No pending actions despite having cutlass and jolly_roger
			expect(state.pendingActions).toEqual([]);
			expect(state.turnPhase).toBe('rolling');
		});

		it("should not include 'stole' or 'shot' in turn summary for blackbeard's curse", () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				DOUBLOON,
				X_MARKS_SPOT,
				JOLLY_ROGER,
				CUTLASS,
				WALK_PLANK,
				SHIELD
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.finishRolling();
			engine.resolveTurn();

			const state = engine.getState();

			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes("BLACKBEARD'S CURSE")
			);
			expect(comboLog).toBeDefined();

			const summaryLog = state.gameLog.find((e) => e.type === 'summary');
			expect(summaryLog).toBeDefined();
			expect(summaryLog!.message).not.toContain('stole');
			expect(summaryLog!.message).not.toContain('shot');
		});

		it("should not include 'shot' or 'damage' in turn summary for mutiny (uses life_lost, not damage)", () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK,
				WALK_PLANK
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();
			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes('MUTINY')
			);
			expect(comboLog).toBeDefined();

			engine.finishRolling();
			engine.resolveTurn();

			const finalState = engine.getState();
			const summaryLog = finalState.gameLog.find((e) => e.type === 'summary');
			expect(summaryLog).toBeDefined();
			expect(summaryLog!.message).not.toContain('shot');
			expect(summaryLog!.message).not.toContain('dealt');
		});

		it("should not include 'stole' in turn summary for shipwreck (no sourceId)", () => {
			const players = createTestPlayers(2);

			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT,
				X_MARKS_SPOT
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();

			const state = engine.getState();
			const comboLog = state.gameLog.find(
				(e) => e.type === 'combo' && e.message.includes('SHIPWRECK')
			);
			expect(comboLog).toBeDefined();

			engine.finishRolling();
			engine.resolveTurn();

			const finalState = engine.getState();
			const summaryLog = finalState.gameLog.find((e) => e.type === 'summary');
			expect(summaryLog).toBeDefined();
			expect(summaryLog!.message).not.toContain('stole');
		});
	});

	describe('eliminated player effects', () => {
		it('should not resolve cutlass attacks if the attacker dies from walk_plank during resolution', () => {
			const players = createTestPlayers(2);
			players[0].lives = 1; // Current player has 1 life

			// walk_plank (kills current player) + cutlass (should NOT resolve) + 4 doubloons
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				WALK_PLANK,
				CUTLASS,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			const targetPlayer = engine.getState().players.find((p) => p.id === players[1].id)!;
			const targetInitialLives = targetPlayer.lives;

			engine.roll();
			engine.finishRolling();

			// Select target for cutlass
			const state = engine.getState();
			const cutlassAction = state.pendingActions.find((a) => a.face === 'cutlass');
			expect(cutlassAction).toBeDefined();
			engine.selectTarget(cutlassAction!.dieIndex, players[1].id);

			const result = engine.resolveTurn();

			// Current player died from walk_plank
			expect(result.eliminations).toContain(players[0].id);

			// Target should NOT have lost any lives — attacker died before cutlass resolved
			const finalTarget = engine.getState().players.find((p) => p.id === players[1].id)!;
			expect(finalTarget.lives).toBe(targetInitialLives);
		});

		it('should not resolve jolly_roger steals if the attacker dies from walk_plank during resolution', () => {
			const players = createTestPlayers(2);
			players[0].lives = 1; // Current player has 1 life

			// walk_plank (kills current player) + jolly_roger (should NOT resolve) + 4 doubloons
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				WALK_PLANK,
				JOLLY_ROGER,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON,
				DOUBLOON
			]);

			const engine = new GameEngine(players, 'TEST01');
			const targetInitialCoins = engine
				.getState()
				.players.find((p) => p.id === players[1].id)!.doubloons;

			engine.roll();
			engine.finishRolling();

			// Select target for jolly_roger
			const state = engine.getState();
			const stealAction = state.pendingActions.find((a) => a.face === 'jolly_roger');
			expect(stealAction).toBeDefined();
			engine.selectTarget(stealAction!.dieIndex, players[1].id);

			const result = engine.resolveTurn();

			// Current player died from walk_plank
			expect(result.eliminations).toContain(players[0].id);

			// Target should NOT have lost any coins — attacker died before steal resolved
			const finalTarget = engine.getState().players.find((p) => p.id === players[1].id)!;
			expect(finalTarget.doubloons).toBe(targetInitialCoins);
		});
	});

	describe('win conditions', () => {
		it('should detect last standing win', () => {
			const players = createTestPlayers(2);
			// Both start with these stats so regardless of shuffle, the target has 1 life
			players[0].lives = 1;
			players[0].shields = 0;
			players[1].lives = 1;
			players[1].shields = 0;

			// All cutlass — current player attacks target, kills them
			mockRandomSequence([
				...SHUFFLE_KEEP_ORDER_2P,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS,
				CUTLASS
			]);

			const engine = new GameEngine(players, 'TEST01');
			engine.roll();
			engine.roll();
			engine.roll();

			const currentState = engine.getState();
			const currentPlayerId = currentState.players[currentState.currentPlayerIndex].id;
			const targetPlayer = currentState.players.find((p) => p.id !== currentPlayerId)!;

			currentState.pendingActions.forEach((action) => {
				engine.selectTarget(action.dieIndex, targetPlayer.id);
			});

			const result = engine.resolveTurn();

			expect(result.eliminations).toContain(targetPlayer.id);
			expect(result.winner).toBe(currentPlayerId);
		});
	});
});
