import type { QuixxPlayerView, DiceState, RowColor, PlayerScore } from './game.js';

export interface QuixxServerToClientEvents {
  'game:state': (view: QuixxPlayerView) => void;
  'game:diceRolled': (dice: DiceState) => void;
  'game:phase1Waiting': (submittedPlayerIds: string[]) => void;
  'game:rowLocked': (row: RowColor, lockedByPlayerId: string) => void;
  'game:ended': (scores: PlayerScore[]) => void;
}

export interface QuixxClientToServerEvents {
  'game:action': (action: { type: string; row?: RowColor; cellIndex?: number }) => void;
}
