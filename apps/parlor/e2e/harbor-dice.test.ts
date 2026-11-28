import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Harbor Dice player holds a die, rerolls, and records a category', async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Harbor Dice', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Roll and hold' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.getByRole('button', { name: 'Roll dice' }).click();
  const first = page.getByRole('group', { name: 'Rolled dice' }).getByRole('button').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const face = await first.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Reroll · 2 left' }).click();
  await expect(page.getByRole('button', { name: 'Reroll · 1 left' })).toBeEnabled();
  await expect(first).toHaveAttribute('aria-label', face!);
  await page.getByRole('region', { name: 'Scorecard' }).getByRole('button', { name: /^Score / }).first().click();
  await expect(page.getByText(/^Alex scored /)).toBeVisible();
});
