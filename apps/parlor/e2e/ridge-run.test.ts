import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Ridge Run player climbs and banks their steps', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Ridge Run', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Climb a route' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Ridge Run", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.getByRole('button', { name: 'Roll dice' }).click();
  await page.getByRole('button', { name: /^Route / }).first().click();
  const mountain = page.getByRole('region', { name: 'Mountain routes' });
  await expect(mountain.getByRole('img', { name: /^Unbanked step/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Make camp' }).click();
  await expect(mountain.getByRole('img', { name: /^Alex, step/ })).toHaveCount(1);
  await expect(mountain.getByRole('img', { name: /^Unbanked step/ })).toHaveCount(0);
});
