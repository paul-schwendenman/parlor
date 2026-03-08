class PlayerState {
	id = $state('');
	name = $state('');
	roomCode = $state('');

	set(data: { id: string; name: string; roomCode: string }) {
		this.id = data.id;
		this.name = data.name;
		this.roomCode = data.roomCode;
	}

	reset() {
		this.id = '';
		this.name = '';
		this.roomCode = '';
	}
}

export const playerState = new PlayerState();
