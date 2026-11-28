import { parseCard } from '@parlor/cards';
import {
  createTurnDriver, defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { GinEngine } from './engine.js';
import { ginRummyMeta } from './meta.js';
import type { GinAction } from './types.js';

const drive = createTurnDriver<GinEngine>('gin-step', 600, (state) => state.revealing ? 7000 : undefined);

function act(game: PlayerContext<GinEngine>, action: GinAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function only<T extends 'take-discard' | 'pass-upcard' | 'draw-stock' | 'big-gin'>(type: T) {
  return (input: Record<string, unknown>) => hasExactKeys(input, ['type']) ? valid({ type }) : invalid('Invalid action.');
}

function withCard<T extends 'discard' | 'knock'>(type: T) {
  return (input: Record<string, unknown>) => {
    const card = hasExactKeys(input, ['type', 'card']) ? parseCard(input.card) : null;
    return card ? valid({ type, card }) : invalid('Choose a card from your hand.');
  };
}

const game: TypedGameDefinition<'gin-rummy', GinEngine> = {
  meta: ginRummyMeta,
  createState: (_room, players) => new GinEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<GinAction>(action, {
    'take-discard': only('take-discard'), 'pass-upcard': only('pass-upcard'), 'draw-stock': only('draw-stock'),
    'big-gin': only('big-gin'), discard: withCard('discard'), knock: withCard('knock'),
  }),
  actions: {
    'take-discard': act, 'pass-upcard': act, 'draw-stock': act, 'big-gin': act, discard: act, knock: act,
  },
  getPlayerView: (state, id) => state.view(id),
  getSpectatorView: (state) => state.view(),
  isGameOver: (state) => state.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: disconnect,
  onPlayerRemoved: disconnect,
  onPlayerReconnect: (game) => { game.state.setConnected(game.playerId, true); drive(game); },
  onRoomDestroyed: () => undefined,
};

function disconnect(game: PlayerContext<GinEngine>) {
  game.state.setConnected(game.playerId, false);
  drive(game);
}

export const ginRummyDefinition = defineGame(game);
