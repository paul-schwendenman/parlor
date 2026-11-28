import { cardEquals, parseCard } from '@parlor/cards';
import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { PresidentEngine } from './engine.js';
import { presidentMeta } from './meta.js';
import type { PresidentAction } from './types.js';

const drive = createTurnDriver<PresidentEngine>('president-step', 600, (state) =>
  state.currentPhase === 'trick-cleared' ? 1000 : state.currentPhase === 'hand-scoring' ? 5500 : undefined);

function act(game: PlayerContext<PresidentEngine>, action: PresidentAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function withCards<T extends 'play' | 'return-cards'>(type: T, max: number) {
  return (input: Record<string, unknown>) => {
    if (!hasExactKeys(input, ['type', 'cards']) || !Array.isArray(input.cards) || !input.cards.length || input.cards.length > max) {
      return invalid('Choose cards from your hand.');
    }
    const cards = Array.from(input.cards, parseCard);
    if (!cards.every((card, i) => card && !cards.slice(0, i).some((earlier) => earlier && cardEquals(earlier, card)))) {
      return invalid('Choose distinct cards from your hand.');
    }
    return valid({ type, cards: cards.filter((card) => card !== null) });
  };
}

const game: TypedGameDefinition<'president', PresidentEngine> = {
  meta: presidentMeta,
  createState: (_room, players) => new PresidentEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<PresidentAction>(action, {
    play: withCards('play', 4),
    'return-cards': withCards('return-cards', 2),
    pass: (input) => hasExactKeys(input, ['type']) ? valid({ type: 'pass' }) : invalid('Invalid pass.'),
  }),
  actions: { play: act, 'return-cards': act, pass: act },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.currentPhase === 'game-over',
  onGameStart: drive,
  onPlayerDisconnect: disconnect,
  onPlayerRemoved: disconnect,
  onPlayerReconnect: (game) => { game.state.setConnected(game.playerId, true); drive(game); },
  onRoomDestroyed: () => undefined,
};

function disconnect(game: PlayerContext<PresidentEngine>) {
  game.state.setConnected(game.playerId, false);
  drive(game);
}

export const presidentDefinition = defineGame(game);
