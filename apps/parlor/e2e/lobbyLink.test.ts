import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a pasted lobby link offers to join a live room, and a bogus code is not found', async ({ page, browser }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Your name').fill('Host');
	await dialog.getByRole('button', { name: 'Create Room' }).click();
	await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
	const roomCode = new URL(page.url()).pathname.split('/').pop()!;

	const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const strangerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
	try {
		// No session: the live room's link lands on the join form, code filled in.
		const visitor = await visitorContext.newPage();
		await visitor.goto(`/lobby/${roomCode}`);
		await expect(visitor).toHaveURL(`/?join=${roomCode}`);
		await expect(visitor.getByText(`Add your name to join room ${roomCode}.`, { exact: true })).toBeVisible();
		await expect(visitor.getByLabel('Room code')).toHaveValue(roomCode);
		await expect(visitor.getByLabel('Your name')).toBeFocused();
		await expect(visitor.getByRole('button', { name: 'Watch as spectator', exact: true })).toBeVisible();
		await visitor.getByLabel('Your name').fill('Visitor');
		await visitor.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(visitor).toHaveURL(`/lobby/${roomCode}`);
		await expect(page.locator('.name-text', { hasText: 'Visitor' })).toBeVisible();

		// A returning player is recognised, not sent back to the join form.
		await visitor.goto(`/lobby/${roomCode}`);
		await expect(visitor.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
		await expect(visitor).toHaveURL(`/lobby/${roomCode}`);

		// A room that isn't there still says so.
		const stranger = await strangerContext.newPage();
		await stranger.goto('/lobby/QQQQ');
		await expect(stranger.getByRole('heading', { name: "There's no room QQQQ.", exact: true })).toBeVisible();
		await expect(stranger).toHaveURL('/lobby/QQQQ');
		// The code is there to fix: a wrong one says so, the right one joins.
		const retry = stranger.getByLabel('Room code');
		await expect(retry).toHaveValue('QQQQ');
		await retry.fill('QQQ');
		await stranger.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(stranger.getByText('Room codes have 4 letters and numbers.', { exact: true })).toBeVisible();
		await retry.fill('ZZZZ');
		await stranger.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(stranger.getByText("There's no room ZZZZ either. Check the code and try again.", { exact: true })).toBeVisible();
		await retry.fill(roomCode.toLowerCase());
		await stranger.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(stranger).toHaveURL(`/?join=${roomCode}`);
		await expect(stranger.getByLabel('Your name')).toBeFocused();
	} finally {
		await visitorContext.close();
		await strangerContext.close();
	}
});
