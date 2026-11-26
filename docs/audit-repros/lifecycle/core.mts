import { advance } from './vclock.mts';
import { makeIo, makeSocket, RoomManager, setupLobbyHandlers } from './fake.mts';
// T1: client reconnects on a new socket before the server notices the old socket died
{
  const io = makeIo(); const rm = new RoomManager(60000);
  const a = makeSocket(io, 'old'); setupLobbyHandlers(io, a, rm, {});
  let code = '', pid = '', tok = '';
  a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; pid = r.playerId; tok = r.reconnectToken; });
  const b = makeSocket(io, 'guest'); setupLobbyHandlers(io, b, rm, {}); b.fire('lobby:join', code, 'B', () => {});
  const a2 = makeSocket(io, 'new'); setupLobbyHandlers(io, a2, rm, {});
  let ok: any; a2.fire('player:reconnect', code, pid, tok, (s: boolean) => (ok = s));
  a.fire('disconnect'); // old transport finally times out (pingTimeout)
  console.log('[dup] reconnect ok', ok, 'A connected?', rm.getRoom(code).players.get(pid).connected);
  await advance(61000);
  console.log('[dup] after 61s A still in room?', rm.getRoom(code)?.players.has(pid), 'host now', rm.getRoom(code)?.hostId === pid ? 'A' : 'B');
}
// T2: last human leaves -> room destroyed, onGameReset never called
{
  const io = makeIo(); const rm = new RoomManager(60000);
  const calls: string[] = [];
  const cb = { onGameStart: () => calls.push('start'), onGameReset: () => calls.push('reset'), onPlayerRemoved: () => calls.push('removed') };
  const a = makeSocket(io, 'a'); setupLobbyHandlers(io, a, rm, cb);
  let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  a.fire('lobby:addBot', () => {}); a.fire('lobby:ready', true, () => {}); a.fire('lobby:startGame', () => {});
  a.fire('room:leave');
  console.log('[destroy-leave] room exists?', !!rm.getRoom(code), 'callbacks', calls);
  const a2 = makeSocket(io, 'a2'); setupLobbyHandlers(io, a2, rm, cb);
  a2.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  a2.fire('lobby:addBot', () => {}); a2.fire('lobby:ready', true, () => {}); a2.fire('lobby:startGame', () => {});
  a2.fire('disconnect'); await advance(61000);
  console.log('[destroy-expiry] room exists?', !!rm.getRoom(code), 'callbacks', calls);
}
// T3: room:leave of an in-game player does not call onPlayerRemoved
{
  const io = makeIo(); const rm = new RoomManager(60000); const calls: string[] = [];
  const cb = { onPlayerRemoved: () => calls.push('removed') };
  const a = makeSocket(io, 'a'); const b = makeSocket(io, 'b'); setupLobbyHandlers(io, a, rm, cb); setupLobbyHandlers(io, b, rm, cb);
  let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; }); b.fire('lobby:join', code, 'B', () => {});
  a.fire('lobby:ready', true, () => {}); b.fire('lobby:ready', true, () => {}); a.fire('lobby:startGame', () => {});
  b.fire('room:leave');
  console.log('[leave] onPlayerRemoved calls', calls.length, 'status', rm.getRoom(code).status);
  // T4: startGame while already playing (host) -> allowed?
  const r: any[] = []; a.fire('lobby:startGame', (ok: boolean, e?: string) => r.push([ok, e]));
  console.log('[start-while-playing, 1 player]', r);
}
// T5: spectator map after room destroy
{
  const io = makeIo(); const rm = new RoomManager(60000);
  const a = makeSocket(io, 'a'); setupLobbyHandlers(io, a, rm, {});
  let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  const s = makeSocket(io, 'spec'); setupLobbyHandlers(io, s, rm, {}); s.fire('lobby:spectate', code, () => {});
  a.fire('room:leave');
  console.log('[spec] room?', !!rm.getRoom(code), 'isSpectator still', rm.isSpectator('spec'));
}
process.exit(0);
