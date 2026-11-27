import { parseCard } from '@parlor/cards';
import {
  defineGame, hasExactKeys, invalid, isIntInRange, RoomManager, valid, validateByType,
  type GameContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { SpadesEngine } from './engine.js';
import { spadesMeta } from './meta.js';
import type { SpadesAction } from './types.js';

const STEP = 'spades-step';

function drive(game: GameContext<SpadesEngine>): void {
  const { state, instance } = game;
  instance.cancel(STEP);

  const phase = state.currentPhase;
  const revealDelay = phase === 'round-scoring' ? 6500 : phase === 'trick-won' ? 1200 : 0;
  if (!revealDelay && !state.automaticAction()) return;

  instance.schedule(() => {
    if (revealDelay) {
      state.advanceReveal();
    } else {
      const move = state.automaticAction();
      if (!move) return;
      const { id, action } = move;
      if (action.type === 'bid') state.bid(id, action.amount);
      else state.playCard(id, action.card);
    }
    game.broadcast();
    drive(game);
  }, revealDelay || 450, STEP);
}

export const spadesGame: TypedGameDefinition<'spades', SpadesEngine> = {
  meta: spadesMeta,
  createState: (_room, players) => new SpadesEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<SpadesAction>(action, {
    bid: (input) => hasExactKeys(input, ['type', 'amount']) && isIntInRange(input.amount, 0, 13)
      ? valid({ type: 'bid', amount: input.amount })
      : invalid('Choose a bid from 0 to 13.'),
    'play-card': (input) => {
      const card = hasExactKeys(input, ['type', 'card']) ? parseCard(input.card) : null;
      return card ? valid({ type: 'play-card', card }) : invalid('Invalid card.');
    },
  }),
  actions: {
    bid: (game, { amount }) => {
      game.state.bid(game.playerId, amount);
      drive(game);
    },
    'play-card': (game, { card }) => {
      game.state.playCard(game.playerId, card);
      drive(game);
    },
  },
  getPlayerView: (engine, id) => engine.view(id),
  getSpectatorView: (engine) => engine.view(),
  isGameOver: (engine) => engine.currentPhase === 'game-over',
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

export const spadesDefinition = defineGame(spadesGame);
