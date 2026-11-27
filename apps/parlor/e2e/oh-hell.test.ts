import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('bids and plays through the first Oh Hell hand with bots', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Your name').fill('Alex');
  await dialog.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: 'Vote for Oh Hell', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Oh Hell', exact: true }).click();
  const addBot = page.getByRole('button', { name: 'Add bot' });
  await addBot.click();
  await addBot.click();
  await page.getByRole('button', { name: 'Ready', exact: true }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.getByText('Hand 1 of 9', { exact: false })).toBeVisible();
  await page.getByRole('region', { name: 'Choose a bid' }).getByRole('button').first().click();
  const hand = page.getByRole('region', { name: 'Your hand, 1 card', exact: true });
  await hand.getByRole('button').click();
  await expect(page.getByText('Hand scores', { exact: true })).toBeVisible();
  await expect(page.getByText('Hand 2 of 9', { exact: false })).toBeVisible({ timeout: 10_000 });
});
