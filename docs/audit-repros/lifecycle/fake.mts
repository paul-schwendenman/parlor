const R = '../../../packages/multiplayer/src/';
export const { RoomManager } = await import(R + 'RoomManager.ts');
export const { setupLobbyHandlers } = await import(R + 'lobbyHandlers.ts');
export function makeIo() {
  const log: any[] = [];
  return { log, to(room: string) { return { emit: (ev: string, ...args: any[]) => log.push({ room, ev, args }) }; } } as any;
}
export function makeSocket(io: any, id: string) {
  const h: Record<string, Function> = {};
  return { id, data: {} as any, recovered: false, on(ev: string, fn: Function) { h[ev] = fn; }, join() {}, leave() {},
    emit(ev: string, ...args: any[]) { io.log.push({ room: 'socket:' + id, ev, args }); },
    fire(ev: string, ...args: any[]) { return h[ev](...args); } } as any;
}
