import { makeIo, makeSocket, RoomManager, setupLobbyHandlers, sleep } from './harness.mts';
const { quixxDefinition } = await import('../../../games/quixx/src/lib/server/definition.ts');

// Test 1: two bots, auto-roll -> does the game stall when a bot follows a bot?
{
  const io = makeIo(); const rm = new RoomManager(1000);
  const cb = quixxDefinition.createLobbyCallbacks(rm, io);
  const h = makeSocket(io, 'sH'); setupLobbyHandlers(io, h, rm, cb);
  let code = ''; h.fire('lobby:create', 'Host', (r: any) => { code = r.roomCode; });
  h.fire('lobby:addBot', () => {}); h.fire('lobby:addBot', () => {});
  h.fire('lobby:ready', true, () => {});
  h.fire('lobby:startGame', () => {});
  const hid = h.data.playerId;
  // Human always passes; plays a few turns
  const act = (a: any) => quixxDefinition.handleGameAction(io, h, rm, a);
  for (let i = 0; i < 40; i++) {
    await sleep(80);
    const e: any = rm.getGameData(code);
    const ph = e.getPhase(); const active = e.getPlayers()[e.getActivePlayerIndex()];
    if (ph === 'rolling' && active.id === hid) act({ type: 'roll-dice' });
    else if (ph === 'phase1' && e.getPlayers().find((p: any) => p.id === hid).phase1Decision === null) act({ type: 'phase1-pass' });
    else if (ph === 'phase2' && active.id === hid) act({ type: 'phase2-pass' });
  }
  const e: any = rm.getGameData(code);
  console.log('[T1 two bots] phase=', e.getPhase(), 'active=', e.getPlayers()[e.getActivePlayerIndex()].name, 'round=', (e as any).round);
}

// Test 2: restart during a bot's 600ms post-phase2 timer kills the new engine's bot timer
{
  const io = makeIo(); const rm = new RoomManager(1000);
  const cb = quixxDefinition.createLobbyCallbacks(rm, io);
  const h = makeSocket(io, 'sH'); setupLobbyHandlers(io, h, rm, cb);
  let code = ''; h.fire('lobby:create', 'Host', (r: any) => { code = r.roomCode; });
  h.fire('lobby:addBot', () => {});
  h.fire('lobby:ready', true, () => {});
  h.fire('lobby:startGame', () => {});
  const hid = h.data.playerId;
  const act = (a: any) => quixxDefinition.handleGameAction(io, h, rm, a);
  let restarted = false; let prevActiveBot = false;
  for (let i = 0; i < 3000 && !restarted; i++) {
    await sleep(1);
    const e: any = rm.getGameData(code);
    const ph = e.getPhase(); const active = e.getPlayers()[e.getActivePlayerIndex()];
    if (prevActiveBot && !active.isBot && ph === 'rolling') { h.fire('lobby:restartGame'); restarted = true; break; }
    prevActiveBot = active.isBot;
    if (ph === 'phase1' && e.getPlayers().find((p: any) => p.id === hid).phase1Decision === null) act({ type: 'phase1-pass' });
    else if (ph === 'phase2' && active.id === hid) act({ type: 'phase2-pass' });
    else if (ph === 'rolling' && active.id === hid) act({ type: 'roll-dice' });
  }
  const e2: any = rm.getGameData(code);
  console.log('[T2] restarted=', restarted);
  for (let i = 0; i < 30; i++) {
    await sleep(10);
    if (e2.getPhase() === 'phase1' && e2.getPlayers().find((p: any) => p.id === hid).phase1Decision === null) act({ type: 'phase1-pass' });
  }
  await sleep(500);
  console.log('[T2 after restart] phase=', e2.getPhase(), 'decisions=', JSON.stringify(e2.getPlayers().map((p: any) => [p.name, p.phase1Decision?.type ?? null])));
}
process.exit(0);
