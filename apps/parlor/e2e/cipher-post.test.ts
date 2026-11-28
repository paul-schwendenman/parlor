import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Cipher Post player passes a seal, exposes another, and locks a guess', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Cipher Post', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pass a seal and reveal a clue' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Cipher Post", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const seals = page.getByRole('group', { name: 'Your seals' }).getByRole('button');
  await seals.first().click();
  await page.getByRole('button', { name: 'Send seal' }).click();
  await expect(page.getByRole('button', { name: 'Expose seal' })).toBeVisible();
  await seals.first().click();
  await page.getByRole('button', { name: 'Expose seal' }).click();
  await page.getByRole('group', { name: 'Exposed clues' }).getByRole('button', { name: /Bot/ }).click();
  await page.getByRole('group', { name: 'Guess value' }).getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Lock guess' }).click();
  await expect(page.getByText('Seals opened', { exact: true })).toBeVisible();
});
