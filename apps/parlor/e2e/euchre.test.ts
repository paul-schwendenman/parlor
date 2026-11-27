import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Euchre room with bots advances from dealer pickup and discard to the next trick', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	await page.getByRole('dialog').getByLabel('Your name').fill('Alex');
	await page.getByRole('dialog').getByRole('button', { name: 'Create Room' }).click();
	await page.getByRole('button', { name: 'Vote for Euchre', exact: true }).click();
	// Alone, the bottom bar invites; a bot makes two and PLAY comes back.
await page.locator('.table-strip').getByRole('button', { name: 'Add bot', exact: true }).click();
// The host's one Play button follows the leading game.
	await page.getByRole('button', { name: 'Play Euchre', exact: true }).click();

	// Each open seat has its own "Add bot to seat N"; the host's START is their ready.
	const addBot = page.getByRole('button', { name: /^Add bot to seat/ }).first();
	for (let count = 2; count <= 3; count++) {
		await addBot.click();
		await expect(page.getByRole('button', { name: /^Remove Bot / })).toHaveCount(count);
	}
	await page.getByRole('button', { name: 'Start Game' }).click();

	const order = page.getByRole('button', { name: 'Order it up' });
	const discard = page.getByText('Discard one card', { exact: true });
	await expect(order.or(discard)).toBeVisible();
	if (await order.isVisible()) await order.click();
	await expect(discard).toBeVisible();

	async function playFromHand(count: number) {
		const hand = page.getByRole('region', { name: `Your hand, ${count} cards` });
		const card = hand.getByRole('button').and(hand.locator('button:enabled')).first();
		await card.click({ position: { x: 8, y: 24 } });
		await expect(card).toHaveAttribute('aria-pressed', 'true');
		await card.click({ position: { x: 8, y: 24 } });
	}

	await playFromHand(6);
	await expect(page.getByRole('region', { name: 'Euchre trick table' })).toBeVisible();
	const sittingOut = await page.getByRole('group', { name: /Alex, you, .*Dealer .*Sitting out/ }).isVisible();
	if (!sittingOut) await playFromHand(5);
	await expect(page.getByText('Trick 2 of 5', { exact: true })).toBeVisible();
	const hand = page.getByRole('region', { name: 'Your hand, 4 cards' });
	if (sittingOut) await expect(hand).toHaveCount(0);
	else await expect(hand).toBeVisible();
});
