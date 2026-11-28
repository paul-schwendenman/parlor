import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Skull player places a disc and opens the bidding', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Skull', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Bidding' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Skull", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  for (let bot = 0; bot < 2; bot++) await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const hand = page.getByRole('group', { name: 'Your hand' });
  await hand.getByRole('button', { name: 'Pick up a flower' }).first().click();
  await hand.getByRole('button', { name: 'Place a flower' }).click();
  await expect(page.getByRole('region', { name: 'Your discs' }).getByText('Your mat (only you see this)')).toBeVisible();
  // Bots go in turn; wait for our placing turn, or follow along if a bot opened.
  const start = page.getByRole('button', { name: 'Start a bid', disabled: false });
  const pass = page.getByRole('button', { name: 'Pass', exact: true, disabled: false });
  const reveal = page.getByText(/ of \d+ flowers?\b|Skull!|turned over/).first();
  await expect(start.or(pass).or(reveal).first()).toBeVisible({ timeout: 20_000 });
  if (await start.isVisible()) {
    await start.click();
    await page.getByRole('group', { name: 'Bids' }).getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'Bid 1' }).click();
  }
  // Pass whenever the bidding comes back round, until someone turns discs over.
  for (let turn = 0; turn < 10; turn++) {
    await expect(reveal.or(pass).first()).toBeVisible({ timeout: 20_000 });
    if (await reveal.isVisible()) break;
    await pass.click();
  }
  await expect(reveal).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
