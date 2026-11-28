import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Council Ledger player claims a permit and sees the outcome', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Council Ledger', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Challenge a claim' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Council Ledger", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const table = page.getByRole('region', { name: 'Council table' });
  await expect(table.getByRole('button', { name: 'Claim permit' }).or(table.getByRole('button', { name: 'Stand', exact: true }))).toBeVisible();
  const stand = table.getByRole('button', { name: 'Stand', exact: true });
  if (await stand.isVisible()) await stand.click();
  await table.getByRole('button', { name: /^Outreach/ }).click();
  await table.getByRole('button', { name: 'Claim permit' }).click();
  await expect(page.getByText('Alex claims Outreach', { exact: true })).toBeVisible();
  await expect(page.getByText(/^(Proposal accepted|Bluff caught)$/)).toBeVisible();
});
