import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const req = createRequire(new URL('../../../apps/parlor/package.json', import.meta.url));
const { Server } = req('socket.io');
const { setupGracefulShutdown } = await import('../../../packages/multiplayer/src/server.ts');
const http = createServer((rq, rs) => { setTimeout(() => { rs.end('done'); console.log('[srv] slow response sent'); }, 2000); });
const io = new Server(http);
setupGracefulShutdown({ io, httpServer: http });
const t0 = Date.now();
process.on('exit', (c) => console.log('[srv] exit', c, 'after', Date.now() - t0, 'ms'));
http.listen(4712, async () => {
  fetch('http://localhost:4712/').then(r => r.text()).then(t => console.log('[cli] got', t)).catch(e => console.log('[cli] err', e.cause?.code || e.message));
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), 200);
});
