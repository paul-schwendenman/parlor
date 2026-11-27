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
		await expect(page.getByText('Tied · Quixx, Crazy Eights, 1 vote each', { exact: true })).toBeVisible();
		await expect(page.getByText('Tied with Crazy Eights. Vote to break the tie.', { exact: true })).toBeVisible();
		// Guests only ever vote: no Play button, and no Play in the rules sheet,
		// where their vote shows as a pressed toggle.
		await expect(guest.getByRole('button', { name: /^Play / })).toHaveCount(0);
		await guest.getByRole('button', { name: 'How to play Quixx', exact: true }).click();
		const guestRules = guest.getByRole('dialog');
		await expect(guestRules.getByText('2–5 players · bots can fill seats', { exact: true })).toBeVisible();
		await expect(guestRules.getByRole('button', { name: /^Play / })).toHaveCount(0);
		await expect(guestRules.getByRole('button', { name: 'Your vote', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await guest.keyboard.press('Escape');

		// When the host's own vote is one of the tied games, Play follows it.
		const heartsVote = page.getByRole('button', { name: 'Vote for Hearts', exact: true });
		await heartsVote.click();
		await expect(page.getByText('Tied · Quixx, Crazy Eights, Hearts, 1 vote each', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Play Hearts', exact: true })).toBeEnabled();
		await heartsVote.click();
		await expect(heartsVote).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByText('Tied · Quixx, Crazy Eights, 1 vote each', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Play Quixx', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Quixx', exact: true })).toBeFocused();
		await expect(guest.getByRole('heading', { name: 'Quixx', exact: true })).toBeVisible();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();

		// Ready is one toggle: pressed it shows a check and says how to undo;
		// the row reads plain "Not ready yet" until then.
		const friendReady = friend.getByRole('button', { name: 'Ready', exact: true });
		await expect(friendReady).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.player', { hasText: 'Friend' }).getByText('Not ready yet', { exact: true })).toBeVisible();
		await friendReady.click();
		await expect(friendReady).toHaveAttribute('aria-pressed', 'true');
		await expect(friendReady).toHaveAccessibleDescription("Click again if you're not ready.");
		await expect(friend.getByRole('button', { name: 'Not ready', exact: true })).toHaveCount(0);
		await expect(page.locator('.player', { hasText: 'Friend' }).getByText('Ready', { exact: true })).toBeVisible();
		await friendReady.click();
		await expect(friendReady).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.player', { hasText: 'Friend' }).getByText('Not ready yet', { exact: true })).toBeVisible();
		await friendReady.click();
		await expect(friendReady).toHaveAttribute('aria-pressed', 'true');

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
		// A vote for another game: PLAY would un-ready Friend, and says so.
		const eightsVote = page.getByRole('button', { name: 'Vote for Crazy Eights', exact: true });
		await eightsVote.click();
		await expect(page.locator('.play-bar').getByText('Everyone gets ready again for Crazy Eights.', { exact: true })).toBeVisible();
		await expect(friend.getByText("Host is choosing again. If Crazy Eights is played, you'll get ready again.", { exact: true })).toBeVisible();
		await eightsVote.click();
		await expect(page.getByText('Leading · Quixx (current game)', { exact: true })).toBeVisible();
		await expect(page.getByText('Everyone gets ready again for Crazy Eights.', { exact: true })).toHaveCount(0);
		// Readiness shows while choosing again: the strip says who is ready.
		await expect(page.locator('.strip-avatars').getByText('Friend, ready', { exact: true })).toBeAttached();
		await page.getByRole('button', { name: 'Keep Quixx', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Quixx', exact: true })).toBeFocused();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true, pressed: true })).toBeVisible();

		// The host can play any game the room fits from its rules sheet; a
		// different game asks everyone to get ready again.
		await page.getByRole('button', { name: 'Change game', exact: true }).click();
		await page.getByRole('button', { name: 'How to play Crazy Eights', exact: true }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Play Crazy Eights', exact: true }).click();
		await expect(friend.getByRole('heading', { name: 'Crazy Eights', exact: true })).toBeVisible();
		await expect(friend.getByRole('button', { name: 'Ready', exact: true, pressed: false })).toBeVisible();
	} finally {
		await Promise.all(guestContexts.map(context => context.close()));
	}
});

test('rules open from the confirmed game, and a room that outgrows it cannot keep it', async ({ page, browser }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Your name').fill('Host');
	await dialog.getByRole('button', { name: 'Create Room' }).click();
	await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
	// Alone, the standing line asks for an invite first, and the bottom bar's
	// one shouted button invites (headless Chromium has no share sheet, so it
	// copies), with the QR code beside it. There is no PLAY yet.
	await expect(page.getByText('Share the code so others can join, or add a bot. You can vote while you wait.', { exact: true })).toBeVisible();
	await expect(page.getByText('Needs 1 more player', { exact: true })).toHaveCount(0);
	const playBar = page.locator('.play-bar');
	await expect(playBar.getByRole('button', { name: 'Copy invite link', exact: true })).toBeVisible();
	await expect(playBar.getByRole('button', { name: 'Show QR code', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Play/ })).toHaveCount(0);
	await playBar.getByRole('button', { name: 'Show QR code', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Scan to join' })).toBeVisible();
	await page.keyboard.press('Escape');
	const roomCode = new URL(page.url()).pathname.split('/').pop();

	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	try {
		const guest = await context.newPage();
		await guest.goto('/?join=' + roomCode);
		await guest.getByLabel('Your name').fill('Guest');
		await guest.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(guest.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
		// A second player: PLAY is back, and the invite lives on the lid again.
		await expect(playBar.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
		await expect(playBar.getByRole('button', { name: 'Copy invite link', exact: true })).toHaveCount(0);
		await expect(guest.locator('.play-bar')).toHaveCount(0);

		await guest.getByRole('button', { name: 'Vote for Hearts', exact: true }).click();
		await expect(page.getByText('Leading · Hearts, 1 vote (needs 2 more players)', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Play Hearts', exact: true }).click();
		await page.getByRole('button', { name: 'Add bot to seat 3', exact: true }).click();
		await page.getByRole('button', { name: 'Add bot to seat 4', exact: true }).click();
		await guest.getByRole('button', { name: 'Ready', exact: true }).click();
		await expect(page.getByText("Everyone's ready", { exact: true })).toBeVisible();

		// Rules from the panel: guests only close; the host can change the game.
		await guest.getByRole('button', { name: 'How to play Hearts', exact: true }).click();
		const guestRules = guest.getByRole('dialog');
		await expect(guestRules.getByRole('heading', { name: 'How to play Hearts' })).toBeVisible();
		await expect(guestRules.getByRole('button')).toHaveText(['Close']);
		await guestRules.getByRole('button', { name: 'Close', exact: true }).click();
		await page.getByRole('button', { name: 'How to play Hearts', exact: true }).click();
		// The host's Change game is on the panel already, so the sheet only closes.
		const hostRules = page.getByRole('dialog');
		await expect(hostRules.getByRole('button')).toHaveText(['Close']);
		await hostRules.getByRole('button', { name: 'Close', exact: true }).click();
		await page.getByRole('button', { name: 'Change game', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeFocused();
		await expect(page.getByRole('button', { name: 'Keep Hearts', exact: true })).toBeVisible();

		// Six at a four-seat game: Hearts loses its lead and Keep says why.
		const addBot = page.locator('.table-strip').getByRole('button', { name: 'Add bot', exact: true });
		await addBot.click();
		await expect(page.getByText('5 players', { exact: true })).toBeVisible();
		await addBot.click();
		await expect(page.getByText('6 players', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Keep Hearts', exact: true })).toHaveCount(0);
		await expect(page.getByText('Hearts seats 4. Remove 2 bots to keep it.', { exact: true })).toBeVisible();
		await expect(page.getByText('No votes yet', { exact: true })).toBeVisible();
		await expect(guest.getByText("Host is choosing again. Hearts seats 4, so it can't stay as things are.", { exact: true })).toBeVisible();

		// Removing the extra bots makes it keepable again.
		await page.getByRole('button', { name: /^Remove Bot / }).first().click();
		await expect(page.getByText('Hearts seats 4. Remove 1 bot to keep it.', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: /^Remove Bot / }).first().click();
		await expect(page.getByText('Leading · Hearts (current game)', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Keep Hearts', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Hearts', exact: true })).toBeFocused();
		await expect(guest.getByRole('button', { name: 'Ready', exact: true, pressed: true })).toBeVisible();
	} finally {
		await context.close();
	}
});
