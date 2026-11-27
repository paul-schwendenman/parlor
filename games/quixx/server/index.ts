import express from 'express';
import { createServer } from 'http';
import { createSocketServer, registerHealthCheck, setupFatalProcessHandlers, setupGracefulShutdown } from '@parlor/multiplayer';
import { handler } from '../build/handler.js';
import { setupQuixxSocketHandlers } from '../src/lib/server/socket/socketServer.js';

setupFatalProcessHandlers();

const app = express();
const server = createServer(app);

const io = createSocketServer(server);

setupQuixxSocketHandlers(io);

// Probe route must be registered before the SvelteKit catch-all handler.
registerHealthCheck(app);

app.use(handler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Quixx server running on http://localhost:${PORT}`);
});

setupGracefulShutdown({ io, httpServer: server });
