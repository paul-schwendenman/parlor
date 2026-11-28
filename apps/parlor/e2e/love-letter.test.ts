import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Love Letter player plays a card', async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Love Letter', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'The cards' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Add bot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Bot Bob' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const banner = page.getByRole('status').filter({ hasText: /turn|round/ });
  await expect(banner.getByText('Your turn')).toBeVisible({ timeout: 30_000 });
  const hand = page.getByRole('region', { name: 'Your hand' });
  // Prefer a card that is not the Princess.
  const cards = hand.getByRole('button', { disabled: false });
  const safe = cards.filter({ hasNotText: 'Princess' }).first();
  await safe.click();
  const targets = page.getByRole('list', { name: /^Players/ }).getByRole('button');
  if (await targets.count()) {
    await targets.first().click();
    const guesses = page.getByRole('group', { name: 'Name a card' }).getByRole('button');
    if (await guesses.count()) await guesses.first().click();
    await page.getByRole('button', { name: /^(Guess|Play the)/ }).click();
  } else {
    await safe.click();
  }
  const chancellor = page.getByText('Keep one card');
  if (await chancellor.isVisible()) {
    const options = hand.getByRole('button');
    await options.nth(0).click();
    await options.nth(1).click();
    if (await page.getByRole('button', { name: /^Keep the/ }).count() === 0) await options.nth(2).click();
    await page.getByRole('button', { name: /^Keep the/ }).click();
  }
  await expect(page.getByRole('list', { name: /^Players/ }).getByRole('img', { name: /\d/ }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
