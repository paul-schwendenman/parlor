import {
  defineGame, hasExactKeys, invalid, RoomManager, valid, validateByType,
  type GameContext, type PlayerContext, type TypedGameDefinition,
} from '@parlor/multiplayer';
import { GolfEngine } from './engine.js';
import { golfMeta } from './meta.js';
import { SLOT_COUNT } from './rules.js';
import type { GolfAction } from './types.js';

const STEP = 'golf-step';

function drive(game: GameContext<GolfEngine>) {
  const { state, instance } = game;
  instance.cancel(STEP);
  if (!state.revealing && !state.automaticMove()) return;
  instance.schedule(() => {
    if (state.revealing) state.advanceReveal();
    else state.automaticMove()?.();
    game.broadcast();
    drive(game);
  }, state.revealing ? 6000 : 700, STEP);
}

function act(game: PlayerContext<GolfEngine>, action: GolfAction) {
  game.state.act(game.playerId, action);
  drive(game);
}

function withSlot<T extends Extract<GolfAction, { slot: number }>['type']>(type: T) {
  return (input: Record<string, unknown>) => {
    const { slot } = input;
    return hasExactKeys(input, ['type', 'slot']) && typeof slot === 'number' &&
      Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT
      ? valid({ type, slot })
      : invalid('Choose one of the six slots.');
  };
}

const game: TypedGameDefinition<'golf', GolfEngine> = {
  meta: golfMeta,
  createState: (_room, players) => new GolfEngine(players.map(({ id, name }) => ({
    id, name, bot: RoomManager.isBotPlayer(id),
  }))),
  validateAction: (action) => validateByType<GolfAction>(action, {
    'draw-stock': (input) => hasExactKeys(input, ['type']) ? valid({ type: 'draw-stock' }) : invalid('Invalid draw.'),
    'discard-drawn': (input) => hasExactKeys(input, ['type']) ? valid({ type: 'discard-drawn' }) : invalid('Invalid discard.'),
    reveal: withSlot('reveal'),
    'take-discard': withSlot('take-discard'),
    'swap-drawn': withSlot('swap-drawn'),
    flip: withSlot('flip'),
  }),
  actions: {
    'draw-stock': act, 'take-discard': act, 'swap-drawn': act,
    'discard-drawn': act, reveal: act, flip: act,
  },
  getPlayerView: (engine, id) => engine.view(id),
  getSpectatorView: (engine) => engine.view(),
  isGameOver: (engine) => engine.gameOver,
  onGameStart: drive,
  onPlayerDisconnect: disconnect,
  onPlayerRemoved: disconnect,
  onPlayerReconnect: (game) => { game.state.setConnected(game.playerId, true); drive(game); },
  onRoomDestroyed: () => undefined,
};

function disconnect(game: PlayerContext<GolfEngine>) {
  game.state.setConnected(game.playerId, false);
  drive(game);
}

export const golfDefinition = defineGame(game);
