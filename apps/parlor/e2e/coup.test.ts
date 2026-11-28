import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a Coup player takes an action', async ({ page }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Coup', exact: true }) });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Challenges and blocks' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
  await page.getByRole('button', { name: 'Add bot', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Bot Bob' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Game' }).click();

  // Answer anything the bots throw at us until it is our turn.
  const actions = page.getByRole('group', { name: 'Actions' });
  for (let step = 0; step < 30 && !(await actions.isVisible()); step++) {
    const letGo = page.getByRole('button', { name: 'Let it go' });
    const lose = page.getByRole('region', { name: 'Your cards' }).getByRole('button').first();
    if (await letGo.isVisible()) await letGo.click();
    else if (await lose.isVisible()) { await lose.click(); await lose.click(); }
    await page.waitForTimeout(500);
  }
  await expect(actions).toBeVisible();
  await actions.getByRole('button', { name: /^Income/ }).click();
  await page.getByRole('button', { name: 'Income: take 1 coin' }).click();
  await expect(page.getByRole('list', { name: 'Recent moves' })).toContainText('Alex takes Income.');
  await page.screenshot({ path: test.info().outputPath('board.png'), fullPage: true });
});
