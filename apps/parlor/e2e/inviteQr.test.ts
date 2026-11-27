import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('the lobby shows a QR code of the invite link with the room code', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Create a room', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Your name').fill('Host');
	await dialog.getByRole('button', { name: 'Create Room' }).click();
	await expect(page.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
	const roomCode = new URL(page.url()).pathname.split('/').pop()!;

	const show = page.getByRole('button', { name: 'Show QR code', exact: true });
	await show.click();
	const sheet = page.getByRole('dialog', { name: 'Scan to join' });
	await expect(sheet).toBeVisible();
	const qr = sheet.getByRole('img', { name: `QR code for the invite link to room ${roomCode}` });
	await expect(qr).toBeVisible();
	expect(await qr.evaluate((el) => el.tagName.toLowerCase())).toBe('svg');
	expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(280);
	await expect(sheet.getByText(`Room code ${roomCode}`, { exact: true })).toBeAttached();
	await expect(sheet.locator('.tile')).toHaveText(roomCode.split(''));
	await expect(sheet.getByText('Scan with a phone camera to join.', { exact: true })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await expect(show).toBeFocused();
});
