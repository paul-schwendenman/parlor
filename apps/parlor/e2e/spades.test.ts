import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a player can bid and play a trick in a Spades room with bots', async ({ page }) => {
	await Promise.all([
		page.waitForResponse((response) => new URL(response.url()).pathname === '/socket.io/' && response.ok()),
		page.goto('/'),
	]);
	const game = page.getByRole('article').filter({
		has: page.getByRole('heading', { name: 'Spades', exact: true }),
	});
	await game.getByRole('button', { name: 'How to play' }).click();
	await expect(page.getByRole('dialog').getByRole('heading', { name: 'Trump and Tricks' })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	await page.getByPlaceholder('Enter your name').fill('Alex');
	await page.getByRole('button', { name: 'Create Room' }).click();
	await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{6}$/);

	await page.getByRole('button', { name: 'Vote for Spades', exact: true }).click();
	// The host's one Play button follows the leading game.
	await page.getByRole('button', { name: 'Play Spades', exact: true }).click();

	// Each open seat has its own "Add bot to seat N"; the host's START is their ready.
	const addBot = page.getByRole('button', { name: /^Add bot to seat/ }).first();
	for (let count = 1; count <= 3; count++) {
		await addBot.click();
		await expect(page.getByText('Bot', { exact: true })).toHaveCount(count);
	}
	await page.getByRole('button', { name: 'Start Game' }).click();

	const bidding = page.getByRole('region', { name: 'Choose your bid' });
	await expect(bidding.getByRole('button', { name: 'Nil' })).toBeVisible();
	await bidding.getByRole('button', { name: '2', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Spades trick table' })).toBeVisible();
	const hand = page.getByRole('region', { name: 'Your hand, 13 cards' });
	const card = hand.getByRole('button').and(hand.locator('button:enabled')).first();
	// The hand fans out, leaving each card's left edge available to tap.
	await card.click({ position: { x: 8, y: 24 } });
	await expect(card).toHaveAttribute('aria-pressed', 'true');
	await card.click({ position: { x: 8, y: 24 } });
	await expect(page.getByText('Trick 2 of 13', { exact: true })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Your hand, 12 cards' })).toBeVisible();
});
