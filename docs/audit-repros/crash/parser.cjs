const { createRequire } = require('node:module');
const r = createRequire(require('node:path').resolve(__dirname, '../../../node_modules/.pnpm/socket.io@4.8.3/node_modules/socket.io/package.json'));
const parser = r('socket.io-parser');
for (const depth of [1000, 10000, 100000, 400000]) {
  const nested = '['.repeat(depth) + ']'.repeat(depth);
  const pkt = '2["game:action",{"type":"play-card","card":{"suit":"hearts","rank":"5","x":' + nested + '}}]';
  const d = new parser.Decoder();
  let decoded;
  d.on('decoded', (p) => { decoded = p; });
  try { d.add(pkt); } catch (e) { console.log(depth, 'decode threw', e.message); continue; }
  try {
    const e = new parser.Encoder();
    e.encode({ type: 2, nsp: '/', data: ['game:state', { topDiscard: decoded.data[1].card }] });
    console.log(depth, 'bytes', pkt.length, 'decode ok, encode ok');
  } catch (e) { console.log(depth, 'bytes', pkt.length, 'decode ok, ENCODE threw', e.constructor.name, e.message); }
}
