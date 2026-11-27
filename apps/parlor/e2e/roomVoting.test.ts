import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('friends vote together and the host plays a tied game', async ({ page, browser }) => {
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

		// Everyone sees who voted for what, not just how many.
		await expect(page.getByRole('button', { name: 'Vote for Quixx', exact: true }))
			.toHaveAccessibleDescription('Quixx: 1 vote, Guest.');
		await expect(page.getByRole('button', { name: 'Vote for Crazy Eights', exact: true }))
			.toHaveAccessibleDescription('Crazy Eights: 1 vote, Friend.');

		// A tie the host hasn't voted in goes to the first tied game on the shelf.
		await expect(page.getByText('Tied · Quixx, Crazy Eights', { exact: true })).toBeVisible();
		await expect(page.getByText('Tied with Crazy Eights. Vote to break the tie.', { exact: true })).toBeVisible();
		// Guests only ever vote: no Play button, and no Play this in the rules sheet.
		await expect(guest.getByRole('button', { name: /^Play / })).toHaveCount(0);
		await guest.getByRole('button', { name: 'How to play Quixx', exact: true }).click();
		await expect(guest.getByRole('dialog').getByRole('button', { name: 'Play this' })).toHaveCount(0);
		await guest.keyboard.press('Escape');

		// When the host's own vote is one of the tied games, Play follows it.
		const heartsVote = page.getByRole('button', { name: 'Vote for Hearts', exact: true });
		await heartsVote.click();
		await expect(page.getByText('Tied · Quixx, Crazy Eights, Hearts', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Play Hearts', exact: true })).toBeEnabled();
		await heartsVote.click();
		await expect(heartsVote).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByText('Tied · Quixx, Crazy Eights', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Play Quixx', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Quixx', exact: true })).toBeFocused();
		await expect(guest.getByRole('heading', { name: 'Quixx', exact: true })).toBeVisible();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();

		await friend.getByRole('button', { name: 'Ready', exact: true }).click();
		await expect(friend.getByRole('button', { name: 'Not ready', exact: true })).toBeVisible();

		// Change game reopens the ballot without losing Quixx: it is marked
		// current, leads until another game gets a vote, and Keep backs out.
		await page.getByRole('button', { name: 'Change game', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeFocused();
		await expect(page.getByText('Leading · Quixx (current game)', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vote for Quixx', exact: true }))
			.toHaveAccessibleDescription('Quixx: current game, no votes.');
		await expect(guest.getByText('Host is choosing again. Quixx stays unless another game is played.', { exact: true })).toBeVisible();
		await expect(friend.getByText('Host is choosing again. You stay ready if Quixx stays.', { exact: true })).toBeVisible();
		await expect(guest.getByRole('button', { name: 'Vote for Hearts', exact: true })).toBeVisible();
		await expect(guest.getByText(/^[1-9]\d* votes?$/)).toHaveCount(0);
		await expect(guest.getByRole('button', { name: /^Keep / })).toHaveCount(0);
		await page.getByRole('button', { name: 'Keep Quixx', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Quixx', exact: true })).toBeFocused();
		await expect(friend.getByRole('button', { name: 'Not ready', exact: true })).toBeVisible();

		// The host can play any game the room fits from its rules sheet; a
		// different game asks everyone to get ready again.
		await page.getByRole('button', { name: 'Change game', exact: true }).click();
		await page.getByRole('button', { name: 'How to play Crazy Eights', exact: true }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Play this', exact: true }).click();
		await expect(friend.getByRole('heading', { name: 'Crazy Eights', exact: true })).toBeVisible();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
	} finally {
		await Promise.all(guestContexts.map(context => context.close()));
	}
});
