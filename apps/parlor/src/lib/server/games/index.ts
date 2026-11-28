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
import { presidentDefinition } from '@parlor/president/server-definition';
import { ginRummyDefinition } from '@parlor/gin-rummy/server-definition';
import { golfDefinition } from '@parlor/golf/server-definition';
import { heartsDefinition } from '@parlor/hearts/server-definition';
import { kingsCornerDefinition } from '@parlor/kings-corner/server-definition';

import { cipherPostDefinition } from '@parlor/cipher-post/server-definition';
import { faultLineDefinition } from '@parlor/fault-line/server-definition';
import { signalRelayDefinition } from '@parlor/signal-relay/server-definition';
import { nightMarketDefinition } from '@parlor/night-market/server-definition';
import { ridgeRunDefinition } from '@parlor/ridge-run/server-definition';
import { harborDiceDefinition } from '@parlor/harbor-dice/server-definition';
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
	registerGame(harborDiceDefinition);
	registerGame(ridgeRunDefinition);
	registerGame(nightMarketDefinition);
	registerGame(signalRelayDefinition);
	registerGame(faultLineDefinition);
	registerGame(cipherPostDefinition);
	registerGame(golfDefinition);
	registerGame(ginRummyDefinition);
	registerGame(presidentDefinition);
	registerGame(wordSplitDefinition);
}
