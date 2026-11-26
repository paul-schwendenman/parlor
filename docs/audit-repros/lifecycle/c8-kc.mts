import { advance } from './vclock.mts';
import { makeIo, makeSocket, RoomManager, setupLobbyHandlers } from './fake.mts';
const { crazyEightsDefinition: c8 } = await import('../../../games/crazy-eights/src/lib/server/definition.ts');
const { kingsCornerDefinition: kc } = await import('../../../games/kings-corner/src/lib/server/definition.ts');

// C8: three humans; C (not active) disconnects, grace expires -> removed from room, engine keeps seat
{
  const io = makeIo(); const rm = new RoomManager(60000); const cb = c8.createLobbyCallbacks(rm, io);
  const s = ['A', 'B', 'C'].map((n) => { const k = makeSocket(io, 's' + n); setupLobbyHandlers(io, k, rm, cb); return k; });
  let code = ''; s[0].fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  s[1].fire('lobby:join', code, 'B', () => {}); s[2].fire('lobby:join', code, 'C', () => {});
  s.forEach((k) => k.fire('lobby:ready', true, () => {}));
  s[0].fire('lobby:startGame', () => {});
  const e: any = rm.getGameData(code);
  s[2].fire('disconnect');
  await advance(61000);
  console.log('[C8] room players', rm.getPlayersInRoom(code).map((p: any) => p.name), 'engine players', e.getPlayers().map((p: any) => `${p.name}:${p.connected}`));
  // A and B take draw+pass turns until it's C's turn
  for (let i = 0; i < 4; i++) {
    const v = e.getPlayerView(s[0].data.playerId);
    const idx = (e as any).activePlayerIndex; const actor = s[idx];
    if (idx === 2) break;
    try { c8.handleGameAction(io, actor, rm, { type: 'draw-card' }); } catch {}
    try { c8.handleGameAction(io, actor, rm, { type: 'pass' }); } catch {}
  }
  console.log('[C8] active seat now', (e as any).activePlayerIndex, '=', e.getPlayers()[(e as any).activePlayerIndex].name, '(removed player; nobody can act) phase', (e as any).phase);
}

// KC: [A, B, bot]; A room:leave mid-game -> room index != engine index
{
  const io = makeIo(); const rm = new RoomManager(60000); const cb = kc.createLobbyCallbacks(rm, io);
  const a = makeSocket(io, 'sA'); const b = makeSocket(io, 'sB'); setupLobbyHandlers(io, a, rm, cb); setupLobbyHandlers(io, b, rm, cb);
  let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  b.fire('lobby:join', code, 'B', () => {}); a.fire('lobby:addBot', () => {});
  a.fire('lobby:ready', true, () => {}); b.fire('lobby:ready', true, () => {});
  a.fire('lobby:startGame', () => {});
  const e: any = rm.getGameData(code);
  // A ends turn (draw then end)
  kc.handleGameAction(io, a, rm, { type: 'draw-card' });
  try { kc.handleGameAction(io, a, rm, { type: 'end-turn' }); } catch {}
  console.log('[KC] active after A', e.getActivePlayerIndex());
  // Now B leaves? Instead: A leaves (room:leave) while B active
  a.fire('room:leave');
  kc.handleGameAction(io, b, rm, { type: 'draw-card' });
  kc.handleGameAction(io, b, rm, { type: 'end-turn' });
  console.log('[KC] engine active idx', e.getActivePlayerIndex(), 'engine player', e.getPlayerView(b.data.playerId).players[e.getActivePlayerIndex()].name, 'room players', rm.getPlayersInRoom(code).map((p: any) => p.id));
  await advance(120000);
  console.log('[KC] after 2 min: active idx', e.getActivePlayerIndex(), 'phase', e.getPlayerView(b.data.playerId).phase);
}
process.exit(0);
