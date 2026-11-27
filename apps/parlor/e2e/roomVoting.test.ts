import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('friends vote together and the host confirms a tied game', async ({ page, browser }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Your name').fill('Host');
	await dialog.getByRole('button', { name: 'Create Room' }).click();
	await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
	const roomCode = new URL(page.url()).pathname.split('/').pop();

	const guestContexts = await Promise.all([
		browser.newContext({ viewport: { width: 390, height: 844 } }),
		browser.newContext({ viewport: { width: 390, height: 844 } })
	]);
	try {
		const [guest, friend] = await Promise.all(guestContexts.map(async (context, index) => {
			const player = await context.newPage();
			await player.goto('/?join=' + roomCode);
			await player.getByLabel('Your name').fill(index === 0 ? 'Guest' : 'Friend');
			await player.getByRole('button', { name: 'Join', exact: true }).click();
			await expect(player.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
			return player;
		}));

		const quixxVote = guest.getByRole('button', { name: 'Vote for Quixx' });
		await quixxVote.press('Space');
		await expect(quixxVote).toHaveAttribute('aria-pressed', 'true');
		await guest.reload();
		await expect(quixxVote).toHaveAttribute('aria-pressed', 'true');
		await friend.getByRole('button', { name: 'Vote for Crazy Eights' }).click();

		await expect(page.getByText('Tied for the lead · Quixx, Crazy Eights')).toBeVisible();
		await expect(guest.getByRole('button', { name: 'Confirm Quixx' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Confirm Quixx' }).click();
		await expect(page.getByRole('heading', { name: 'Quixx', exact: true })).toBeFocused();
		await expect(guest.getByRole('heading', { name: 'Quixx', exact: true })).toBeVisible();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Vote for next game' }).click();
		await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeFocused();
		await expect(guest.getByRole('button', { name: 'Vote for Hearts', exact: true })).toBeVisible();
		await expect(guest.getByText(/^[1-9]\d* votes?$/)).toHaveCount(0);
		await page.getByRole('button', { name: 'Confirm Crazy Eights' }).click();
		await expect(friend.getByRole('heading', { name: 'Crazy Eights', exact: true })).toBeVisible();
	} finally {
		await Promise.all(guestContexts.map(context => context.close()));
	}
});
