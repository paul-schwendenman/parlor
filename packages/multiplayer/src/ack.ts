// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

/**
 * Normalize a client-supplied acknowledgement callback.
 *
 * socket.io hands a handler whatever the client sent in the ack position: a real
 * ack function only if the client asked for one, otherwise any JSON value
 * (`emit('lobby:ready', true, 1)` delivers `1`). `callback?.()` only skips
 * null/undefined, so calling a non-function throws inside socket.io's dispatch,
 * which has no try/catch, and takes down the whole process (CORE-AUDIT F-01).
 *
 * Always wrap acks with this before calling them.
 */
export function safeAck<T extends (...args: never[]) => void>(callback: T | undefined): T {
  return (typeof callback === 'function' ? callback : noop) as T;
}
