import { cardEquals, parseCard } from '@parlor/cards';
import {
  defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type GameContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { HeartsEngine } from './engine.js';
import { heartsMeta } from './meta.js';
import type { HeartsAction } from './types.js';

const STEP = 'hearts-step';

function drive(game: GameContext<HeartsEngine>): void {
  const { state, instance } = game;
  instance.cancel(STEP);
  const reveal = state.currentPhase === 'trick-won' || state.currentPhase === 'round-scoring';
  if (!reveal && !state.automaticMove()) return;

  const delay = state.currentPhase === 'round-scoring' ? 5500 : reveal ? 1400 : 400;
  instance.schedule(() => {
    if (reveal) state.advanceReveal();
    else state.automaticMove()?.();
    game.broadcast();
    drive(game);
  }, delay, STEP);
}

export const heartsGame: TypedGameDefinition<'hearts', HeartsEngine> = {
  meta: heartsMeta,
  createState: (_room, players) => new HeartsEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<HeartsAction>(action, {
    'pass-cards': (input) => {
      if (!hasExactKeys(input, ['type', 'cards']) || !Array.isArray(input.cards) || input.cards.length !== 3) {
        return invalid('Choose three different cards.');
      }
      const [first, second, third] = input.cards.map(parseCard);
      if (!first || !second || !third ||
        cardEquals(first, second) || cardEquals(first, third) || cardEquals(second, third)) {
        return invalid('Choose three different cards.');
      }
      return valid({ type: 'pass-cards', cards: [first, second, third] });
    },
    'play-card': (input) => {
      const card = hasExactKeys(input, ['type', 'card']) ? parseCard(input.card) : null;
      return card ? valid({ type: 'play-card', card }) : invalid('Invalid card.');
    },
  }),
  actions: {
    'pass-cards': (game, { cards }) => {
      game.state.passCards(game.playerId, cards);
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
  // Hearts needs all four hands in play. A departed seat stays under stand-in control.
  onPlayerRemoved: (game) => {
    game.state.setConnected(game.playerId, false);
    drive(game);
  },
  onRoomDestroyed: () => undefined,
};

export const heartsDefinition = defineGame(heartsGame);
