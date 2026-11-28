import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Golf player reveals two cards and swaps a stock draw on a phone', async ({ page }) => {
  await page.goto('/games');
  const golf = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Golf', exact: true }) });
  await golf.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Set up your grid' })).toBeVisible();
  await page.keyboard.press('Escape');
  await golf.getByRole('button', { name: "Play Golf", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const grid = page.getByRole('group', { name: 'Your grid' });
  await grid.getByRole('button', { name: 'Slot 1: face down' }).click();
  await grid.getByRole('button', { name: 'Slot 4: face down' }).click();
  await page.getByRole('button', { name: /^Draw a card/ }).click();
  const slot = grid.getByRole('button', { name: 'Slot 2: face down' });
  await slot.click();
  await expect(slot).toHaveAttribute('aria-pressed', 'true');
  await slot.click();
  await expect(grid.getByRole('img')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Discard drawn card' })).toHaveCount(0);
});
