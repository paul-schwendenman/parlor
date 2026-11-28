import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Yahtzee player rolls, holds, and scores a box', async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Yahtzee', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fill one box' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeVisible({ timeout: 30_000 });
  await roll.click();
  const tray = page.getByRole('group', { name: 'Rolled dice' });
  await tray.getByRole('button').first().click();
  await expect(tray.getByRole('button', { pressed: true })).toHaveCount(1);
  const card = page.getByRole('region', { name: 'Your scorecard' });
  await card.getByRole('button', { name: /^Chance/ }).click();
  await page.getByRole('button', { name: /^Score \d+/ }).click();
  await expect(card.getByText(/^Chance/).locator('..')).not.toContainText('–');
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
