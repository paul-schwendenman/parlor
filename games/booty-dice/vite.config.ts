import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { ViteDevServer, Plugin } from 'vite';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webSocketServer: Plugin = {
  name: 'webSocketServer',
  configureServer(server: ViteDevServer) {
    if (!server.httpServer) return;

    const io = new Server(server.httpServer, {
      cors: { origin: '*' },
    });

    const socketServerPath = path.join(__dirname, 'src/lib/server/socket/socketServer.ts');

    server
      .ssrLoadModule(socketServerPath)
      .then((module) => {
        const { setupBootyDiceSocketHandlers } = module as {
          setupBootyDiceSocketHandlers: (io: Server) => void;
        };
        setupBootyDiceSocketHandlers(io);
        console.log('Booty Dice Socket.io server initialized');
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
  },
});
