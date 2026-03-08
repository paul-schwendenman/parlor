import { registerGame } from '../gameRegistry.js';

// Import game server definitions
// These use the "./server-definition" export from each game's package.json
import { quixxDefinition } from '@parlor/quixx/server-definition';
import { crazyEightsDefinition } from '@parlor/crazy-eights/server-definition';
import { bootyDiceDefinition } from '@parlor/booty-dice/server-definition';

export function registerAllGames(): void {
	registerGame(quixxDefinition);
	registerGame(crazyEightsDefinition);
	registerGame(bootyDiceDefinition);
}
