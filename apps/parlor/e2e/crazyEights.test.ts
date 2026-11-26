import { test, expect, type Page } from '@playwright/test';

/**
 * Plan 3.1b pilot: Crazy Eights is rendered from the `{ gameId, view }` envelope
 * (GameRenderer narrows on `gameId`, no cast). Both seats must see their own
 * hand and the shared table.
 */

async function createCrazyEightsRoom(page: Page): Promise<string> {
  await page.goto('/');
  const card = page.locator('.game-card', { hasText: 'Crazy Eights' });
  await card.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Host');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{6}$/);
  return page.url().split('/').pop()!;
}

async function joinRoom(page: Page, roomCode: string, name: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('ABCDEF').fill(roomCode);
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(`/lobby/${roomCode}`);
}

test('Crazy Eights renders each seat its own hand from the typed envelope', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    const roomCode = await createCrazyEightsRoom(hostPage);
    await joinRoom(guestPage, roomCode, 'Guest');
    await expect(hostPage.getByText('Guest')).toBeVisible();

    await guestPage.getByRole('button', { name: 'Ready Up' }).click();
    await hostPage.getByRole('button', { name: 'Ready Up' }).click();
    const startBtn = hostPage.getByRole('button', { name: 'Start Game' });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    for (const page of [hostPage, guestPage]) {
      await expect(page).toHaveURL(`/game/${roomCode}`);
      await expect(page.getByText('Unknown game type')).toHaveCount(0);
      await expect(page.locator('.discard-pile')).toBeVisible();
      // Two players are dealt seven cards each.
      await expect(page.locator('.hand .hand-card')).toHaveCount(7);
    }
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
