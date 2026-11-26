import express from 'express';
import { createServer } from 'http';
import { createSocketServer, registerHealthCheck, setupGracefulShutdown } from '@parlor/multiplayer';
import { handler } from '../build/handler.js';
import { setupParlorSocketHandlers } from '../src/lib/server/socketServer.js';

const app = express();
const server = createServer(app);

const io = createSocketServer(server);

setupParlorSocketHandlers(io);

// Probe route must be registered before the SvelteKit catch-all handler.
registerHealthCheck(app);

app.use(handler);

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
  console.log(`Parlor server running on http://localhost:${PORT}`);
});

setupGracefulShutdown({ io, httpServer: server });
