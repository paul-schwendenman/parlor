import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Boggle player traces a word and finishes the round', async ({ page }) => {
  await page.goto('/games');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Boggle', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Find words' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: "Play Boggle", exact: true }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  const tiles = page.getByRole('group', { name: 'Letters' }).getByRole('button');
  await expect(tiles).toHaveCount(16);
  // Tapping touching cubes fills the word box.
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await tiles.nth(5).click();
  const input = page.getByPlaceholder('Type or tap letters');
  await expect(input).not.toHaveValue('');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('alert').or(page.getByRole('region', { name: 'Your words' }).getByRole('listitem')).first()).toBeVisible();
  await page.getByRole('button', { name: 'I’m done' }).click();
  await expect(page.getByRole('region', { name: 'Round results' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
