import { describe, expect, it } from 'vitest';
import { hasExactKeys, isIntInRange, isOneOf, isRecord, typeOnly, validateByType, valid } from './actionValidation.js';

describe('action validation helpers', () => {
  it('hasExactKeys requires exactly the listed own keys', () => {
    expect(hasExactKeys({ type: 'x', a: 1 }, ['type', 'a'])).toBe(true);
    expect(hasExactKeys({ type: 'x' }, ['type', 'a'])).toBe(false);
    expect(hasExactKeys({ type: 'x', a: 1, b: 2 }, ['type', 'a'])).toBe(false);
    expect(hasExactKeys({ type: 'x', b: 1 }, ['type', 'a'])).toBe(false);
  });

  it('isIntInRange rejects strings, floats, NaN and out-of-range values', () => {
    expect(isIntInRange(3, 0, 5)).toBe(true);
    expect(isIntInRange(0, 0, 5)).toBe(true);
    expect(isIntInRange('3', 0, 5)).toBe(false);
    expect(isIntInRange(2.5, 0, 5)).toBe(false);
    expect(isIntInRange(NaN, 0, 5)).toBe(false);
    expect(isIntInRange(6, 0, 5)).toBe(false);
    expect(isIntInRange(-1, 0, 5)).toBe(false);
  });

  it('isOneOf / isRecord', () => {
    expect(isOneOf('red', ['red', 'blue'])).toBe(true);
    expect(isOneOf('purple', ['red', 'blue'])).toBe(false);
    expect(isOneOf(1, ['red'])).toBe(false);
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('validateByType rejects unknown and inherited types and dispatches known ones', () => {
    const validators = { roll: typeOnly('roll'), echo: (a: Record<string, unknown>) => valid(a) };
    expect(validateByType({ type: 'roll' }, validators)).toEqual({ ok: true, action: { type: 'roll' } });
    expect(validateByType({ type: 'roll', extra: 1 }, validators)).toMatchObject({ ok: false });
    expect(validateByType({ type: 'nope' }, validators)).toEqual({ ok: false, message: 'Unknown action' });
    expect(validateByType({ type: 'toString' }, validators)).toEqual({ ok: false, message: 'Unknown action' });
  });

  it('typeOnly builds a fresh object', () => {
    const input = { type: 'roll' };
    const result = typeOnly('roll')(input);
    expect(result.ok && result.action).not.toBe(input);
  });
});
