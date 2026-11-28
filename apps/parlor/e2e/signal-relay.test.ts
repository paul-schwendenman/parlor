import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Signal Relay player sends a private signal through a shared antenna', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Signal Relay', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Send signals together' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Signal Relay", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const hand = page.getByRole('group', { name: 'Your signals' }).getByRole('button');
  await expect(hand).toHaveCount(2);
  await expect(page.getByRole('timer')).toHaveText(/^[1-9]\d* s$/);
  await hand.first().click();
  await page.getByRole('button', { name: 'Use team reroute' }).click();
  await page.getByRole('button', { name: /^Antenna 1/ }).click();
  await expect(hand).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Use team reroute' })).toHaveCount(0);
});
