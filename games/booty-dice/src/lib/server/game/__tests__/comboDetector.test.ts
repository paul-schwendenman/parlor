import { describe, it, expect } from 'vitest';
import { detectCombo } from '../comboDetector.js';
import type { DiceFace } from '$lib/types/game.js';

describe('detectCombo', () => {
	it('should detect blackbeards_curse when all 6 faces are different', () => {
		const faces: DiceFace[] = [
			'doubloon',
			'x_marks_spot',
			'jolly_roger',
			'cutlass',
			'walk_plank',
			'shield'
		];
		expect(detectCombo(faces)).toBe('blackbeards_curse');
	});

	it('should detect mutiny with 3 walk_plank', () => {
		const faces: DiceFace[] = [
			'walk_plank',
			'walk_plank',
			'walk_plank',
			'doubloon',
			'shield',
			'cutlass'
		];
		expect(detectCombo(faces)).toBe('mutiny');
	});

	it('should detect mutiny with 4 walk_plank', () => {
		const faces: DiceFace[] = [
			'walk_plank',
			'walk_plank',
			'walk_plank',
			'walk_plank',
			'shield',
			'cutlass'
		];
		expect(detectCombo(faces)).toBe('mutiny');
	});

	it('should detect shipwreck with 3 x_marks_spot', () => {
		const faces: DiceFace[] = [
			'x_marks_spot',
			'x_marks_spot',
			'x_marks_spot',
			'doubloon',
			'shield',
			'cutlass'
		];
		expect(detectCombo(faces)).toBe('shipwreck');
	});

	it('should detect shipwreck with 5 x_marks_spot', () => {
		const faces: DiceFace[] = [
			'x_marks_spot',
			'x_marks_spot',
			'x_marks_spot',
			'x_marks_spot',
			'x_marks_spot',
			'cutlass'
		];
		expect(detectCombo(faces)).toBe('shipwreck');
	});

	it('should prioritize blackbeards_curse over mutiny and shipwreck', () => {
		// All unique faces triggers blackbeards_curse even though no individual combo threshold is met
		const faces: DiceFace[] = [
			'doubloon',
			'x_marks_spot',
			'jolly_roger',
			'cutlass',
			'walk_plank',
			'shield'
		];
		expect(detectCombo(faces)).toBe('blackbeards_curse');
	});

	it('should prioritize mutiny over shipwreck when both could match', () => {
		// 3 walk_planks and 3 x_marks_spot - mutiny checked first
		const faces: DiceFace[] = [
			'walk_plank',
			'walk_plank',
			'walk_plank',
			'x_marks_spot',
			'x_marks_spot',
			'x_marks_spot'
		];
		expect(detectCombo(faces)).toBe('mutiny');
	});

	it('should return null when no combo detected', () => {
		const faces: DiceFace[] = [
			'doubloon',
			'doubloon',
			'shield',
			'shield',
			'cutlass',
			'jolly_roger'
		];
		expect(detectCombo(faces)).toBeNull();
	});

	it('should return null with only 2 walk_plank', () => {
		const faces: DiceFace[] = [
			'walk_plank',
			'walk_plank',
			'doubloon',
			'doubloon',
			'shield',
			'cutlass'
		];
		expect(detectCombo(faces)).toBeNull();
	});

	it('should return null with only 2 x_marks_spot', () => {
		const faces: DiceFace[] = [
			'x_marks_spot',
			'x_marks_spot',
			'doubloon',
			'doubloon',
			'shield',
			'cutlass'
		];
		expect(detectCombo(faces)).toBeNull();
	});
});
