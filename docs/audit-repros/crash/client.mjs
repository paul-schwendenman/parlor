import { createRequire } from 'node:module';
const req = createRequire(new URL('../../../apps/parlor/package.json', import.meta.url));
const { io } = req('socket.io-client');
const [,, scenario] = process.argv;
const s = io('http://localhost:' + process.env.PORT, { transports: ['websocket'], reconnection: false });
const ack = (ev, ...a) => new Promise((r) => s.emit(ev, ...a, (...x) => r(x)));
s.on('connect', async () => {
  const [created] = await ack('lobby:create', 'Host');
  console.log('[client] created', created.roomCode);
  if (scenario === 'ready-num') { s.emit('lobby:ready', true, 5); }
  if (scenario === 'start-num') { s.emit('lobby:startGame', 'x'); }
  if (scenario === 'select-num') { s.emit('lobby:selectGame', 'nope', 1); }
  if (scenario === 'ready-obj') { s.emit('lobby:ready', 'notbool', {}); }
  setTimeout(() => { console.log('[client] connected still?', s.connected); process.exit(0); }, 1500);
});
s.on('disconnect', (r) => console.log('[client] disconnect', r));
