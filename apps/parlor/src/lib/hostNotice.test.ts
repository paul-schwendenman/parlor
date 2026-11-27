import { describe, expect, it } from 'vitest';
import { hostChangeMessage, type HostChange } from './hostNotice.js';

const names: Record<string, string> = { m: 'Margaret', j: 'Joe', a: 'Ann' };
const nameOf = (id: string) => names[id];

function say(me: string, change: Partial<HostChange> = {}) {
	return hostChangeMessage({ me, previousHostId: 'm', newHostId: 'j', nameOf, ...change });
}

describe('hostChangeMessage', () => {
	it('stays quiet for a sync that changes nothing', () => {
		expect(say('a', { previousHostId: '' })).toBeNull();
		expect(say('a', { previousHostId: 'j' })).toBeNull();
		expect(say('a', { previousHostId: 'j', reason: 'transfer' })).toBeNull();
	});

	it('names who made whom host for a hand-over', () => {
		expect(say('a', { reason: 'transfer' })).toBe('Margaret made Joe the host');
		expect(say('', { reason: 'transfer' })).toBe('Margaret made Joe the host');
		expect(say('j', { reason: 'transfer' })).toBe("You're the host now");
		expect(say('m', { reason: 'transfer' })).toBe('You made Joe the host');
	});

	it('says the old host is away for the delayed hand-off', () => {
		expect(say('a', { reason: 'handoff' })).toBe('Joe is the host while Margaret is away');
		expect(say('j', { reason: 'handoff' })).toBe("You're the host while Margaret is away");
		expect(say('m', { reason: 'handoff' })).toBe("Joe is the host while you're away");
	});

	it('says the old host left when they did', () => {
		expect(say('a', { reason: 'left' })).toBe('Margaret left. Joe is the host now');
		expect(say('j', { reason: 'left' })).toBe("Margaret left. You're the host now");
	});

	it('falls back to who hosts now when a name or the reason is missing', () => {
		expect(say('a', { previousHostId: 'x', reason: 'transfer' })).toBe('Joe is the host now');
		expect(say('a', { newHostId: 'x', reason: 'transfer' })).toBe('The host has changed');
		expect(say('m')).toBe('Joe is the host now');
		expect(say('j')).toBe("You're the host now");
	});
});
