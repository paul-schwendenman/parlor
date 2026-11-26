import type { ActionErrorCode, ActionResult } from '@parlor/game-types';
import type { RoomManager } from './RoomManager.js';
import type { AppServer, AppSocket, ServerGameDefinition } from './gameDefinition.js';
import { logServerError, recordMetric } from './observability.js';
import { safeAck } from './ack.js';
import { allowSocketRequest, RATE_LIMIT_MESSAGE } from './rateLimit.js';
import { INTERNAL_ERROR_MESSAGE, toPublicError } from './errors.js';

/** Limits for the `game:action` envelope (CORE-AUDIT F-04 / B-03). */
export const ACTION_LIMITS = {
  /** Max container nesting, counting the action object itself as depth 1. */
  maxDepth: 4,
  /** Max object keys + array elements across the whole tree. */
  maxNodes: 64,
  /** Max length of any string value or object key. */
  maxStringLength: 256,
  /** Max length of `action.type`. */
  maxTypeLength: 64,
} as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type EnvelopeResult = { ok: true } | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Structural check of a client-sent action, before any game code reads it.
 * Iterative and bounded, so a hostile ~10k-deep payload is rejected after
 * looking at only a few levels.
 */
export function validateActionEnvelope(action: unknown): EnvelopeResult {
  if (!isPlainObject(action)) return { ok: false, message: 'Action must be an object' };

  const type = Object.prototype.hasOwnProperty.call(action, 'type') ? action.type : undefined;
  if (typeof type !== 'string' || type.length === 0 || type.length > ACTION_LIMITS.maxTypeLength) {
    return { ok: false, message: 'Action type is missing or invalid' };
  }

  let nodes = 0;
  const stack: { value: unknown; depth: number }[] = [{ value: action, depth: 1 }];
  while (stack.length > 0) {
    const { value, depth } = stack.pop()!;

    let children: unknown[];
    if (Array.isArray(value)) {
      children = value;
    } else if (isPlainObject(value)) {
      const keys = Object.keys(value);
      for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key)) return { ok: false, message: 'Action contains a forbidden key' };
        if (key.length > ACTION_LIMITS.maxStringLength) return { ok: false, message: 'Action key is too long' };
      }
      children = keys.map((k) => value[k]);
    } else {
      return { ok: false, message: 'Action contains an unsupported value' };
    }

    nodes += children.length;
    if (nodes > ACTION_LIMITS.maxNodes) return { ok: false, message: 'Action is too large' };

    for (const child of children) {
      if (child === null || typeof child === 'boolean') continue;
      if (typeof child === 'number') {
        if (!Number.isFinite(child)) return { ok: false, message: 'Action contains an invalid number' };
        continue;
      }
      if (typeof child === 'string') {
        if (child.length > ACTION_LIMITS.maxStringLength) return { ok: false, message: 'Action string is too long' };
        continue;
      }
      if (typeof child === 'object') {
        if (depth + 1 > ACTION_LIMITS.maxDepth) return { ok: false, message: 'Action is nested too deeply' };
        stack.push({ value: child, depth: depth + 1 });
        continue;
      }
      return { ok: false, message: 'Action contains an unsupported value' };
    }
  }

  return { ok: true };
}

export interface DispatchGameActionOptions {
  io: AppServer;
  socket: AppSocket;
  roomManager: RoomManager;
  /** The definition of the game the sender's room is playing, if any. */
  definition: ServerGameDefinition | null | undefined;
  /** The raw client payload (untrusted). */
  action: unknown;
  /** The raw client ack argument (untrusted; may be absent or not a function). */
  ack: unknown;
  /**
   * Called after an unexpected error from the game handler. The engine may be
   * half-mutated, so the router must take the room out of play (reset to lobby).
   */
  onRoomFailure: (roomCode: string) => void;
}

