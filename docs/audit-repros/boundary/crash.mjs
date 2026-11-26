const M = '../../../packages/multiplayer/node_modules/';
const { Server } = await import(M + 'socket.io/dist/index.js');
const { io: ioc } = await import(M + 'socket.io-client/build/esm-debug/index.js').catch(() => import(M + 'socket.io-client/build/cjs/index.js'));
const { createServer } = await import('node:http');
const { RoomManager, setupLobbyHandlers } = await import('../../../packages/multiplayer/dist/index.js');
process.on('exit', (c) => console.log('process exit code', c));
const http = createServer();
const io = new Server(http);
const rm = new RoomManager();
io.on('connection', (s) => setupLobbyHandlers(io, s, rm, {}));
http.listen(0, () => {
  const port = http.address().port;
  const c = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
  c.on('connect', () => {
    console.log('client connected, sending lobby:ready(true, 1)');
    c.emit(process.argv[2] || 'lobby:ready', true, 1);
    setTimeout(() => { console.log('server still alive after 1s'); process.exit(0); }, 1000);
  });
});
