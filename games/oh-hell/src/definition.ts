import { parseCard } from '@parlor/cards';
import {
  defineGame, hasExactKeys, invalid, RoomManager, type GameContext,
  type TypedGameDefinition, valid, validateByType,
} from '@parlor/multiplayer';
import { OhHellEngine } from './engine.js';
import { ohHellMeta } from './meta.js';
import type { OhHellAction } from './types.js';

const STEP = 'oh-hell-step';

function drive(game: GameContext<OhHellEngine>): void {
  const { state, instance } = game;
  instance.cancel(STEP);
  const phase = state.currentPhase;
  const revealDelay = phase === 'round-scoring' ? 5500 : phase === 'trick-won' ? 1200 : 0;
  if (!revealDelay && !state.automaticAction()) return;

  instance.schedule(() => {
    if (revealDelay) {
      state.advanceReveal();
    } else {
      const move = state.automaticAction();
      if (!move) return;
      state.act(move.id, move.action);
    }
    game.broadcast();
    drive(game);
  }, revealDelay || 450, STEP);
}

export const ohHellGame: TypedGameDefinition<'oh-hell', OhHellEngine> = {
  meta: ohHellMeta,
  createState: (_room, players) => new OhHellEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<OhHellAction>(action, {
    bid: (input) => hasExactKeys(input, ['type', 'tricks']) &&
      typeof input.tricks === 'number' && Number.isInteger(input.tricks) && input.tricks >= 0
      ? valid({ type: 'bid', tricks: input.tricks })
      : invalid('Choose a whole number of tricks.'),
    'play-card': (input) => {
      const card = hasExactKeys(input, ['type', 'card']) ? parseCard(input.card) : null;
      return card ? valid({ type: 'play-card', card }) : invalid('Invalid card.');
    },
  }),
  actions: { bid: act, 'play-card': act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: (game) => {
    game.state.setConnected(game.playerId, false);
    drive(game);
  },
  onPlayerReconnect: (game) => {
    game.state.setConnected(game.playerId, true);
    drive(game);
  },
  onPlayerRemoved: (game) => {
    game.state.setConnected(game.playerId, false);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

function act(game: GameContext<OhHellEngine> & { playerId: string }, action: OhHellAction): void {
  game.state.act(game.playerId, action);
  drive(game);
}

export const ohHellDefinition = defineGame(ohHellGame);
