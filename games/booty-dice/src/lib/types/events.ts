import type { ActionResult } from '@parlor/game-types';
import type { BootyDicePlayerView } from './game.js';

export interface BootyDiceServerToClientEvents {
  'game:state': (view: BootyDicePlayerView) => void;
}

export interface BootyDiceClientToServerEvents {
  'game:action': (action: { type: string; [key: string]: unknown }, ack?: (result: ActionResult) => void) => void;
}
