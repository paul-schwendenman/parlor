import { RoomManager } from '../../../packages/multiplayer/src/RoomManager.ts';
const rm = new RoomManager(50);
const { roomCode, playerId, reconnectToken } = rm.createRoom('old', 'H');
rm.joinRoom(roomCode, 'g', 'G');
// new socket reconnects while old socket not yet detected dead
console.log('reconnect ok', rm.handleReconnect(roomCode, playerId, reconnectToken, 'new'));
// old socket finally times out
const r = rm.handleDisconnect('old', (o) => console.log('EXPIRED', o));
console.log('old disconnect retained=', r?.retained);
await new Promise((res) => setTimeout(res, 120));
console.log('host still in room?', !!rm.getRoom(roomCode)?.players.get(playerId), 'socket new maps to', rm.getPlayerIdBySocket('new'));
process.exit(0);
