import { registerGame } from '../gameRegistry.js';

// Import game server definitions
// These use the "./server-definition" export from each game's package.json
import { quixxDefinition } from '@parlor/quixx/server-definition';
import { crazyEightsDefinition } from '@parlor/crazy-eights/server-definition';
import { bootyDiceDefinition } from '@parlor/booty-dice/server-definition';
import { liarsDiceDefinition } from '@parlor/liars-dice/server-definition';
import { spadesDefinition } from '@parlor/spades/server-definition';
import { euchreDefinition } from '@parlor/euchre/server-definition';
import { ohHellDefinition } from '@parlor/oh-hell/server-definition';
import { golfDefinition } from '@parlor/golf/server-definition';
import { heartsDefinition } from '@parlor/hearts/server-definition';
import { kingsCornerDefinition } from '@parlor/kings-corner/server-definition';

import { farkleDefinition } from '@parlor/farkle/server-definition';
import { wordSplitDefinition } from '@parlor/word-split/server-definition';

export function registerAllGames(): void {
	registerGame(quixxDefinition);
	registerGame(crazyEightsDefinition);
	registerGame(bootyDiceDefinition);
	registerGame(liarsDiceDefinition);
	registerGame(kingsCornerDefinition);
	registerGame(heartsDefinition);
	registerGame(spadesDefinition);
	registerGame(euchreDefinition);
	registerGame(ohHellDefinition);
	registerGame(farkleDefinition);
	registerGame(golfDefinition);
	registerGame(wordSplitDefinition);
}
