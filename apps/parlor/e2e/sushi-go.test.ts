import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Sushi Go player picks a card and sees it revealed', async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Sushi Go', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pick and pass' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Add bot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Bot Bob' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const hand = page.getByRole('region', { name: 'Your hand' });
  await expect(hand.getByRole('button')).toHaveCount(9);
  const card = hand.getByRole('button').first();
  await card.click();
  await card.click();
  await expect(page.getByRole('region', { name: 'Your plate' }).getByRole('img')).toHaveCount(1, { timeout: 10_000 });
  await expect(hand.getByRole('button')).toHaveCount(8, { timeout: 10_000 });
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
