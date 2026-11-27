import type { HostChangeReason } from '@parlor/game-types';

export interface HostChange {
	/** This viewer's player id ('' for a spectator). */
	me: string;
	/** Who held the role before this event, as far as this client knows ('' if it doesn't). */
	previousHostId: string;
	newHostId: string;
	reason?: HostChangeReason;
	/** A player's name, including players who have since left. */
	nameOf: (playerId: string) => string | undefined;
}

/**
 * The toast for a `lobby:hostChanged`, or null when nothing changed for this
 * viewer (the first sync after joining, or the same host again).
 */
export function hostChangeMessage({ me, previousHostId, newHostId, reason, nameOf }: HostChange): string | null {
	if (!previousHostId || !newHostId || previousHostId === newHostId) return null;

	const isNew = !!me && me === newHostId;
	const wasMe = !!me && me === previousHostId;
	const newName = nameOf(newHostId);
	const oldName = nameOf(previousHostId);
	// The roster always holds the new host; this is only a guard.
	if (!isNew && !newName) return 'The host has changed';
	const newHost = newName;
	const fallback = isNew ? "You're the host now" : `${newHost} is the host now`;

	switch (reason) {
		case 'transfer':
			if (isNew) return "You're the host now";
			if (wasMe) return `You made ${newHost} the host`;
			return oldName ? `${oldName} made ${newHost} the host` : fallback;
		case 'handoff':
			if (wasMe) return `${newHost} is the host while you're away`;
			if (!oldName) return fallback;
			return isNew ? `You're the host while ${oldName} is away` : `${newHost} is the host while ${oldName} is away`;
		case 'left':
			return oldName && !wasMe ? `${oldName} left. ${fallback}` : fallback;
		default:
			// The role moved while this client wasn't listening (e.g. it was the
			// host and has just reconnected): say who hosts now.
			return fallback;
	}
}
