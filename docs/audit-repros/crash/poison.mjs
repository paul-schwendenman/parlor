import { createRequire } from 'node:module';
const req = createRequire(new URL('../../../apps/parlor/package.json', import.meta.url));
const { io } = req('socket.io-client');
const URL = 'http://localhost:' + process.env.PORT;
const mk = (name) => { const s = io(URL, { transports: ['websocket'], reconnection: false }); s.name = name; s.last = null;
  s.on('game:state', (st) => { s.last = st; s.states = (s.states||0)+1; });
  s.on('error', (m) => console.log(`[${name}] error:`, String(m).slice(0,80)));
  return s; };
const ack = (s, ev, ...a) => new Promise((r) => s.emit(ev, ...a, (...x) => r(x)));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const scenario = process.argv[2];
const a = mk('A'), b = mk('B');
await wait(300);
if (scenario === 'noroom') { a.emit('lobby:ready', true, 0); await wait(500); console.log('A connected?', a.connected); process.exit(0); }
const [c] = await ack(a, 'lobby:create', 'Alice');
console.log(await ack(a, 'lobby:selectGame', 'crazy-eights'));
await ack(b, 'lobby:join', c.roomCode, 'Bob');
await ack(a, 'lobby:ready', true); await ack(b, 'lobby:ready', true);
console.log('start', await ack(a, 'lobby:startGame'));
await wait(300);
const act = [a, b].find(s => s.last?.isActivePlayer); const other = act === a ? b : a;
if (scenario === 'nullaction') { act.emit('game:action', null); act.emit('game:action', { type: 'play-card', card: null }); await wait(300); console.log('alive', act.connected); process.exit(0); }
const card = act.last.playableCards[0];
if (!card) { console.log('no playable card, rerun'); process.exit(0); }
const D = 20000; const nestedStr = '['.repeat(D) + ']'.repeat(D);
const before = { a: a.states, b: b.states };
const raw = '2["game:action",{"type":"play-card","card":{"suit":' + JSON.stringify(card.suit) + ',"rank":' + JSON.stringify(card.rank) + ',"junk":' + nestedStr + '}}]';
console.log('raw packet bytes', raw.length, 'card', card);
act.io.engine.write(raw);
await wait(500);
console.log('after poison play: states received', { a: a.states - before.a, b: b.states - before.b });
// try to continue game: other player (now active, unless 8 played) draws
const b2 = { a: a.states, b: b.states };
other.emit('game:action', { type: 'draw-card' }); act.emit('game:action', { type: 'draw-card' });
await wait(500);
console.log('after draw attempts: states received', { a: a.states - b2.a, b: b.states - b2.b }, 'still connected', a.connected, b.connected);
process.exit(0);
