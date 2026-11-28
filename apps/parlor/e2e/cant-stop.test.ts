import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test("a Can't Stop player rolls, moves, and stops", async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: "Can't Stop", exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pair the dice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const roll = page.getByRole('button', { name: 'Roll', exact: true });
  await expect(roll).toBeVisible({ timeout: 20_000 });
  await roll.click();
  const pairings = page.getByRole('list', { name: 'Pairings' });
  const move = pairings.getByRole('button').first();
  const busted = page.getByText('Alex busted!');
  await expect(move.or(busted)).toBeVisible();
  if (await busted.isVisible()) return;
  await move.click();
  await move.click();
  await page.getByRole('button', { name: /^Stop/ }).click();
  await expect(page.getByRole('listitem', { name: /Alex marker/ }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
