import { parseCard, SUITS } from '@parlor/cards';
import {
  defineGame, hasExactKeys, invalid, isOneOf, RoomManager, type ActionValidation,
  type GameContext, type TypedGameDefinition, typeOnly, valid, validateByType,
} from '@parlor/multiplayer';
import { EuchreEngine } from './engine.js';
import { euchreMeta } from './meta.js';
import type { EuchreAction } from './types.js';

const STEP = 'euchre-step';

function apply(state: EuchreEngine, id: string, action: EuchreAction): void {
  switch (action.type) {
    case 'pass': return state.pass(id);
    case 'order-up': return state.orderUp(id, action.alone);
    case 'name-trump': return state.nameTrump(id, action.suit, action.alone);
    case 'discard': return state.discard(id, action.card);
    case 'play-card': return state.playCard(id, action.card);
  }
}

function drive(game: GameContext<EuchreEngine>): void {
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
      apply(state, move.id, move.action);
    }
    game.broadcast();
    drive(game);
  }, revealDelay || 450, STEP);
}

function cardAction(type: 'discard' | 'play-card') {
  return (input: Record<string, unknown>): ActionValidation<EuchreAction> => {
    const card = hasExactKeys(input, ['type', 'card']) ? parseCard(input.card) : null;
    return card ? valid({ type, card }) : invalid('Invalid card.');
  };
}

export const euchreGame: TypedGameDefinition<'euchre', EuchreEngine> = {
  meta: euchreMeta,
  createState: (_room, players) => new EuchreEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<EuchreAction>(action, {
    pass: typeOnly('pass'),
    'order-up': (input) => hasExactKeys(input, ['type', 'alone']) && typeof input.alone === 'boolean'
      ? valid({ type: 'order-up', alone: input.alone })
      : invalid('Choose whether to play alone.'),
    'name-trump': (input) => hasExactKeys(input, ['type', 'suit', 'alone']) &&
      isOneOf(input.suit, SUITS) && typeof input.alone === 'boolean'
      ? valid({ type: 'name-trump', suit: input.suit, alone: input.alone })
      : invalid('Choose a valid trump suit and whether to play alone.'),
    discard: cardAction('discard'),
    'play-card': cardAction('play-card'),
  }),
  actions: {
    pass: (game, action) => act(game, action),
    'order-up': (game, action) => act(game, action),
    'name-trump': (game, action) => act(game, action),
    discard: (game, action) => act(game, action),
    'play-card': (game, action) => act(game, action),
  },
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

function act(game: GameContext<EuchreEngine> & { playerId: string }, action: EuchreAction): void {
  apply(game.state, game.playerId, action);
  drive(game);
}

export const euchreDefinition = defineGame(euchreGame);
