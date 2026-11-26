/**
 * Small helpers for hand-written per-game `validateAction`s (plan 3.1a; a
 * schema library replaces these in 3.1b). The core envelope check has already
 * run, so the input is a plain object with a short string `type`.
 */

export type ActionValidation<A = Record<string, unknown>> =
  | { ok: true; action: A }
  | { ok: false; message: string };

export function invalid(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

export function valid<A>(action: A): { ok: true; action: A } {
  return { ok: true, action };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every key in `keys` is an own property, and there are no others. */
export function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

/** A real integer (not a numeric string, not NaN) within `[min, max]`. */
export function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/**
 * Validate an action against a table of per-type validators. Unknown types are
 * rejected. Each validator must return a freshly built action containing only
 * validated fields, so nothing client-supplied reaches the engine by identity.
 */
export function validateByType<A>(
  action: Record<string, unknown>,
  validators: Record<string, (action: Record<string, unknown>) => ActionValidation<A>>,
): ActionValidation<A> {
  const type = action.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(validators, type)) {
    return invalid('Unknown action');
  }
  return validators[type](action);
}

/** Validator for actions that carry nothing but their `type`. */
export function typeOnly<A>(type: string): (action: Record<string, unknown>) => ActionValidation<A> {
  return (action) =>
    hasExactKeys(action, ['type']) ? valid({ type } as A) : invalid('Unexpected fields in action');
}
