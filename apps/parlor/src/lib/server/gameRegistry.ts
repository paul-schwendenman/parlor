import { withGameStateEnvelope, type ServerGameDefinition } from '@parlor/multiplayer';

const definitions = new Map<string, ServerGameDefinition>();

/**
 * Typed definitions (built with `defineGame`) are stored as they are. Games not
 * migrated yet are wrapped so their bare `game:state` views go out as
 * `{ gameId, view }` envelopes like everyone else's (plan 3.1b).
 */
export function registerGame(definition: ServerGameDefinition): void {
	definitions.set(definition.meta.id, withGameStateEnvelope(definition));
}

export function getGameDefinition(gameId: string): ServerGameDefinition | undefined {
	return definitions.get(gameId);
}

export function getAllGames(): ServerGameDefinition[] {
	return [...definitions.values()];
}

export function getGameMetas() {
	return getAllGames().map((g) => g.meta);
}
