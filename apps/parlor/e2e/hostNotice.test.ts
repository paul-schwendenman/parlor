import { test, expect, type Browser, type Page } from '@playwright/test';

// Plan 9.3: "Make host" lives behind a per-row options button, and everyone in
// the room is told when the host changes.

async function createRoom(browser: Browser, name: string) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/');
	await page.getByRole('button', { name: /^Play / }).first().click();
	await page.getByPlaceholder('Enter your name').fill(name);
	await page.getByRole('button', { name: 'Create Room' }).click();
	await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{4}$/);
	return { context, page, roomCode: page.url().split('/').pop()! };
}

async function joinRoom(browser: Browser, roomCode: string, name: string) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/');
	await page.getByLabel('Room code').fill(roomCode);
	await page.getByPlaceholder('Your name').fill(name);
	await page.getByRole('button', { name: 'Join' }).click();
	await expect(page).toHaveURL(`/lobby/${roomCode}`);
	return { context, page };
}

const toast = (page: Page) => page.getByRole('status').filter({ has: page.getByTestId('room-toast') });

test('the host passes the role from a row menu, and the whole room is told', async ({ browser }) => {
	const margaret = await createRoom(browser, 'Margaret');
	const joe = await joinRoom(browser, margaret.roomCode, 'Joe');
	const ann = await joinRoom(browser, margaret.roomCode, 'Ann');

	// Only the host gets the options button, and only on other people's rows.
	const options = margaret.page.getByRole('button', { name: 'Options for Joe', exact: true });
	await expect(options).toBeVisible();
	await expect(margaret.page.getByRole('button', { name: 'Options for Margaret', exact: true })).toHaveCount(0);
	await expect(joe.page.getByRole('button', { name: /^Options for / })).toHaveCount(0);
	// The action is not on the row until the menu opens.
	await expect(margaret.page.getByRole('button', { name: 'Make Joe the host', exact: true })).toHaveCount(0);

	// Escape closes the menu and returns focus to its button.
	await options.click();
	await expect(options).toHaveAttribute('aria-expanded', 'true');
	await expect(margaret.page.getByRole('button', { name: 'Make Joe the host', exact: true })).toBeFocused();
	await margaret.page.keyboard.press('Escape');
	await expect(options).toHaveAttribute('aria-expanded', 'false');
	await expect(options).toBeFocused();

	// Cancelling the confirmation changes nothing.
	await options.click();
	await margaret.page.getByRole('button', { name: 'Make Joe the host', exact: true }).click();
	const dialog = margaret.page.getByRole('dialog');
	await expect(dialog.getByText('Make Joe the host?', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(toast(ann.page)).toHaveCount(0);

	await options.click();
	await margaret.page.getByRole('button', { name: 'Make Joe the host', exact: true }).click();
	await margaret.page.getByRole('dialog').getByRole('button', { name: 'Make Joe host', exact: true }).click();

	await expect(toast(margaret.page)).toHaveText('You made Joe the host');
	await expect(toast(joe.page)).toHaveText("You're the host now");
	await expect(toast(ann.page)).toHaveText('Margaret made Joe the host');
	await expect(joe.page.getByRole('button', { name: 'Options for Margaret', exact: true })).toBeVisible();
	await expect(margaret.page.getByRole('button', { name: /^Options for / })).toHaveCount(0);

	// The notice leaves on its own.
	await expect(margaret.page.getByTestId('room-toast')).toHaveCount(0, { timeout: 6000 });

	for (const p of [margaret, joe, ann]) await p.context.close();
});

test('a host who drops is replaced after the grace window, and the room hears why', async ({ browser }) => {
	test.slow();
	const margaret = await createRoom(browser, 'Margaret');
	const joe = await joinRoom(browser, margaret.roomCode, 'Joe');
	const ann = await joinRoom(browser, margaret.roomCode, 'Ann');

	await margaret.context.close();
	// The hand-off waits 10s (hostGraceMs), so a reload keeps the role.
	await expect(toast(joe.page)).toHaveText("You're the host while Margaret is away", { timeout: 20_000 });
	await expect(toast(ann.page)).toHaveText('Joe is the host while Margaret is away');

	for (const p of [joe, ann]) await p.context.close();
});
