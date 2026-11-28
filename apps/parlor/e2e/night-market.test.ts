import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Night Market player sells one good and receives a smaller hand', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Night Market', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Draft, then pass' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Night Market", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const hand = page.getByRole('group', { name: 'Your goods' }).getByRole('button');
  await expect(hand).toHaveCount(5);
  await hand.first().click();
  await page.getByRole('button', { name: /^Sell for / }).click();
  await expect(page.getByText('Goods revealed')).toBeVisible();
  await expect(hand).toHaveCount(4);
  await expect(page.getByText('Season 1/3 · Pick 2/4')).toBeVisible();
});
