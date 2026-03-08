import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler } from '../build/handler.js';
import { setupLiarsDiceSocketHandlers } from '../src/lib/server/socket/socketServer.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

setupLiarsDiceSocketHandlers(io);

app.use(handler);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Liar's Dice server running on http://localhost:${PORT}`);
});
