import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a player can pass cards and play a trick in a Hearts room with bots', async ({ page }) => {
	await page.goto('/');
	const game = page.getByRole('article').filter({
		has: page.getByRole('heading', { name: 'Hearts', exact: true }),
	});
	await game.getByRole('button', { name: 'How to play' }).click();
	const rules = page.getByRole('dialog');
	await expect(rules.getByRole('heading', { name: 'Taking Tricks' })).toBeVisible();
	await page.keyboard.press('Escape');
	await game.getByRole('button', { name: 'Start Game' }).click();
	await page.getByPlaceholder('Enter your name').fill('Alex');
	await page.getByRole('button', { name: 'Create Room' }).click();
	await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{4}$/);

	// Each open seat has its own "Add bot to seat N"; the host's START is their ready.
	const addBot = page.getByRole('button', { name: /^Add bot to seat/ }).first();
	for (let count = 1; count <= 3; count++) {
		await addBot.click();
		await expect(page.getByRole('button', { name: /^Remove Bot / })).toHaveCount(count);
	}
	await page.getByRole('button', { name: 'Start Game' }).click();
	// The lobby's panel has its own "How to play Hearts"; wait for the table.
	await expect(page).toHaveURL(/\/game\/[A-Z2-9]{4}$/);

	await page.getByRole('button', { name: 'How to play Hearts' }).click();
	await expect(rules.getByRole('heading', { name: 'Taking Tricks' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('status').filter({ hasText: 'Pass three cards left' })).toBeVisible();
	const hand = page.getByRole('region', { name: /^Your hand,/ });
	const cards = hand.getByRole('button').and(hand.locator('[aria-pressed="false"]'));
	await expect(cards).toHaveCount(13);
	for (let count = 0; count < 3; count++) await cards.first().click({ position: { x: 8, y: 24 } });
	await page.getByRole('button', { name: 'Confirm pass' }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Your turn' })).toBeVisible();
	// The first tap lifts the card; the second plays it.
	const card = hand.locator('button:enabled').first();
	await card.click({ position: { x: 8, y: 24 } });
	await expect(card).toHaveAttribute('aria-pressed', 'true');
	await card.click({ position: { x: 8, y: 24 } });
	await expect(page.getByText('Trick 2 of 13', { exact: true })).toBeVisible();
	await expect(hand.getByRole('button')).toHaveCount(12);
});