/**
 * The single entry point for `game:action` (plan 3.1a). In order:
 * envelope → membership/role → active game → game's `validateAction` → handler
 * (which receives the sanitized action `validateAction` returned).
 *
 * - Rejections before the handler leave state untouched and ack the error code.
 * - A `GameRuleError` from the handler acks its code/message and also emits
 *   `error` (existing GameViews listen for that); the game keeps running.
 * - Any other error (sync throw or async rejection) is logged, the client gets
 *   only a generic message, and `onRoomFailure` sends the room back to the lobby.
 *
 * Never throws and never rejects. The returned promise settles with the result
 * that was acked (useful for tests; routers can ignore it).
 */
export function dispatchGameAction(opts: DispatchGameActionOptions): Promise<ActionResult> {
  const { io, socket, roomManager, definition, action, onRoomFailure } = opts;
  const ack = safeAck(opts.ack as ((result: ActionResult) => void) | undefined);

  const context = () => roomManager.getErrorContext(socket.data.roomCode, socket.data.playerId);
  const reply = (result: ActionResult): ActionResult => {
    if (!result.ok) recordMetric('rejectedActions');
    try {
      ack(result);
    } catch (err) {
      logServerError('action_ack_failed', context(), err);
    }
    return result;
  };
  const reject = (code: ActionErrorCode, message: string): ActionResult => reply({ ok: false, code, message });

  try {
    if (!allowSocketRequest(socket)) return Promise.resolve(reject('RATE_LIMITED', RATE_LIMIT_MESSAGE));
    const envelope = validateActionEnvelope(action);
    if (!envelope.ok) return Promise.resolve(reject('INVALID_ACTION', envelope.message));
    const payload = action as Record<string, unknown>;

    const roomCode = socket.data.roomCode;
    if (typeof roomCode !== 'string' || !roomCode || !roomManager.getRoom(roomCode)) {
      return Promise.resolve(reject('NOT_IN_ROOM', 'You are not in a room'));
    }
    const room = roomManager.getRoom(roomCode)!;

    const playerId = socket.data.playerId;
    if (!roomManager.isSeatedPlayer(roomCode, playerId, socket.id)) {
      return Promise.resolve(reject('NOT_A_PLAYER', 'Only seated players can do that'));
    }

    const instance = roomManager.getGameInstance(roomCode);
    if (!instance || room.status !== 'playing' || room.gameData == null || !definition) {
      return Promise.resolve(reject('NO_ACTIVE_GAME', 'No game is in progress'));
    }
    if (!roomManager.isGameParticipant(roomCode, playerId)) {
      return Promise.resolve(reject('NOT_A_PLAYER', 'Only players in this game can do that'));
    }

    const checked = definition.validateAction(payload);
    if (!checked.ok) return Promise.resolve(reject('INVALID_ACTION', checked.message));
    const sanitized = checked.action;

    const logContext = { roomCode, playerId, gameId: room.gameId, instanceId: instance.id, actionType: payload.type };

    const stale = () => reject('NO_ACTIVE_GAME', 'That game is no longer in progress');
    const fail = (err: unknown): ActionResult => {
      if (!instance.isCurrent()) return stale();
      const pub = toPublicError(err, INTERNAL_ERROR_MESSAGE, logContext);
      // `error` first: same transport, so it reaches the client before the ack does.
      socket.emit('error', pub.message);
      const result = reject(pub.code, pub.message);
      if (pub.code === 'INTERNAL') {
        recordMetric('caughtRoomFailures');
        try {
          onRoomFailure(roomCode);
        } catch (failureErr) {
          logServerError('room_failure_callback_failed', logContext, failureErr);
        }
      }
      return result;
    };

    let returned: unknown;
    try {
      returned = definition.handleGameAction(io, socket, roomManager, sanitized);
    } catch (err) {
      return Promise.resolve(fail(err));
    }

    if (isThenable(returned)) {
      return Promise.resolve(returned).then(
        () => instance.isCurrent() ? reply({ ok: true }) : stale(),
        (err: unknown) => fail(err),
      );
    }
    return Promise.resolve(reply({ ok: true }));
  } catch (err) {
    // Only reachable if a check above (or RoomManager) throws. Nothing ran in the game.
    const pub = toPublicError(err, INTERNAL_ERROR_MESSAGE, context());
    return Promise.resolve(reject(pub.code, pub.message));
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
