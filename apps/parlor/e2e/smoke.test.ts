import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
	test('loads with branding and game cards', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Parlor' })).toBeVisible();
		await expect(page.getByText('Game night, anywhere')).toBeVisible();

		// Game cards are visible
		await expect(page.getByText('Quixx')).toBeVisible();
		await expect(page.getByText('Crazy Eights')).toBeVisible();
		await expect(page.getByText('Booty Dice')).toBeVisible();
		await expect(page.getByText("Liar's Dice")).toBeVisible();
		await expect(page.getByText('Kings Corner')).toBeVisible();
	});

	test('shows join section with inputs', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByPlaceholder('ABCD')).toBeVisible();
		await expect(page.getByPlaceholder('Your name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
	});
});

test.describe('Create Room Flow', () => {
	test('clicking a game opens the create room modal', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('button', { name: 'Start Game' }).first().click();

		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
	});

	test('creating a room navigates to lobby', async ({ page }) => {
		await page.goto('/');

		// Click "Start Game" on any game card
		await page.getByRole('button', { name: 'Start Game' }).first().click();

		// Fill in name and create
		await page.getByPlaceholder('Enter your name').fill('TestHost');
		await page.getByRole('button', { name: 'Create Room' }).click();

		// Should navigate to lobby
		await expect(page).toHaveURL(/\/lobby\/[A-Z0-9]{4}$/);

		// Lobby should show the player and host badge
		await expect(page.getByText('TestHost')).toBeVisible();
		await expect(page.getByText('Host', { exact: true })).toBeVisible();
	});
});

test.describe('Multiplayer Flow', () => {
	test('two players can join and see each other in lobby', async ({ browser }) => {
		// Player 1 (host) creates a room
		const hostContext = await browser.newContext();
		const hostPage = await hostContext.newPage();

		await hostPage.goto('/');
		await hostPage.getByRole('button', { name: 'Start Game' }).first().click();
		await hostPage.getByPlaceholder('Enter your name').fill('Host');
		await hostPage.getByRole('button', { name: 'Create Room' }).click();

		await expect(hostPage).toHaveURL(/\/lobby\/[A-Z0-9]{4}$/);

		// Extract room code from URL
		const roomCode = hostPage.url().split('/').pop()!;

		// Player 2 joins
		const guestContext = await browser.newContext();
		const guestPage = await guestContext.newPage();

		await guestPage.goto('/');
		await guestPage.getByPlaceholder('ABCD').fill(roomCode);
		await guestPage.getByPlaceholder('Your name').fill('Guest');
		await guestPage.getByRole('button', { name: 'Join' }).click();

		await expect(guestPage).toHaveURL(`/lobby/${roomCode}`);

		// Both players see each other
		await expect(hostPage.getByText('Guest')).toBeVisible();
		await expect(guestPage.getByText('Host', { exact: true })).toBeVisible();

		await hostContext.close();
		await guestContext.close();
	});

	test('host can start a game with a bot', async ({ page }) => {
		await page.goto('/');

		// Create a room with a bot-supporting game (Quixx)
		const quixxCard = page.locator('.game-card', { hasText: 'Quixx' });
		await quixxCard.getByRole('button', { name: 'Start Game' }).click();
		await page.getByPlaceholder('Enter your name').fill('Player1');
		await page.getByRole('button', { name: 'Create Room' }).click();

		await expect(page).toHaveURL(/\/lobby\/[A-Z0-9]{4}$/);

		// Add a bot
		await page.getByRole('button', { name: 'Add Bot' }).click();

		// Should see the bot in player list
		await expect(page.getByText('Bot')).toBeVisible();

		// Ready up
		await page.getByRole('button', { name: 'Ready Up' }).click();
		await expect(page.getByText('Ready').first()).toBeVisible();

		// Start the game
		await page.getByRole('button', { name: 'Start Game' }).click();

		// Should navigate to game page
		await expect(page).toHaveURL(/\/game\/[A-Z0-9]{4}$/);

		// Game view should load (generic check - "Playing" in title)
		await expect(page).toHaveTitle(/Playing/);
	});
});
