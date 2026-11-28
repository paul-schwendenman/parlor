import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Gin Rummy player draws and discards on a phone', async ({ page }) => {
  await page.goto('/games');
  const gin = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Gin Rummy', exact: true }) });
  await gin.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Make sets and runs' })).toBeVisible();
  await page.keyboard.press('Escape');
  await gin.getByRole('button', { name: "Play Gin Rummy", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const pass = page.getByRole('button', { name: 'Pass upcard' });
  const draw = page.getByRole('button', { name: /^Draw a card/ });
  await expect(pass.or(draw)).toBeEnabled({ timeout: 12_000 });
  if (await pass.isVisible()) await pass.click();
  await draw.click();
  const hand = page.getByRole('region', { name: 'Your hand, 11 cards' });
  const discard = hand.getByRole('button').last();
  await discard.click();
  await expect(discard).toHaveAttribute('aria-pressed', 'true');
  await discard.click();
  await expect(page.getByRole('region', { name: 'Your hand, 10 cards' })).toBeVisible();
});
