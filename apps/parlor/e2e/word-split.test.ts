import { expect, test } from '@playwright/test';
import { RACKS } from '../../../games/word-split/src/lexicon.js';

test.use({ viewport: { width: 390, height: 844 } });

test('two phones share a rack and reveal their words after finishing', async ({ page, browser }) => {
  await page.goto('/');
  const game = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Word Split', exact: true }),
  });
  await game.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Score unique finds' })).toBeVisible();
  await page.keyboard.press('Escape');
  await game.getByRole('button', { name: /^Play / }).click();
  await page.getByPlaceholder('Enter your name').fill('Alex');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{4}$/);
  const roomCode = new URL(page.url()).pathname.split('/').at(-1);
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open shared screen' }).click();
  const display = await popup;
  await display.setViewportSize({ width: 1440, height: 900 });
  await expect(display.getByRole('heading', { name: 'Waiting for Word Split' })).toBeVisible();


  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const guest = await context.newPage();
    await guest.goto('/?join=' + roomCode);
    await guest.getByLabel('Your name').fill('Blair');
    await guest.getByRole('button', { name: 'Join', exact: true }).click();
    await guest.getByRole('button', { name: 'Ready', exact: true }).click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(guest).toHaveURL(/\/game\/[A-Z2-9]{4}$/);
    const tiles = (player: typeof page) => player.getByRole('list', { name: 'Available letters' }).getByRole('listitem');
    await expect(tiles(page)).toHaveCount(8);
    await expect(display.getByRole('list', { name: 'Shared letters' }).getByRole('listitem')).toHaveCount(8);
    await expect(display.getByRole('timer', { name: 'Round time remaining' })).toBeVisible();
    await expect(tiles(guest)).toHaveText(await tiles(page).allTextContents());
    const signature = (letters: string) => [...letters].sort().join('');
    const rack = signature((await tiles(page).allTextContents()).join('').toLowerCase());
    const word = RACKS.find((candidate) => signature(candidate) === rack);
    if (!word) throw new Error('Expected a word using the eight tiles');

    await page.getByLabel('Your word').fill(word);
    await page.getByRole('button', { name: 'Add word' }).click();
    await expect(page.getByRole('region', { name: 'Your submitted words' })).toContainText(word);
    await expect(guest.getByText(word, { exact: true })).toHaveCount(0);
    await expect(display.getByText(word, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Finish round' }).click();
    await guest.getByRole('button', { name: 'Finish round' }).click();
    const results = guest.getByRole('region', { name: 'Round results' });
    await expect(results).toContainText(word);
    await expect(results).toContainText('+8');
    await expect(display.getByRole('list', { name: 'Revealed words' })).toContainText(word);
  } finally {
    await context.close();
  }
});
