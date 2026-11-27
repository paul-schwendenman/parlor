import { advance, pending } from './vclock.mts';
import { makeIo, makeSocket, RoomManager, setupLobbyHandlers } from './fake.mts';
const G = '../../../games/booty-dice/src/lib/server/';
const { bootyDiceDefinition: def } = await import(G + 'definition.ts');
const { GameEngine } = await import(G + 'game/GameEngine.ts');
const tag = new WeakMap<object, number>(); let n = 0;
const orig = GameEngine.prototype.getPlayerView;
GameEngine.prototype.getPlayerView = function (id: string) { if (!tag.has(this)) tag.set(this, ++n); return { ...orig.call(this, id), __engine: tag.get(this) }; };

async function setup(botsFirst = true) {
  const io = makeIo(); const rm = new RoomManager(60000);
  const cb = def.createLobbyCallbacks(rm, io);
  const a = makeSocket(io, 'sA'); setupLobbyHandlers(io, a, rm, cb);
  let code = ''; a.fire('lobby:create', 'A', (r: any) => { code = r.roomCode; });
  a.fire('lobby:addBot', () => {}); a.fire('lobby:addBot', () => {});
  a.fire('lobby:ready', true, () => {});
  return { io, rm, cb, a, code };
}

// T1: double lobby:startGame (double click) -> two engines, both alive
{
  const { io, rm, a, code } = await setup();
  const r: any[] = [];
  a.fire('lobby:startGame', (ok: boolean) => r.push(ok));
  const e1 = rm.getGameData(code);
  a.fire('lobby:startGame', (ok: boolean) => r.push(ok));
  const e2 = rm.getGameData(code);
  console.log('[T1] acks', r, 'engines differ', e1 !== e2, 'gameStarting emits', io.log.filter((x: any) => x.ev === 'lobby:gameStarting').length);
}

// T2: reset mid AI turn -> old engine keeps acting/broadcasting into the lobby
{
  const { io, rm, a, code } = await setup();
  a.fire('lobby:startGame', () => {});
  const e1: any = rm.getGameData(code);
  const st = e1.getState();
  console.log('[T2] first player', st.players[st.currentPlayerIndex].name);
  // make human end turn if human first so a bot turn starts
  if (!st.players[st.currentPlayerIndex].isAI) {
    def.handleGameAction(io, a, rm, { type: 'roll' });
    def.handleGameAction(io, a, rm, { type: 'finishRolling' });
    const s2 = e1.getState();
    for (const pa of s2.pendingActions) if (!pa.resolved) def.handleGameAction(io, a, rm, { type: 'selectTarget', dieIndex: pa.dieIndex, targetPlayerId: s2.players.find((p: any) => p.isAI).id });
    def.handleGameAction(io, a, rm, { type: 'endTurn' });
  }
  await advance(100); // bot started thinking
  a.fire('lobby:resetGame');
  console.log('[T2] status after reset', rm.getRoom(code).status, 'gameData', rm.getGameData(code));
  const mark = io.log.length;
  await advance(60000);
  const stale = io.log.slice(mark).filter((x: any) => x.ev === 'game:state');
  console.log('[T2] game:state emits AFTER reset (room is in lobby):', stale.length, 'engines', [...new Set(stale.map((x: any) => x.args[0].__engine))]);
}
process.exit(0);
