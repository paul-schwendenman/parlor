import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Fault Line player plants a cache and opens a rival cache', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Fault Line', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Plant a hidden cache' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Fault Line", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.getByRole('group', { name: 'Your caches' }).getByRole('button', { name: /^Fault/ }).click();
  await page.getByRole('button', { name: '1 offered' }).click();
  await page.getByRole('button', { name: 'Plant cache' }).click();
  await page.getByRole('group', { name: 'Rival caches' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Open cache', exact: true }).click();
  await expect(page.getByText('Caches revealed', { exact: true })).toBeVisible();
  const ownResult = page.getByRole('region', { name: 'Dig site' }).getByRole('listitem').filter({
    has: page.getByText('Alex', { exact: true }),
  });
  await expect(ownResult.getByText(/^Fault · Opened/)).toBeVisible();
});
