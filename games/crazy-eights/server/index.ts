import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { buildSocketServerOptions, registerHealthCheck, setupGracefulShutdown } from '@parlor/multiplayer';
import { handler } from '../build/handler.js';
import { setupCrazyEightsSocketHandlers } from '../src/lib/server/socket/socketServer.js';

const app = express();
const server = createServer(app);

const io = new Server(server, buildSocketServerOptions());

setupCrazyEightsSocketHandlers(io);

// Probe route must be registered before the SvelteKit catch-all handler.
registerHealthCheck(app);

app.use(handler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Crazy Eights server running on http://localhost:${PORT}`);
});

setupGracefulShutdown({ io, httpServer: server });
