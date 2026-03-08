import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler } from '../build/handler.js';
import { setupParlorSocketHandlers } from '../src/lib/server/socketServer.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

setupParlorSocketHandlers(io);

app.use(handler);

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
  console.log(`Parlor server running on http://localhost:${PORT}`);
});
