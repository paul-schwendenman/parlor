import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * Regression coverage for the Phase 3 client reconnect chain:
 *  - a player who drops and returns must NOT see a false "game doesn't exist"
 *  - the game view is restored after reconnect
 *  - reconnecting a second time still works (the old one-shot latch broke this)
 */

async function createQuixxRoom(page: Page): Promise<string> {
  await page.goto('/');
  const quixxCard = page.locator('.game-card', { hasText: 'Quixx' });
  await quixxCard.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Host');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z0-9]{4}$/);
  return page.url().split('/').pop()!;
}

async function joinRoom(page: Page, roomCode: string, name: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('ABCD').fill(roomCode);
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(`/lobby/${roomCode}`);
}

/** Assert the guest is sitting in the live game, not the "not found" screen. */
async function expectInGame(page: Page, roomCode: string): Promise<void> {
  await expect(page).toHaveURL(`/game/${roomCode}`);
  await expect(page).toHaveTitle(/Playing/);
  // The game view (not the loading/"doesn't exist" placeholder) is mounted.
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("doesn't exist")).toHaveCount(0);
}

test.describe('Reconnect', () => {
  test('guest reconnects into an active game, twice, with no false "not found"', async ({
    browser,
  }) => {
    const hostContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createQuixxRoom(hostPage);
      await joinRoom(guestPage, roomCode, 'Guest');
      await expect(hostPage.getByText('Guest')).toBeVisible();

      // Both players ready up, host starts the game.
      await guestPage.getByRole('button', { name: 'Ready Up' }).click();
      await hostPage.getByRole('button', { name: 'Ready Up' }).click();
      const startBtn = hostPage.getByRole('button', { name: 'Start Game' });
      await expect(startBtn).toBeEnabled();
      await startBtn.click();

      await expect(hostPage).toHaveURL(`/game/${roomCode}`);
      await expectInGame(guestPage, roomCode);

      // Drop + restore the guest twice; each cycle must restore the game.
      for (let cycle = 0; cycle < 2; cycle++) {
        await guestContext.setOffline(true);
        await expect.poll(() => guestPage.evaluate(() => navigator.onLine)).toBe(false);

        await guestContext.setOffline(false);
        await expect.poll(() => guestPage.evaluate(() => navigator.onLine)).toBe(true);

        // Reload to clear in-memory stores and force the session-token
        // reconnect path — this is where the false "not found" used to flash.
        await guestPage.reload();
        await expectInGame(guestPage, roomCode);
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
