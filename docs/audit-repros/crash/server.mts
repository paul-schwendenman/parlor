import { createServer } from 'node:http';
// resolve socket.io from apps/parlor
import { createRequire } from 'node:module';
const req = createRequire(new URL('../../../apps/parlor/package.json', import.meta.url));
const { Server } = req('socket.io');
const { setupParlorSocketHandlers } = await import('../../../apps/parlor/src/lib/server/socketServer.ts');
const http = createServer();
const io = new Server(http, {});
setupParlorSocketHandlers(io);
process.on('exit', (c) => console.log('[server] exit code', c));
http.listen(Number(process.env.PORT), () => console.log('[server] listening', process.env.PORT));
