import { test, expect } from '@playwright/test';

test('the host can pass the host role to another player', async ({ browser }) => {
	const hostContext = await browser.newContext();
	const hostPage = await hostContext.newPage();
	await hostPage.goto('/');
	await hostPage.getByRole('button', { name: 'Start Game' }).first().click();
	await hostPage.getByPlaceholder('Enter your name').fill('Alex');
	await hostPage.getByRole('button', { name: 'Create Room' }).click();
	await expect(hostPage).toHaveURL(/\/lobby\/[A-Z2-9]{6}$/);
	const roomCode = hostPage.url().split('/').pop()!;

	const guestContext = await browser.newContext();
	const guestPage = await guestContext.newPage();
	await guestPage.goto('/');
	await guestPage.getByPlaceholder('ABCDEF').fill(roomCode);
	await guestPage.getByPlaceholder('Your name').fill('Joe');
	await guestPage.getByRole('button', { name: 'Join' }).click();
	await expect(guestPage).toHaveURL(`/lobby/${roomCode}`);

	// Only the host sees the options, and only on other people's rows.
	const joeOptions = hostPage.getByRole('button', { name: 'Options for Joe', exact: true });
	await expect(joeOptions).toBeVisible();
	await expect(hostPage.getByRole('button', { name: 'Options for Alex', exact: true })).toHaveCount(0);
	await expect(guestPage.getByRole('button', { name: /^Options for / })).toHaveCount(0);
	const makeJoe = hostPage.getByRole('button', { name: 'Make Joe the host', exact: true });

	// Cancelling changes nothing.
	await joeOptions.click();
	await makeJoe.click();
	const dialog = hostPage.getByRole('dialog');
	await expect(dialog.getByText('Make Joe the host?', { exact: true })).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(joeOptions).toBeVisible();

	// Confirming moves the role: Joe gets the host controls, Alex loses them.
	await joeOptions.click();
	await makeJoe.click();
	await hostPage.getByRole('dialog').getByRole('button', { name: 'Make Joe host', exact: true }).click();
	await expect(guestPage.getByRole('button', { name: 'Options for Alex', exact: true })).toBeVisible();
	await expect(hostPage.getByRole('button', { name: /^Options for / })).toHaveCount(0);

	await hostContext.close();
	await guestContext.close();
});
