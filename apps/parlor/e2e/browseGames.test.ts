import { test, expect } from '@playwright/test';

const results = (page: import('@playwright/test').Page) => page.locator('#results-title');

test('the home shelf links to the full list', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /Browse all \d+ games/ }).click();
	await expect(page).toHaveURL(/\/games$/);
	await expect(page.getByRole('heading', { name: 'Find a game' })).toBeVisible();
	await expect(results(page)).toHaveText(/^All \d+ games$/);
});

test('answering the questions narrows the shelf and lands in the URL', async ({ page }) => {
	await page.goto('/games');

	await page.getByRole('group', { name: 'How many of you?' }).getByRole('button', { name: '6 or more', exact: true }).click();
	const kind = page.getByRole('group', { name: 'What kind of game?' });
	await kind.getByRole('button', { name: 'Dice', exact: true }).click();
	await expect(results(page)).toHaveText('3 games fit');
	await expect(page).toHaveURL(/players=6/);
	await expect(page).toHaveURL(/type=dice/);
	await expect(page.getByRole('heading', { name: "Liar's Dice" })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Quixx' })).toHaveCount(0);

	// Tapping the current answer clears it.
	await kind.getByRole('button', { name: 'Dice', exact: true }).click();
	await expect(kind.getByRole('button', { name: 'Any kind', exact: true })).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('searchbox', { name: 'Search games' }).fill('pirate');
	await expect(results(page)).toHaveText('1 game fits');

	await page.getByRole('button', { name: 'Start over' }).first().click();
	await expect(results(page)).toHaveText(/^All \d+ games$/);
	await expect(page.getByRole('searchbox', { name: 'Search games' })).toHaveValue('');
});

test('a shared link restores the answers, and an empty result offers a way out', async ({ page }) => {
	await page.goto('/games?players=6&type=cards&length=long');
	await expect(page.getByRole('group', { name: 'How many of you?' }).getByRole('button', { name: '6 or more', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(results(page)).toHaveText('No games fit');

	await page.getByRole('button', { name: /^Any number of players \d+ games?$/ }).click();
	await expect(results(page)).not.toHaveText('No games fit');
});

test('play opens the create-room dialog for that game', async ({ page }) => {
	await page.goto('/games?q=hearts');
	await page.getByRole('button', { name: /^Play / }).first().click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Play Hearts' })).toBeVisible();
});

test('a shared link in any param order loads cleanly and settles into the canonical URL', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/games?players=4&type=cards&q=trick');
	await expect(page).toHaveURL(/\/games\?q=trick&players=4&type=cards$/);
	expect(errors).toEqual([]);
});
