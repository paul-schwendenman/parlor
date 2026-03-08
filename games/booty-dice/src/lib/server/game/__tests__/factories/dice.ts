import type { Die, DiceFace } from '$lib/types/game.js';

export function createTestDie(overrides: Partial<Die> = {}): Die {
	return {
		id: 0,
		face: 'doubloon',
		locked: false,
		rolling: false,
		...overrides
	};
}

export function createTestDice(faces: DiceFace[]): Die[] {
	return faces.map((face, id) => ({
		id,
		face,
		locked: false,
		rolling: false
	}));
}

export function createFreshDice(): Die[] {
	return Array.from({ length: 6 }, (_, i) => ({
		id: i,
		face: 'doubloon' as DiceFace,
		locked: false,
		rolling: false
	}));
}

// Combo helpers
export function createBlackbeardsCurseDice(): Die[] {
	return createTestDice([
		'doubloon',
		'x_marks_spot',
		'jolly_roger',
		'cutlass',
		'walk_plank',
		'shield'
	]);
}

export function createMutinyDice(bonusCount = 0): Die[] {
	const planks = 3 + bonusCount;
	const faces: DiceFace[] = Array(planks).fill('walk_plank');
	// Fill remaining with non-plank faces
	while (faces.length < 6) {
		faces.push('doubloon');
	}
	return createTestDice(faces.slice(0, 6));
}

export function createShipwreckDice(bonusCount = 0): Die[] {
	const xMarks = 3 + bonusCount;
	const faces: DiceFace[] = Array(xMarks).fill('x_marks_spot');
	// Fill remaining with non-x faces
	while (faces.length < 6) {
		faces.push('doubloon');
	}
	return createTestDice(faces.slice(0, 6));
}
