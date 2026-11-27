import { RoomManager } from '../../../packages/multiplayer/src/RoomManager.ts';
const rm = new RoomManager(10);
const before = process.memoryUsage().heapUsed;
for (let i = 0; i < 300; i++) rm.createRoom('sockA', 'A'.repeat(999_000) + i); // distinct strings
rm.handleDisconnect('sockA', () => {});
await new Promise((r) => setTimeout(r, 100));
globalThis.gc?.();
// @ts-ignore
console.log('rooms', rm['rooms'].size, 'heap MB delta', ((process.memoryUsage().heapUsed - before)/1e6).toFixed(0));
// small-name rooms cost
const b2 = process.memoryUsage().heapUsed;
for (let i = 0; i < 100000; i++) rm.createRoom('sockB', 'n');
globalThis.gc?.();
console.log('100k small rooms heap MB', ((process.memoryUsage().heapUsed - b2)/1e6).toFixed(0));
// time to create rooms as code space fills
let t = Date.now(); for (let i = 0; i < 800000; i++) rm.createRoom('sockC','n'); console.log('900k total rooms, last 800k in ms', Date.now()-t);
t = Date.now(); for (let i = 0; i < 100000; i++) rm.createRoom('sockC','n'); console.log('next 100k (to ~1M) ms', Date.now()-t);
// @ts-ignore
console.log('rooms', rm['rooms'].size, 'free codes', 32**4 - rm['rooms'].size);
process.exit(0);
