import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a The Mind player focuses and plays a card', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'The Mind', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Low to high, together' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play The Mind", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await page.getByRole('button', { name: 'Ready' }).click();
  const play = page.getByRole('button', { name: /^Play \d+/ });
  const pile = page.getByLabel(/^Top of the pile/);
  // After the short breath, play straight away. The bot may land a lower card first.
  await expect(play).toBeEnabled({ timeout: 10_000 });
  await play.click();
  await expect(pile.or(page.getByText(/cleared|life lost/i)).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
