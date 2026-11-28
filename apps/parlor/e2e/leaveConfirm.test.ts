import { test, expect, type Browser } from '@playwright/test';

// Plan 9.6: Leave room asks first, naming the code to rejoin with, and tells
// the host who takes over. A spectator leaves without a question.

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

test('leaving asks first, and says what happens to the room', async ({ browser }) => {
	const margaret = await createRoom(browser, 'Margaret');
	const { roomCode } = margaret;

	// Alone, the host is told the room closes.
	await margaret.page.getByRole('button', { name: 'Leave room' }).click();
	let dialog = margaret.page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: 'Leave your room?' })).toBeVisible();
	await expect(dialog).toContainText('No one else is here, so the room closes.');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toHaveCount(0);

	const joe = await joinRoom(browser, roomCode, 'Joe');

	// With someone else here, the host learns who takes over.
	await margaret.page.getByRole('button', { name: 'Leave room' }).click();
	dialog = margaret.page.getByRole('dialog');
	await expect(dialog).toContainText(`Joe will become the host. You can rejoin with the code ${roomCode}.`);
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	// A guest's question names the host's room and the code; Cancel keeps them in.
	await joe.page.getByRole('button', { name: 'Leave room' }).click();
	dialog = joe.page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: "Leave Margaret's room?" })).toBeVisible();
	await expect(dialog).toContainText(`You can rejoin with the code ${roomCode}.`);
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(joe.page).toHaveURL(`/lobby/${roomCode}`);

	// Confirming leaves as before.
	await joe.page.getByRole('button', { name: 'Leave room' }).click();
	await joe.page.getByRole('dialog').getByRole('button', { name: 'Leave room' }).click();
	await expect(joe.page).toHaveURL('/');
	await expect(margaret.page.getByText('Joe', { exact: true })).toHaveCount(0);

	await margaret.context.close();
	await joe.context.close();
});

test('a spectator leaves without a confirmation', async ({ browser }) => {
	const margaret = await createRoom(browser, 'Margaret');
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/');
	await page.getByLabel('Room code').fill(margaret.roomCode);
	await page.getByRole('button', { name: 'Watch as spectator' }).click();
	await expect(page).toHaveURL(`/lobby/${margaret.roomCode}`);

	await page.getByRole('button', { name: 'Leave room' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('dialog')).toHaveCount(0);

	await margaret.context.close();
	await context.close();
});
