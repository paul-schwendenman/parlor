import type { ActionErrorCode } from '@parlor/game-types';

/** Codes a game may attach to a rule rejection. */
export type GameRuleErrorCode = Extract<ActionErrorCode, 'NOT_YOUR_TURN' | 'RULE_VIOLATION' | 'INVALID_ACTION'>;

const GAME_RULE_ERROR = Symbol.for('parlor.GameRuleError');

/**
 * An expected, user-facing rejection of a game action ("Not your turn",
 * "Bid is not high enough"). Its message is safe to send to the client.
 *
 * Throw it only before mutating engine state: the action boundary treats a
 * GameRuleError as "nothing happened" and keeps the game running. Anything
 * else thrown from a handler is treated as an internal failure.
 */
export class GameRuleError extends Error {
  readonly code: GameRuleErrorCode;
  /** Brand so the check survives duplicate copies of this module (e.g. src vs dist). */
  readonly [GAME_RULE_ERROR] = true;

  constructor(message: string, code: GameRuleErrorCode = 'RULE_VIOLATION') {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
  }
}

export function isGameRuleError(err: unknown): err is GameRuleError {
  return (
    err instanceof GameRuleError ||
    (typeof err === 'object' && err !== null && (err as Record<symbol, unknown>)[GAME_RULE_ERROR] === true)
  );
}

export interface PublicError {
  code: ActionErrorCode;
  message: string;
}

/** Context included in the server log line for an unexpected error. */
export interface ErrorLogContext {
  roomCode?: string;
  [key: string]: unknown;
}

/** The generic message sent to clients for any unexpected error. */
export const INTERNAL_ERROR_MESSAGE = 'Something went wrong';

/**
 * Map any thrown value to something safe to send to a client.
 * - GameRuleError → its own code and message.
 * - Anything else → `INTERNAL` with `fallbackMessage`; the real error is logged
 *   server-side and never sent (CORE-AUDIT F-22).
 */
export function toPublicError(
  err: unknown,
  fallbackMessage: string = INTERNAL_ERROR_MESSAGE,
  context: ErrorLogContext = {},
): PublicError {
  if (isGameRuleError(err)) {
    return { code: err.code, message: err.message };
  }
  console.error('[parlor] unexpected error', context, err);
  return { code: 'INTERNAL', message: fallbackMessage };
}
