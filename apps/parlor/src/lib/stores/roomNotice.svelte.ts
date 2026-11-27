import type { HostChangeReason, LobbyPlayer } from '@parlor/game-types';
import { hostChangeMessage } from '$lib/hostNotice.js';

/** How long a notice stays up. */
export const NOTICE_MS = 4000;

/**
 * Short room-wide notices (who hosts now), shown by `RoomToast` on the lobby
 * and game pages. Tracks the host and every name it has seen itself, because
 * the runtime's `lobbyState` has already moved on by the time a listener here
 * runs, and a host who left is gone from the roster.
 */
class RoomNotice {
	message = $state('');
	/** The room the message belongs to: it shows only while the viewer is in it. */
	roomCode = $state('');
	/** Bumped per notice so a repeat still re-announces and restarts its timer. */
	seq = $state(0);

	#hostId = '';
	#hostRoom = '';
	#names = new Map<string, string>();
	#timer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Every `lobby:state`. Also seeds the host for a room this client created,
	 * which learns its host from the create reply, not from `lobby:hostChanged`.
	 */
	rememberPlayers(roomCode: string, hostId: string, players: LobbyPlayer[]) {
		for (const p of players) this.#names.set(p.id, p.name);
		if (roomCode && hostId && this.#hostRoom !== roomCode) {
			this.#hostRoom = roomCode;
			this.#hostId = hostId;
		}
	}

	hostChanged(roomCode: string, me: string, newHostId: string, reason?: HostChangeReason) {
		if (!roomCode) return;
		// A different room (just joined or created): start over without a notice.
		const previousHostId = this.#hostRoom === roomCode ? this.#hostId : '';
		this.#hostRoom = roomCode;
		this.#hostId = newHostId;
		const message = hostChangeMessage({
			me,
			previousHostId,
			newHostId,
			reason,
			nameOf: (id) => this.#names.get(id),
		});
		if (message) this.show(roomCode, message);
	}

	show(roomCode: string, message: string) {
		clearTimeout(this.#timer);
		this.roomCode = roomCode;
		this.message = message;
		this.seq += 1;
		this.#timer = setTimeout(() => this.dismiss(), NOTICE_MS);
	}

	dismiss() {
		clearTimeout(this.#timer);
		this.message = '';
	}

	reset() {
		this.dismiss();
		this.roomCode = '';
		this.#hostId = '';
		this.#hostRoom = '';
		this.#names.clear();
	}
}

export const roomNotice = new RoomNotice();
