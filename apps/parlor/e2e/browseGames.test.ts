import { test, expect } from '@playwright/test';

const results = (page: import('@playwright/test').Page) => page.locator('#results-title');

// Up to 12 games the home shelf shows them all; past that, 8 and a link (src/lib/games/shelf.ts).
test('the home shelf shows every game, or 8 and a link to the full list', async ({ page }) => {
	await page.goto('/games');
	const total = Number((await results(page).textContent())?.match(/\d+/)?.[0]);

	await page.goto('/');
	const shelf = page.getByRole('region', { name: 'Or start a new room' });
	const link = shelf.getByRole('link', { name: `Browse all ${total} games` });
	if (total <= 12) {
		await expect(shelf.getByRole('button', { name: 'Start a room' })).toHaveCount(total);
		await expect(link).toHaveCount(0);
		return;
	}

	await expect(shelf.getByRole('button', { name: 'Start a room' })).toHaveCount(8);
	await link.click();
	await expect(page).toHaveURL(/\/games$/);
	await expect(page.getByRole('heading', { name: 'Find a game' })).toBeVisible();
	await expect(results(page)).toHaveText(`All ${total} games`);
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
	await expect(kind.getByRole('button', { name: 'Any', exact: true })).toHaveAttribute('aria-pressed', 'true');

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

	await page.getByRole('button', { name: /Any number of players/ }).click();
	await expect(results(page)).not.toHaveText('No games fit');
});

test('start a room opens the create-room dialog for that game', async ({ page }) => {
	await page.goto('/games?q=hearts');
	await page.getByRole('button', { name: 'Start a room' }).first().click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Create a Hearts room' })).toBeVisible();
});
