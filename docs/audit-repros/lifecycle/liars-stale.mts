import { advance } from './vclock.mts';
import { makeIo, makeSocket, RoomManager, setupLobbyHandlers } from './fake.mts';
const G = '../../../games/liars-dice/src/lib/server/';
const { liarsDiceDefinition: def } = await import(G + 'definition.ts');
const { LiarsDiceEngine } = await import(G + 'game/LiarsDiceEngine.ts');
const tag = new WeakMap<object, number>(); let n = 0;
const orig = LiarsDiceEngine.prototype.getPlayerView;
LiarsDiceEngine.prototype.getPlayerView = function (id: string) { if (!tag.has(this)) tag.set(this, ++n); return { ...orig.call(this, id), __engine: tag.get(this) }; };
const io = makeIo(); const rm = new RoomManager(60000);
const cb = def.createLobbyCallbacks(rm, io);
const a = makeSocket(io, 'sA'); setupLobbyHandlers(io, a, rm, cb);
const b = makeSocket(io, 'sB'); setupLobbyHandlers(io, b, rm, cb);
let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
b.fire('lobby:join', code, 'B', () => {});
a.fire('lobby:ready', true, () => {}); b.fire('lobby:ready', true, () => {});
a.fire('lobby:startGame', () => {});
const e1: any = rm.getGameData(code);
const st = e1.getState(); const active = st.players[st.activePlayerIndex].id;
let otherS = b;
if (active === b.data.playerId) def.handleGameAction(io, b, rm, { type: 'bid', quantity: 1, faceValue: 2 });
def.handleGameAction(io, a, rm, { type: 'bid', quantity: 2, faceValue: 2 });
// other player (now active, bid exists) disconnects -> auto-challenge + 3s timer
otherS.fire('disconnect');
console.log('e1 phase after auto-challenge', e1.getState().phase);
// host resets + restarts within the 3s window (if host is still connected)
const host = otherS === a ? null : a; // only A is host
if (!host) { console.log('host was the disconnector; rerun'); process.exit(0); }
a.fire('lobby:restartGame');
const e2: any = rm.getGameData(code);
console.log('restart ok?', e2 && e2 !== e1, 'status', rm.getRoom(code).status);
const before = io.log.length;
await advance(3500);
const after = io.log.slice(before).filter((x: any) => x.ev === 'game:state');
console.log('game:state emits after restart:', after.map((x: any) => `to=${x.room.slice(0,6)} engine#${x.args[0].__engine} phase=${x.args[0].phase}`));
console.log('current engine is #', tag.get(e2) ?? '(never viewed)');
process.exit(0);
