// Shared harness: scaled timers, fake io/socket driving real setupLobbyHandlers.
const origSetTimeout = globalThis.setTimeout;
export const SCALE = 20;
(globalThis as any).setTimeout = ((fn: any, ms?: number, ...a: any[]) =>
  origSetTimeout(fn, Math.max(0, Math.floor((ms ?? 0) / SCALE)), ...a)) as any;
export const sleep = (realMs: number) => new Promise((r) => origSetTimeout(r, realMs));

const R = '../../../packages/multiplayer/src/';
export const { RoomManager } = await import(R + 'RoomManager.ts');
export const { setupLobbyHandlers } = await import(R + 'lobbyHandlers.ts');

export type Emit = { room: string; ev: string; args: any[] };
export function makeIo() {
  const log: Emit[] = [];
  const io: any = {
    log,
    to(room: string) {
      return { emit: (ev: string, ...args: any[]) => log.push({ room, ev, args }) };
    },
  };
  return io;
}
export function makeSocket(io: any, id: string) {
  const handlers: Record<string, Function> = {};
  const s: any = {
    id, data: {}, recovered: false,
    on(ev: string, fn: Function) { handlers[ev] = fn; },
    join() {}, leave() {},
    emit(ev: string, ...args: any[]) { io.log.push({ room: 'socket:' + id, ev, args }); },
    fire(ev: string, ...args: any[]) { return handlers[ev](...args); },
  };
  return s;
}
