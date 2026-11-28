import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('rolls dice on a phone with a bot seated', async ({ page }) => {
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
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page).toHaveURL(/\/game\/[A-Z2-9]{4}$/);

  await page.getByRole('button', { name: 'Roll 6' }).click({ timeout: 20_000 });
  const dice = page.getByRole('button', { name: /^Die showing/ }).or(page.getByRole('img', { name: /^Die showing/ }));
  await expect(dice).toHaveCount(6);
});
