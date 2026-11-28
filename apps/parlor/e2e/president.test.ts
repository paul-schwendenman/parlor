import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a President player selects and confirms a play on a phone', async ({ page }) => {
  await page.goto('/');
  const president = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'President', exact: true }) });
  await president.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Beat the standing set' })).toBeVisible();
  await page.keyboard.press('Escape');
  await president.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  for (let bot = 0; bot < 3; bot++) {
    await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  }
  await page.getByRole('button', { name: 'Start Game' }).click();

  const seats = page.getByRole('list', { name: 'Players' });
  await expect(seats.getByRole('listitem')).toHaveCount(4);
  const hand = page.getByRole('region', { name: /^Your hand/ });
  const playable = hand.locator('button:enabled');
  const pass = page.getByRole('button', { name: 'Pass', exact: true });
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 20_000 });
  // The first bot lead can be a set that this hand cannot beat.
  for (let attempts = 0; await playable.count() === 0 && attempts < 15; attempts++) {
    await pass.click();
    await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 20_000 });
  }
  const before = await hand.getByRole('button').count();
  // Select a card near the top of the stack so overlapping neighbours stay reachable.
  await playable.last().click();
  await page.getByRole('button', { name: /^Play (?!cards)/ }).click();
  await expect.poll(async () => await hand.getByRole('button').count() + await hand.getByRole('img').count())
    .toBeLessThan(before);
});
