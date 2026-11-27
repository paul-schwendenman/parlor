import { test, expect, type Page } from '@playwright/test';

/**
 * Plan 3.1b pilot: Crazy Eights is rendered from the `{ gameId, view }` envelope
 * (GameRenderer narrows on `gameId`, no cast). Both seats must see their own
 * hand and the shared table.
 */

async function createRoom(page: Page, game = 'Crazy Eights'): Promise<string> {
  await page.goto('/');
  const card = page.locator('.game-card', { hasText: game });
  await card.getByRole('button', { name: 'Start Game' }).click();
  await page.getByPlaceholder('Enter your name').fill('Host');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{4}$/);
  return page.url().split('/').pop()!;
}

async function joinRoom(page: Page, roomCode: string, name: string): Promise<void> {
  await page.goto(`/?join=${roomCode}`);
  await expect(page.getByLabel('Room code')).toHaveValue(roomCode);
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(`/lobby/${roomCode}`);
}

test('Crazy Eights renders each seat its own hand from the typed envelope', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    const roomCode = await createRoom(hostPage);
    await joinRoom(guestPage, roomCode, 'Guest');
    await expect(hostPage.getByText('Guest', { exact: true })).toBeVisible();

    // The guest readies up; the host's START is their ready.
    await guestPage.getByRole('button', { name: 'Ready', exact: true }).click();
    const startBtn = hostPage.getByRole('button', { name: 'Start Game' });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    for (const page of [hostPage, guestPage]) {
      await expect(page).toHaveURL(`/game/${roomCode}`);
      await expect(page.getByText('Unknown game type')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Table' })).toBeVisible();
      // Two players are dealt seven cards each.
      await expect(page.locator('.hand .hand-card')).toHaveCount(7);
    }
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

async function watchRoom(page: Page, roomCode: string) {
  await page.goto(`/?join=${roomCode.toLowerCase()}`);
  await page.getByRole('button', { name: 'Watch as spectator' }).click();
}

test('a spectator can watch before play starts, leave, and rejoin a live game', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const watcherContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const watcher = await watcherContext.newPage();
    const roomCode = await createRoom(host);
    await joinRoom(guest, roomCode, 'Guest');

    await watchRoom(watcher, roomCode);
    await expect(watcher).toHaveURL(`/lobby/${roomCode}`);
    await expect(watcher.getByText('Watching as spectator')).toBeVisible();
    await expect(watcher.getByText('Guest', { exact: true })).toBeVisible();
    await expect(watcher.getByRole('button', { name: 'Ready', exact: true })).toHaveCount(0);

    await guest.getByRole('button', { name: 'Ready', exact: true }).click();
    await host.getByRole('button', { name: 'Start Game' }).click();

    await expect(watcher).toHaveURL(`/game/${roomCode}`);
    await expect(watcher.getByRole('region', { name: 'Table' })).toBeVisible();
    await expect(watcher.locator('.hand .hand-card')).toHaveCount(0);
    await watcher.getByRole('button', { name: 'Leave room' }).click();
    await expect(watcher).toHaveURL('/');

    await watchRoom(watcher, roomCode);
    await expect(watcher).toHaveURL(`/game/${roomCode}`);
    await expect(watcher.getByRole('region', { name: 'Table' })).toBeVisible();
    await expect(watcher.locator('.hand .hand-card')).toHaveCount(0);

    await guest.getByRole('button', { name: 'Leave room' }).click();
    await guest.getByRole('dialog').getByRole('button', { name: 'Leave room' }).click();
    await expect(guest).toHaveURL('/');
    await host.getByRole('button', { name: 'Leave room' }).click();
    await host.getByRole('dialog').getByRole('button', { name: 'Leave room' }).click();
    await expect(host).toHaveURL('/');
    await expect(watcher.getByText("This game doesn't exist or has ended.")).toBeVisible();
  } finally {
    await Promise.all([hostContext.close(), guestContext.close(), watcherContext.close()]);
  }
});

test('leaving the lobby removes the seat and transfers the host role', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const roomCode = await createRoom(host);
    await joinRoom(guest, roomCode, 'Guest');

    await host.getByRole('button', { name: 'Leave room' }).click();
    await host.getByRole('dialog').getByRole('button', { name: 'Leave room' }).click();
    await expect(host).toHaveURL('/');
    await expect(guest.getByText('Host', { exact: true })).toHaveCount(1);
    // The new host is alone, so their one shouted button invites, not START.
    await expect(guest.locator('.actions').getByRole('button', { name: 'Copy invite link', exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Start Game' })).toHaveCount(0);

    await host.reload();
    await joinRoom(host, roomCode, 'Host');
    await expect(guest.getByText('Host', { exact: true })).toHaveCount(2);
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});

test('a Quixx spectator sees the table without a player scoresheet', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const watcherContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const watcher = await watcherContext.newPage();
    const roomCode = await createRoom(host, 'Quixx');
    await host.getByRole('button', { name: 'Add bot to seat 2' }).click();
    await host.getByRole('button', { name: 'Start Game' }).click();
    await expect(host).toHaveURL(`/game/${roomCode}`);

    await watchRoom(watcher, roomCode);
    await expect(watcher).toHaveURL(`/game/${roomCode}`);
    await expect(watcher.getByText('Watching as spectator')).toBeVisible();
    await expect(watcher.getByRole('list', { name: 'Players' })).toBeVisible();
    await expect(watcher.getByText(/Bot Alice/)).toBeVisible();
    await expect(watcher.locator('.scoresheet')).toHaveCount(0);
  } finally {
    await Promise.all([hostContext.close(), watcherContext.close()]);
  }
});
