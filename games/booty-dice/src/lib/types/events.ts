import type { BootyDicePlayerView } from './game.js';

export interface BootyDiceServerToClientEvents {
  'game:state': (view: BootyDicePlayerView) => void;
}

export interface BootyDiceClientToServerEvents {
  'game:action': (action: { type: string; [key: string]: unknown }) => void;
}
