import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('bids and plays through the first Oh Hell hand with bots', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your name').fill('Alex');
  await dialog.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: 'Vote for Oh Hell', exact: true }).click();
  // Alone, the bottom bar invites; a bot makes two and PLAY comes back.
  await page.locator('.table-strip').getByRole('button', { name: 'Add bot', exact: true }).click();
  // The host's one Play button follows the leading game.
  await page.getByRole('button', { name: 'Play Oh Hell', exact: true }).click();
  // Each open seat has its own "Add bot to seat N"; the host's START is their ready.
  const addBot = page.getByRole('button', { name: /^Add bot to seat/ }).first();
  for (let count = 2; count <= 2; count++) {
    await addBot.click();
    await expect(page.getByRole('button', { name: /^Remove Bot / })).toHaveCount(count);
  }
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.getByText('Hand 1 of 9', { exact: false })).toBeVisible();
  await page.getByRole('region', { name: 'Choose a bid' }).getByRole('button').first().click();
  const hand = page.getByRole('region', { name: 'Your hand, 1 card', exact: true });
  // The first tap lifts the card; the second plays it.
  const card = hand.getByRole('button');
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await card.click();
  await expect(page.getByText('Hand scores', { exact: true })).toBeVisible();
  await expect(page.getByText('Hand 2 of 9', { exact: false })).toBeVisible({ timeout: 10_000 });
});
