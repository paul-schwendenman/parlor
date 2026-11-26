import { advance, clock } from './vclock.mts';
import { makeIo, makeSocket, RoomManager, setupLobbyHandlers } from './fake.mts';
const { quixxDefinition } = await import('../../../games/quixx/src/lib/server/definition.ts');
const io = makeIo(); const rm = new RoomManager(60000);
const cb = quixxDefinition.createLobbyCallbacks(rm, io);
const h = makeSocket(io, 'sH'); setupLobbyHandlers(io, h, rm, cb);
let code = ''; h.fire('lobby:create', 'Host', (r: any) => { code = r.roomCode; });
h.fire('lobby:addBot', () => {}); h.fire('lobby:ready', true, () => {}); h.fire('lobby:startGame', () => {});
const hid = h.data.playerId; const act = (a: any) => quixxDefinition.handleGameAction(io, h, rm, a);
const e1: any = rm.getGameData(code);
await advance(500);           // auto-roll -> phase1
act({ type: 'phase1-pass' }); // human passes; bot timer pending
await advance(1300);          // bot phase1 -> resolve -> phase2 (human active idx0)
console.log('e1 phase', e1.getPhase(), 'active', e1.getActivePlayerIndex());
act({ type: 'phase2-pass' }); // human -> advanceTurn -> bot active, autoRoll(500)
await advance(500);           // e1 rolled, phase1, bot timer
act({ type: 'phase1-pass' });
for (let i=0;i<500;i++){ await advance(5); if (e1.getPhase()==='rolling' && e1.getActivePlayerIndex()===0) break; }
console.log('e1 phase', e1.getPhase(), 'active', e1.getActivePlayerIndex(), 't=', clock());
// Restart NOW, old 600ms timer still pending
h.fire('lobby:restartGame');
const e2: any = rm.getGameData(code);
console.log('new engine?', e1 !== e2);
await advance(500);  // e2 auto-roll -> phase1, e2 bot timer scheduled (700-1200ms)
console.log('e2 phase', e2.getPhase());
// old 600ms timer fires within this window -> scheduleBotActions(e1) -> clearBotTimers(room)
act({ type: 'phase1-pass' });
await advance(5000);
console.log('e2 after 5s: phase', e2.getPhase(), JSON.stringify(e2.getPlayers().map((p: any) => [p.name, p.phase1Decision?.type ?? null])));
await advance(120000);
console.log('e2 after 2min: phase', e2.getPhase());
const stale = io.log.filter((x:any)=>x.ev==='game:state' && x.t===undefined).length;
process.exit(0);
