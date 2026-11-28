import { test, expect, type Page, type WebSocket } from '@playwright/test';

/**
 * Inside the parlor app, a game's GameOverScreen must reuse the page's socket.
 * If it calls its standalone package's `getSocket()`, "Back to Lobby" opens a
 * second Socket.IO connection that reconnects with the shared session and
 * supersedes the page's main socket.
 *
 * The game is ended by the guest leaving: a 2-seat game ends by forfeit (3.9).
 */

async function createRoom(page: Page, game: string): Promise<string> {
  await page.goto('/');
  const card = page.locator('.game-card', { hasText: game });
  await card.getByRole('button', { name: /^Play / }).click();
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

for (const game of ['Crazy Eights', 'Quixx', 'Kings Corner']) {
  test(`${game}: Back to Lobby on the game-over screen reuses the page socket`, async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    try {
      const host = await hostContext.newPage();
      const guest = await guestContext.newPage();

      const sockets: WebSocket[] = [];
      host.on('websocket', (ws) => {
        if (ws.url().includes('/socket.io/')) sockets.push(ws);
      });

      const roomCode = await createRoom(host, game);
      await joinRoom(guest, roomCode, 'Guest');
      await guest.getByRole('button', { name: 'Ready', exact: true }).click();
      const start = host.getByRole('button', { name: 'Start Game' });
      await expect(start).toBeEnabled();
      await start.click();
      await expect(host).toHaveURL(`/game/${roomCode}`);
      await expect(guest).toHaveURL(`/game/${roomCode}`);

      await guest.getByRole('button', { name: 'Leave room' }).click();
      await guest.getByRole('dialog').getByRole('button', { name: 'Leave room' }).click();
      const back = host.getByRole('button', { name: 'Back to Lobby' });
      await expect(back).toBeVisible();

      const before = sockets.length;
      await back.click();

      // Give a stray second client time to connect and run its reconnect.
      await host.waitForTimeout(1500);
      expect.soft(sockets.length - before, 'no new socket opened by the game-over screen').toBe(0);
      expect.soft(sockets.filter((ws) => !ws.isClosed()).length, 'exactly one live socket').toBe(1);
      await expect(host).toHaveURL(`/lobby/${roomCode}`);

      // The page's own socket must still own the seat: the lobby stays usable.
      // Add bot is host-only and needs a seated, bound socket.
      await expect(host.getByRole('button', { name: 'Add bot to seat 2' })).toBeEnabled();
      await host.reload();
      await expect(host).toHaveURL(`/lobby/${roomCode}`);
      await expect(host.locator('.player-name', { hasText: 'Host' })).toBeVisible();

      await host.getByRole('button', { name: 'Change game', exact: true }).click();
      await expect(host.getByRole('heading', { name: 'Vote on a game' })).toBeVisible();
      // Any game the room fits can be played from its rules sheet.
      await host.getByRole('button', { name: `How to play ${game}`, exact: true }).click();
      await host.getByRole('dialog').getByRole('button', { name: `Play ${game}`, exact: true }).click();
      await expect(host.getByRole('heading', { name: game, exact: true })).toBeVisible();
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
}
