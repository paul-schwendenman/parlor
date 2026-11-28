import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Farkle phone controls the dice while the shared screen follows the table', async ({ page }, testInfo) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Farkle', exact: true }),
  });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Scoring dice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  const displayPage = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open shared screen' }).click();
  const display = await displayPage;
  await display.setViewportSize({ width: 1600, height: 900 });
  await expect(display.getByRole('heading', { name: 'Waiting for Farkle' })).toBeVisible();
  await expect(display.getByRole('img', { name: /^Scan to join room/ })).toBeVisible();

  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/game\/[A-Z2-9]{4}$/);
  await expect(display.getByRole('heading', { name: 'Standings' })).toBeVisible();
  await expect(display.getByText('Up next')).toBeVisible();
  await display.reload();
  await expect(display.getByRole('heading', { name: 'Standings' })).toBeVisible();

  const roll = page.getByRole('button', { name: 'Roll 6' });
  await expect(roll).toBeEnabled({ timeout: 20_000 });
  await expect(display.getByRole('heading', { name: 'Alex’s turn' })).toBeVisible();
  await roll.click();
  const dice = display.getByRole('region', { name: 'Farkle dice table' });
  await expect(dice.getByRole('img', { name: /^Die showing/ })).toHaveCount(6);
  await expect(display.getByRole('button', { name: /^(Roll|Bank|Keep)/ })).toHaveCount(0);
  await expect(display.getByText('Disconnected from the server')).toHaveCount(0);
  await display.screenshot({ path: testInfo.outputPath('farkle-shared-screen.png'), animations: 'disabled' });
});
