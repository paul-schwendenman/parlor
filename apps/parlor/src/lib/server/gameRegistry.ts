import type { ServerGameDefinition } from '@parlor/multiplayer';

const definitions = new Map<string, ServerGameDefinition>();

export function registerGame(definition: ServerGameDefinition): void {
	definitions.set(definition.meta.id, definition);
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
