import { expect, test } from '@playwright/test';

const games = [
  { name: "Liar's Dice", bots: 1, sidebar: 'Dice remaining' },
  { name: "Quixx", bots: 1, sidebar: "Standings" },
  { name: "Booty Dice", bots: 1, sidebar: "Crews" },
  { name: "Kings Corner", bots: 1, sidebar: "Cards remaining" },
  { name: "Crazy Eights", bots: 1, sidebar: "Cards remaining" },
  { name: "Hearts", bots: 3, sidebar: "Standings" },
  { name: "Spades", bots: 3, sidebar: "Team scores" },
  { name: "Euchre", bots: 3, sidebar: "Team scores" },
  { name: "Oh Hell", bots: 2, sidebar: "Standings" },
];

for (const { name, bots, sidebar } of games) {
  test(`${name} shows its public table on a shared screen`, async ({ page }) => {
    await page.goto('/');
    const game = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await game.getByRole('button', { name: 'Start a room' }).click();
    await page.getByPlaceholder('Enter your name').fill('Alex');
    await page.getByRole('button', { name: 'Create Room' }).click();

    const popup = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Open shared screen' }).click();
    const display = await popup;
    await display.setViewportSize({ width: 1440, height: 900 });
    await expect(display.getByRole('heading', { name: `Waiting for ${name}` })).toBeVisible();

    for (let count = 1; count <= bots; count++) {
      await page.getByRole('button', { name: /^Add bot to seat/ }).first().click();
      await expect(page.getByRole('button', { name: /^Remove Bot / })).toHaveCount(count);
    }
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(display.getByRole('region', { name: 'Public table' })).toBeVisible();
    await expect(display.getByRole('heading', { name: sidebar })).toBeVisible();
    await expect(display.getByRole('button', { name: 'Full screen' })).toBeVisible();
    await expect(display.getByRole('button')).toHaveCount(1);
  });
}
