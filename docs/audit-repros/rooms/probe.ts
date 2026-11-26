import { RoomManager } from '../../../packages/multiplayer/src/RoomManager.ts';
const rm = new RoomManager(50);
// 1. one socket creates many rooms
for (let i = 0; i < 5; i++) rm.createRoom('sockA', 'Host' + i);
const r = rm.handleDisconnect('sockA', () => {});
console.log('disconnect result room', r?.roomCode);
await new Promise((res) => setTimeout(res, 120));
// @ts-ignore
console.log('rooms alive after grace (expected 0 if no leak):', rm['rooms'].size, [...rm['rooms'].values()].map(x=>[...x.players.values()][0].connected));
// 2. spectate multiple rooms with one socket
const a = rm.createRoom('h1','H1').roomCode, b = rm.createRoom('h2','H2').roomCode;
rm.addSpectator(a,'spec'); rm.addSpectator(b,'spec');
rm.handleDisconnect('spec');
console.log('room A spectators after spec disconnect:', rm.getSpectatorsInRoom(a), 'B:', rm.getSpectatorsInRoom(b));
// 3. player who also spectates -> disconnect treated as spectator
const c = rm.createRoom('p1','P1');
rm.addSpectator(a,'p1');
const d = rm.handleDisconnect('p1');
console.log('player+spectator disconnect retained=', d?.retained, 'player connected=', [...rm.getRoom(c.roomCode)!.players.values()][0].connected);
// 4. setMaxPlayers below current
const e = rm.createRoom('x0','X0');
for (let i=1;i<6;i++) rm.joinRoom(e.roomCode,'x'+i,'X'+i);
for (const p of rm.getPlayersInRoom(e.roomCode)) rm.setPlayerReady(p.id,true);
console.log('6 players ready, canStart before', rm.canStartGame(e.roomCode));
rm.setMaxPlayers(e.roomCode, 5);
console.log('after setMaxPlayers(5): players', rm.getPlayersInRoom(e.roomCode).length, 'canStart', rm.canStartGame(e.roomCode));
// 5. 1MB name
const big = 'A'.repeat(1_000_000);
const f = rm.createRoom('big', big);
console.log('stored name length', rm.getPlayersInRoom(f.roomCode)[0].name.length);
// 6. code space
// @ts-ignore
console.log('code space', 32**4);
process.exit(0);
