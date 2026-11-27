// Virtual clock: deterministic setTimeout/setImmediate replacement.
type T = { id: number; at: number; fn: Function; args: any[] };
let now = 0; let seq = 0; const q: T[] = [];
export const pending = () => q.length;
(globalThis as any).setTimeout = (fn: Function, ms = 0, ...args: any[]) => {
  const t = { id: ++seq, at: now + Math.max(0, ms), fn, args }; q.push(t);
  return { id: t.id, unref() {}, ref() {}, [Symbol.toPrimitive]: () => t.id } as any;
};
(globalThis as any).clearTimeout = (h: any) => { if (!h) return; const i = q.findIndex((t) => t.id === h.id); if (i >= 0) q.splice(i, 1); };
(globalThis as any).setImmediate = (fn: Function, ...args: any[]) => (globalThis as any).setTimeout(fn, 0, ...args);
const flushMicro = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
export async function advance(ms: number) {
  const end = now + ms;
  await flushMicro();
  for (;;) {
    q.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = q[0];
    if (!t || t.at > end) break;
    q.shift(); now = t.at; t.fn(...t.args); await flushMicro();
  }
  now = end;
}
export const clock = () => now;
