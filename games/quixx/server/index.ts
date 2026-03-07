import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler } from '../build/handler.js';
import { setupQuixxSocketHandlers } from '../src/lib/server/socket/socketServer.js';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

setupQuixxSocketHandlers(io);

app.use(handler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Quixx server running on http://localhost:${PORT}`);
});
