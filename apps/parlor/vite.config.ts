import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { ViteDevServer, Plugin } from 'vite';
import { createSocketServer, type AppServer } from '@parlor/multiplayer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webSocketServer: Plugin = {
  name: 'webSocketServer',
  configureServer(server: ViteDevServer) {
    if (!server.httpServer) return;

    const io = createSocketServer(server.httpServer);

    const socketServerPath = path.join(__dirname, 'src/lib/server/socketServer.ts');

    server
      .ssrLoadModule(socketServerPath)
      .then((module) => {
        const { setupParlorSocketHandlers } = module as {
          setupParlorSocketHandlers: (io: AppServer) => void;
        };
        setupParlorSocketHandlers(io);
        console.log('Parlor Socket.io server initialized');
      })
      .catch((err: unknown) => {
        console.error('Failed to load socket server:', err);
      });
  },
};

export default defineConfig({
  plugins: [sveltekit(), webSocketServer],
  server: {
    host: true,
    port: 3010,
  },
});
